import { Fragment } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Download, Printer, FileBarChart, Boxes, Layers, Wallet, Filter,
  Package, Tag, Building2, Users,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line, LabelList, ReferenceLine,
} from "recharts";

import { useAuth } from "@/store/authStore";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Fetély" },
      { name: "description", content: "Relatórios analíticos detalhados de vendas." },
    ],
  }),
  component: RelatoriosPage,
});

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type PeriodoQuick = "hoje" | "semana" | "mes" | "trimestre" | "semestre" | "ano" | "personalizado";
type TipoVendFiltro = "todos" | "interno" | "rep";
type TabKey = "geral" | "produto" | "colecao" | "grupo" | "tipo" | "departamento" | "cliente" | "financeiro";

interface OrderRow {
  id: string;
  created_at: string;
  vendedor_id: string;
  vendedor_nome: string;
  vendedor_tipo: string | null;
  cliente_snapshot: { razaoSocial?: string; nomeFantasia?: string; cnpj?: string } | null;
  total: number;
  total_unidades: number;
  total_skus: number;
  forma_pagamento: string | null;
  frete: string | null;
  commercial: Commercial | null;
}

interface Commercial {
  bruto?: number;
  totalFinal?: number;
  faixaNome?: string;
  descontoMasterPct?: number;
  descontoMasterValor?: number;
  descontoCelebraValor?: number;
  bonusPixValor?: number;
  negociacao?: boolean;
  condicaoDescricao?: string;
  frete?: string;
}

interface ItemRow {
  sku: string;
  quantity: number;
  subtotal_bruto: number;
  product_snapshot: {
    nomeComercial?: string;
    colecao?: string;
    grupo?: string;
    tipo?: string;
    categoria?: string;
    departamento?: string;
    corNome?: string;
    tamanhoNumero?: string;
    precoAtacado?: number;
  } | null;

  orders: {
    id: string;
    created_at: string;
    vendedor_id: string;
    vendedor_tipo: string | null;
    total: number;
    status_pedido?: string;
    reprovado?: boolean;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Period helpers
// ────────────────────────────────────────────────────────────────────────────

function rangeFor(p: PeriodoQuick, customFrom?: string, customTo?: string): { from: Date; to: Date; label: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

  if (p === "hoje") return { from: startOfDay(now), to: endOfDay(now), label: "Hoje" };
  if (p === "semana") {
    const day = now.getDay();
    const from = new Date(now); from.setDate(now.getDate() - day);
    return { from: startOfDay(from), to: endOfDay(now), label: "Semana" };
  }
  if (p === "mes") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      label: "Mês atual",
    };
  }
  if (p === "trimestre") {
    const q = Math.floor(now.getMonth() / 3);
    return {
      from: new Date(now.getFullYear(), q * 3, 1),
      to: new Date(now.getFullYear(), q * 3 + 3, 1),
      label: "Trimestre",
    };
  }
  if (p === "semestre") {
    const s = now.getMonth() < 6 ? 0 : 6;
    return {
      from: new Date(now.getFullYear(), s, 1),
      to: new Date(now.getFullYear(), s + 6, 1),
      label: "Semestre",
    };
  }
  if (p === "ano") {
    return {
      from: new Date(now.getFullYear(), 0, 1),
      to: new Date(now.getFullYear() + 1, 0, 1),
      label: "Ano",
    };
  }
  // personalizado
  const f = customFrom ? new Date(customFrom + "T00:00:00") : startOfDay(now);
  const t = customTo ? new Date(customTo + "T23:59:59") : endOfDay(now);
  return { from: f, to: t, label: "Personalizado" };
}

// ────────────────────────────────────────────────────────────────────────────
// CSV helper
// ────────────────────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: Array<Record<string, string | number>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(";")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function periodSuffix(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

const GOLD = "#C9A84C";
const PIE_COLORS = ["#C9A84C", "#8B7B3D", "#5C5028", "#3F371C", "#E8DBA8", "#A89048"];

const TOOLTIP_STYLE = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  padding: "8px 10px",
  boxShadow: "0 8px 24px -12px rgba(0,0,0,.45)",
} as const;

const AXIS_TICK = { fill: "var(--text-muted)", fontSize: 10 } as const;

function fmtCompactBRL(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(v)}`;
}

function RelatoriosPage() {
  const session = useAuth((s) => s.session);
  const loading = useAuth((s) => s.loading);
  const roles = useAuth((s) => s.roles);
  const isAdminOrMaster = roles.includes("admin") || roles.includes("master");
  const isCliente = roles.includes("cliente");
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) { navigate({ to: "/login" }); return; }
    if (isCliente && !isAdminOrMaster) navigate({ to: "/portal" });
  }, [loading, session, isCliente, isAdminOrMaster, navigate]);

  const [periodo, setPeriodo] = useState<PeriodoQuick>("mes");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [vendedorFiltro, setVendedorFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState<TipoVendFiltro>("todos");
  const [tab, setTab] = useState<TabKey>("geral");

  const range = useMemo(() => rangeFor(periodo, customFrom, customTo), [periodo, customFrom, customTo]);
  const rangeAnt = useMemo(() => {
    const span = range.to.getTime() - range.from.getTime();
    return { from: new Date(range.from.getTime() - span), to: range.from };
  }, [range]);

  const { data: vendedoresList = [] } = useQuery({
    enabled: !!session && isAdminOrMaster,
    queryKey: ["rel-vendedores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome_completo, tipo_vendedor")
        .not("tipo_vendedor", "is", null)
        .eq("ativo", true)
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; nome_completo: string; tipo_vendedor: string | null }>;
    },
  });

  const buildOrdersQuery = (from: Date, to: Date) => {
    let q = supabase
      .from("orders")
      .select(
        "id, created_at, vendedor_id, vendedor_nome, vendedor_tipo, cliente_snapshot, total, total_unidades, total_skus, forma_pagamento, frete, commercial",
      )
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString())
      .eq("status_pedido", "confirmado")
      .eq("reprovado", false)
      .order("created_at", { ascending: false });
    if (vendedorFiltro !== "todos") q = q.eq("vendedor_id", vendedorFiltro);
    if (tipoFiltro !== "todos") q = q.eq("vendedor_tipo", tipoFiltro);
    return q;
  };

  const filtroKey = `${range.from.toISOString()}|${range.to.toISOString()}|${vendedorFiltro}|${tipoFiltro}`;

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    enabled: !!session && !isCliente,
    queryKey: ["rel-orders", filtroKey],
    queryFn: async () => {
      const { data, error } = await buildOrdersQuery(range.from, range.to);
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const { data: ordersPrev = [] } = useQuery({
    enabled: !!session && !isCliente,
    queryKey: ["rel-orders-prev", filtroKey],
    queryFn: async () => {
      const { data, error } = await buildOrdersQuery(rangeAnt.from, rangeAnt.to);
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    enabled: !!session && !isCliente && (tab === "produto" || tab === "colecao" || tab === "grupo" || tab === "tipo" || tab === "departamento" || tab === "cliente"),
    queryKey: ["rel-items", filtroKey, tab],
    queryFn: async () => {
      let q = supabase
        .from("order_items")
        .select(
          "sku, quantity, subtotal_bruto, product_snapshot, orders!inner(id, created_at, vendedor_id, vendedor_tipo, total, status_pedido, reprovado)",
        )
        .gte("orders.created_at", range.from.toISOString())
        .lt("orders.created_at", range.to.toISOString())
        .eq("orders.status_pedido", "confirmado")
        .eq("orders.reprovado", false);
      if (vendedorFiltro !== "todos") q = q.eq("orders.vendedor_id", vendedorFiltro);
      if (tipoFiltro !== "todos") q = q.eq("orders.vendedor_tipo", tipoFiltro);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as unknown as ItemRow[];
      return rows.filter(
        (r) => r.orders?.status_pedido === "confirmado" && r.orders?.reprovado !== true,
      );
    },
  });

  if (loading || !session || isCliente) {
    return <main className="min-h-[60vh] flex items-center justify-center text-text-secondary text-sm">Carregando...</main>;
  }

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: "geral", label: "Vendas Geral", icon: <FileBarChart className="h-3.5 w-3.5" /> },
    { key: "produto", label: "Por Produto", icon: <Boxes className="h-3.5 w-3.5" /> },
    { key: "colecao", label: "Por Coleção", icon: <Layers className="h-3.5 w-3.5" /> },
    { key: "grupo", label: "Por Grupo", icon: <Package className="h-3.5 w-3.5" /> },
    { key: "tipo", label: "Por Tipo", icon: <Tag className="h-3.5 w-3.5" /> },
    { key: "departamento", label: "Por Departamento", icon: <Building2 className="h-3.5 w-3.5" /> },
    { key: "cliente", label: "Por Cliente", icon: <Users className="h-3.5 w-3.5" /> },
    { key: "financeiro", label: "Financeiro", icon: <Wallet className="h-3.5 w-3.5" /> },
  ];


  return (
    <main className="mx-auto max-w-[1400px] px-3 sm:px-6 py-6 sm:py-8 lg:py-10 space-y-5 print:py-0 print:px-0">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 print:hidden">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Relatórios</div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl mt-1">Análise completa</h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            {range.label} · {range.from.toLocaleDateString("pt-BR")} → {new Date(range.to.getTime() - 1).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-[11px] uppercase tracking-wider text-text-secondary hover:text-text-primary"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </button>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-[11px] uppercase tracking-wider text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
        </div>
      </header>

      {/* Filtros globais */}
      <section className="rounded-lg gold-border bg-surface p-4 sm:p-5 print:hidden">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gold" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">Filtros</span>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <FieldSelect label="Período" value={periodo} onChange={(v) => setPeriodo(v as PeriodoQuick)} options={[
            ["hoje", "Hoje"], ["semana", "Semana"], ["mes", "Mês"], ["trimestre", "Trimestre"],
            ["semestre", "Semestre"], ["ano", "Ano"], ["personalizado", "Personalizado"],
          ]} />
          {periodo === "personalizado" && (
            <>
              <FieldDate label="De" value={customFrom} onChange={setCustomFrom} />
              <FieldDate label="Até" value={customTo} onChange={setCustomTo} />
            </>
          )}
          {isAdminOrMaster && (
            <>
              <FieldSelect label="Vendedor" value={vendedorFiltro} onChange={setVendedorFiltro} options={[
                ["todos", "Todos"],
                ...vendedoresList.map((v) => [v.id, v.nome_completo] as [string, string]),
              ]} />
              <FieldSelect label="Tipo" value={tipoFiltro} onChange={(v) => setTipoFiltro(v as TipoVendFiltro)} options={[
                ["todos", "Todos"], ["interno", "Interno"], ["rep", "Representante"],
              ]} />
            </>
          )}
        </div>
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border print:hidden">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "inline-flex items-center gap-1.5 px-4 py-2.5 text-[11px] uppercase tracking-wider border-b-2 transition " +
              (tab === t.key
                ? "border-gold text-gold"
                : "border-transparent text-text-secondary hover:text-text-primary")
            }
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loadingOrders && (
        <div className="rounded-lg gold-border bg-surface p-8 text-center text-sm text-text-muted">
          Carregando dados...
        </div>
      )}

      {!loadingOrders && tab === "geral" && (
        <TabGeral orders={orders} ordersPrev={ordersPrev} range={range} />
      )}
      {!loadingOrders && tab === "produto" && (
        <TabProduto orders={orders} items={items} loadingItems={loadingItems} range={range} />
      )}
      {!loadingOrders && tab === "colecao" && (
        <TabColecao items={items} loadingItems={loadingItems} range={range} />
      )}
      {!loadingOrders && tab === "grupo" && (
        <TabGrupo items={items} loadingItems={loadingItems} range={range} />
      )}
      {!loadingOrders && tab === "tipo" && (
        <TabTipo items={items} loadingItems={loadingItems} range={range} />
      )}
      {!loadingOrders && tab === "departamento" && (
        <TabDepartamento items={items} ordersPrev={ordersPrev} loadingItems={loadingItems} range={range} />
      )}
      {!loadingOrders && tab === "cliente" && (
        <TabCliente orders={orders} ordersPrev={ordersPrev} items={items} range={range} />
      )}
      {!loadingOrders && tab === "financeiro" && (
        <TabFinanceiro orders={orders} range={range} />
      )}
    </main>
  );
}


// ────────────────────────────────────────────────────────────────────────────
// Field components
// ────────────────────────────────────────────────────────────────────────────

function FieldSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-wider text-text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-gold min-w-[140px]"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function FieldDate({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-wider text-text-muted">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-gold"
      />
    </label>
  );
}

function ExportBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-surface-2 px-3 py-2 text-[11px] uppercase tracking-wider text-gold hover:bg-gold/10 print:hidden"
    >
      <Download className="h-3.5 w-3.5" /> Exportar CSV
    </button>
  );
}

function Card({ children, title, action }: { children: React.ReactNode; title?: string; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg gold-border bg-surface overflow-hidden">
      {title && (
        <header className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border bg-surface-2">
          <h2 className="font-display text-base sm:text-lg">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function MiniKpi({ label, value, delta, hint }: { label: string; value: string; delta?: number | null; hint?: string }) {
  return (
    <div className="rounded-lg gold-border bg-surface p-3 sm:p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</div>
      <div className="font-display text-xl sm:text-2xl text-text-primary mt-1 truncate">{value}</div>
      {delta != null && (
        <div className={"text-[11px] mt-1 " + (delta >= 0 ? "text-stock-in" : "text-stock-out")}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% vs ant.
        </div>
      )}
      {hint && <div className="text-[11px] text-text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// TAB: GERAL
// ────────────────────────────────────────────────────────────────────────────

function TabGeral({ orders, ordersPrev, range }: {
  orders: OrderRow[]; ordersPrev: OrderRow[]; range: { from: Date; to: Date; label: string };
}) {
  const agg = useMemo(() => aggGeral(orders), [orders]);
  const aggPrev = useMemo(() => aggGeral(ordersPrev), [ordersPrev]);

  const delta = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);

  const serie = useMemo(() => {
    const dayMs = 86400000;
    const totalDays = Math.min(Math.ceil((range.to.getTime() - range.from.getTime()) / dayMs), 366);
    const buckets = new Map<string, { valor: number; pedidos: number }>();
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(range.from.getTime() + i * dayMs);
      buckets.set(d.toISOString().slice(0, 10), { valor: 0, pedidos: 0 });
    }
    orders.forEach((o) => {
      const k = new Date(o.created_at).toISOString().slice(0, 10);
      const cur = buckets.get(k) ?? { valor: 0, pedidos: 0 };
      cur.valor += Number(o.total || 0); cur.pedidos += 1;
      buckets.set(k, cur);
    });
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({
      label: new Date(date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      valor: Math.round(v.valor), pedidos: v.pedidos,
    }));
  }, [orders, range]);

  const faixas = useMemo(() => {
    const m = new Map<string, { pedidos: number; valor: number }>();
    orders.forEach((o) => {
      const k = o.commercial?.faixaNome ?? "—";
      const c = m.get(k) ?? { pedidos: 0, valor: 0 };
      c.pedidos += 1; c.valor += Number(o.total || 0);
      m.set(k, c);
    });
    return Array.from(m.entries()).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.valor - a.valor);
  }, [orders]);

  const pagamentos = useMemo(() => {
    const m = new Map<string, { pedidos: number; valor: number }>();
    orders.forEach((o) => {
      const k = (o.forma_pagamento ?? "—").split("(")[0].trim();
      const c = m.get(k) ?? { pedidos: 0, valor: 0 };
      c.pedidos += 1; c.valor += Number(o.total || 0);
      m.set(k, c);
    });
    return Array.from(m.entries()).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.valor - a.valor);
  }, [orders]);

  const exportar = () => {
    const rows = [
      { Métrica: "Faturamento bruto", Valor: agg.bruto, "vs Anterior %": delta(agg.bruto, aggPrev.bruto)?.toFixed(1) ?? "" },
      { Métrica: "Descontos aplicados", Valor: agg.descTotal, "vs Anterior %": delta(agg.descTotal, aggPrev.descTotal)?.toFixed(1) ?? "" },
      { Métrica: "Faturamento líquido", Valor: agg.liquido, "vs Anterior %": delta(agg.liquido, aggPrev.liquido)?.toFixed(1) ?? "" },
      { Métrica: "Pedidos", Valor: agg.pedidos, "vs Anterior %": delta(agg.pedidos, aggPrev.pedidos)?.toFixed(1) ?? "" },
      { Métrica: "Ticket médio", Valor: agg.ticket.toFixed(2), "vs Anterior %": delta(agg.ticket, aggPrev.ticket)?.toFixed(1) ?? "" },
      { Métrica: "Unidades", Valor: agg.unidades, "vs Anterior %": delta(agg.unidades, aggPrev.unidades)?.toFixed(1) ?? "" },
      { Métrica: "Desconto médio %", Valor: agg.descMedio.toFixed(2), "vs Anterior %": "" },
    ];
    downloadCSV(`fetely_relatorio_geral_${periodSuffix(range.from)}.csv`, rows);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniKpi label="Faturamento líquido" value={formatBRL(agg.liquido)} delta={delta(agg.liquido, aggPrev.liquido)} />
        <MiniKpi label="Pedidos" value={String(agg.pedidos)} delta={delta(agg.pedidos, aggPrev.pedidos)} />
        <MiniKpi label="Ticket médio" value={formatBRL(agg.ticket)} delta={delta(agg.ticket, aggPrev.ticket)} />
        <MiniKpi label="Unidades vendidas" value={agg.unidades.toLocaleString("pt-BR")} delta={delta(agg.unidades, aggPrev.unidades)} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <MiniKpi label="Desconto médio aplicado" value={`${agg.descMedio.toFixed(1)}%`} />
        <MiniKpi label="SKUs distintos" value={String(agg.skus)} />
        <MiniKpi label="Clientes ativos" value={String(agg.clientes)} />
      </div>

      <Card title="Evolução do faturamento" action={<ExportBtn onClick={exportar} />}>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ top: 12, right: 16, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} minTickGap={24} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} width={56} axisLine={false} tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ stroke: GOLD, strokeOpacity: 0.25, strokeWidth: 1 }}
                formatter={(v: number) => [formatBRL(v), "Faturamento"]}
              />
              {serie.length > 1 && (
                <ReferenceLine
                  y={serie.reduce((s, d) => s + d.valor, 0) / serie.length}
                  stroke="var(--text-muted)"
                  strokeDasharray="3 3"
                  label={{ value: "média", position: "insideTopRight", fill: "var(--text-muted)", fontSize: 10 }}
                />
              )}
              <Area type="monotone" dataKey="valor" stroke={GOLD} strokeWidth={2.5} fill="url(#gFat)"
                activeDot={{ r: 4, fill: GOLD, stroke: "var(--surface)", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Distribuição por faixa comercial">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={faixas} margin={{ top: 24, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="nome" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                  formatter={(v: number, n: string) => n === "valor" ? [formatBRL(v), "Valor"] : [v, "Pedidos"]}
                />
                <Bar dataKey="valor" fill={GOLD} radius={[6, 6, 0, 0]} maxBarSize={56}>
                  <LabelList dataKey="valor" position="top" formatter={(v: number) => fmtCompactBRL(v)}
                    style={{ fill: "var(--text-secondary)", fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Formas de pagamento">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pagamentos} dataKey="valor" nameKey="nome" cx="50%" cy="50%"
                  outerRadius={92} innerRadius={58} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
                  {pagamentos.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatBRL(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Resumo do período">
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-muted">
                <th className="px-3 py-2 text-left font-medium">Métrica</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 text-right font-medium">vs Período anterior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {[
                ["Faturamento bruto", formatBRL(agg.bruto), delta(agg.bruto, aggPrev.bruto)],
                ["Descontos aplicados", formatBRL(agg.descTotal), delta(agg.descTotal, aggPrev.descTotal)],
                ["Faturamento líquido", formatBRL(agg.liquido), delta(agg.liquido, aggPrev.liquido)],
                ["Desconto médio", `${agg.descMedio.toFixed(1)}%`, null],
                ["Pedidos confirmados", String(agg.pedidos), delta(agg.pedidos, aggPrev.pedidos)],
                ["Ticket médio", formatBRL(agg.ticket), delta(agg.ticket, aggPrev.ticket)],
                ["Unidades vendidas", agg.unidades.toLocaleString("pt-BR"), delta(agg.unidades, aggPrev.unidades)],
                ["SKUs distintos", String(agg.skus), null],
                ["Clientes ativos", String(agg.clientes), null],
              ].map(([m, v, d], i) => (
                <tr key={i} className="hover:bg-surface-2/40">
                  <td className="px-3 py-2.5 text-text-primary">{m as string}</td>
                  <td className="px-3 py-2.5 text-right text-text-primary">{v as string}</td>
                  <td className={"px-3 py-2.5 text-right " + (typeof d === "number" ? (d >= 0 ? "text-stock-in" : "text-stock-out") : "text-text-muted")}>
                    {typeof d === "number" ? `${d >= 0 ? "↑" : "↓"} ${Math.abs(d).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function aggGeral(orders: OrderRow[]) {
  const bruto = orders.reduce((s, o) => s + (Number(o.commercial?.bruto) || Number(o.total) || 0), 0);
  const liquido = orders.reduce((s, o) => s + Number(o.total || 0), 0);
  const descTotal = Math.max(0, bruto - liquido);
  const descMedio = bruto > 0 ? (descTotal / bruto) * 100 : 0;
  const pedidos = orders.length;
  const ticket = pedidos > 0 ? liquido / pedidos : 0;
  const unidades = orders.reduce((s, o) => s + (o.total_unidades || 0), 0);
  const skus = new Set<string>();
  orders.forEach((o) => { if (o.total_skus) skus.add(o.id); });
  const skusCount = orders.reduce((s, o) => s + (o.total_skus || 0), 0);
  const clientes = new Set(orders.map((o) => o.cliente_snapshot?.cnpj ?? "—").filter((x) => x !== "—")).size;
  return { bruto, liquido, descTotal, descMedio, pedidos, ticket, unidades, skus: skusCount, clientes };
}

// ────────────────────────────────────────────────────────────────────────────
// TAB: PRODUTO
// ────────────────────────────────────────────────────────────────────────────

function TabProduto({ orders, items, loadingItems, range }: {
  orders: OrderRow[]; items: ItemRow[]; loadingItems: boolean; range: { from: Date; to: Date };
}) {
  const [top, setTop] = useState<10 | 25 | 50 | 0>(25);
  const [sortBy, setSortBy] = useState<"valor" | "qtd">("valor");

  const totalFat = items.reduce((s, i) => s + Number(i.subtotal_bruto || 0), 0);

  const produtos = useMemo(() => {
    const m = new Map<string, {
      sku: string; nome: string; colecao: string; grupo: string; cor: string; tamanho: string;
      qtd: number; pedidos: Set<string>; precoUnit: number; bruto: number;
    }>();
    items.forEach((it) => {
      const ps = it.product_snapshot ?? {};
      const cur = m.get(it.sku) ?? {
        sku: it.sku,
        nome: ps.nomeComercial ?? it.sku,
        colecao: ps.colecao ?? "—",
        grupo: ps.grupo ?? "—",
        cor: ps.corNome ?? "—",
        tamanho: ps.tamanhoNumero ?? "—",
        qtd: 0, pedidos: new Set<string>(), precoUnit: Number(ps.precoAtacado) || 0, bruto: 0,
      };
      cur.qtd += Number(it.quantity || 0);
      cur.bruto += Number(it.subtotal_bruto || 0);
      cur.pedidos.add(it.orders.id);
      m.set(it.sku, cur);
    });
    const arr = Array.from(m.values()).map((r) => ({
      ...r,
      nPedidos: r.pedidos.size,
      pctTotal: totalFat > 0 ? (r.bruto / totalFat) * 100 : 0,
    }));
    arr.sort((a, b) => sortBy === "valor" ? b.bruto - a.bruto : b.qtd - a.qtd);
    return arr;
  }, [items, sortBy, totalFat]);

  const visiveis = top === 0 ? produtos : produtos.slice(0, top);

  const top20 = produtos.slice(0, 20).map((p) => ({ nome: p.nome.slice(0, 24), valor: Math.round(p.bruto) }));

  const grupos = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((it) => {
      const g = it.product_snapshot?.grupo ?? "—";
      m.set(g, (m.get(g) ?? 0) + Number(it.subtotal_bruto || 0));
    });
    return Array.from(m.entries()).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  }, [items]);

  const exportar = () => {
    downloadCSV(`fetely_relatorio_produtos_${periodSuffix(range.from)}.csv`, produtos.map((p, i) => ({
      "#": i + 1,
      Produto: p.nome, SKU: p.sku, Coleção: p.colecao, Grupo: p.grupo, Cor: p.cor, Tamanho: p.tamanho,
      "Qtd Vendida": p.qtd, "Nº Pedidos": p.nPedidos, "Preço Atacado": p.precoUnit.toFixed(2),
      "Fat. Bruto": p.bruto.toFixed(2), "% Total": p.pctTotal.toFixed(2),
    })));
  };

  if (loadingItems) {
    return <div className="rounded-lg gold-border bg-surface p-8 text-center text-sm text-text-muted">Carregando itens...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-end">
        <FieldSelect label="Mostrar" value={String(top)} onChange={(v) => setTop(Number(v) as 10 | 25 | 50 | 0)} options={[
          ["10", "Top 10"], ["25", "Top 25"], ["50", "Top 50"], ["0", "Todos"],
        ]} />
        <FieldSelect label="Ordenar por" value={sortBy} onChange={(v) => setSortBy(v as "valor" | "qtd")} options={[
          ["valor", "Faturamento"], ["qtd", "Quantidade"],
        ]} />
        <div className="ml-auto"><ExportBtn onClick={exportar} /></div>
      </div>

      <Card title={`Top 20 produtos por faturamento (${orders.length} pedidos)`}>
        <div className="h-[460px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top20} layout="vertical" margin={{ top: 8, right: 72, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="gBarH" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <YAxis type="category" dataKey="nome" tick={AXIS_TICK} axisLine={false} tickLine={false} width={180} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                formatter={(v: number) => formatBRL(v)} />
              <Bar dataKey="valor" fill="url(#gBarH)" radius={[0, 6, 6, 0]} maxBarSize={18}>
                <LabelList dataKey="valor" position="right" formatter={(v: number) => fmtCompactBRL(v)}
                  style={{ fill: "var(--text-secondary)", fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>


      <Card title={`Detalhe de produtos (${produtos.length} SKUs)`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-muted">
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Produto</th>
                <th className="px-2 py-2 text-left">SKU</th>
                <th className="px-2 py-2 text-left">Coleção</th>
                <th className="px-2 py-2 text-right">Qtd</th>
                <th className="px-2 py-2 text-right">Pedidos</th>
                <th className="px-2 py-2 text-right">Preço un.</th>
                <th className="px-2 py-2 text-right">Fat. bruto</th>
                <th className="px-2 py-2 text-right">% Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {visiveis.map((p, i) => (
                <tr key={p.sku} className="hover:bg-surface-2/40">
                  <td className="px-2 py-2 text-text-muted">{i + 1}</td>
                  <td className="px-2 py-2 text-text-primary">{p.nome}</td>
                  <td className="px-2 py-2 text-text-secondary font-mono">{p.sku}</td>
                  <td className="px-2 py-2 text-text-secondary">{p.colecao}</td>
                  <td className="px-2 py-2 text-right">{p.qtd}</td>
                  <td className="px-2 py-2 text-right text-text-secondary">{p.nPedidos}</td>
                  <td className="px-2 py-2 text-right text-text-secondary">{formatBRL(p.precoUnit)}</td>
                  <td className="px-2 py-2 text-right text-gold font-medium">{formatBRL(p.bruto)}</td>
                  <td className="px-2 py-2 text-right text-text-secondary">{p.pctTotal.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {produtos.length === 0 && <div className="text-center text-sm text-text-muted py-6">Nenhum item no período.</div>}
        </div>
      </Card>

      <Card title="Distribuição por grupo de produto">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={grupos} dataKey="valor" nameKey="nome" cx="50%" cy="50%"
                outerRadius={108} innerRadius={64} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
                {grupos.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatBRL(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// TAB: COLEÇÃO
// ────────────────────────────────────────────────────────────────────────────

function TabColecao({ items, loadingItems, range }: {
  items: ItemRow[]; loadingItems: boolean; range: { from: Date; to: Date };
}) {
  const totalFat = items.reduce((s, i) => s + Number(i.subtotal_bruto || 0), 0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const colecoes = useMemo(() => {
    const m = new Map<string, { nome: string; categoria: string; pedidos: Set<string>; qtd: number; bruto: number; produtos: Map<string, { nome: string; qtd: number; bruto: number }> }>();
    items.forEach((it) => {
      const c = it.product_snapshot?.colecao ?? "—";
      const cat = it.product_snapshot?.categoria ?? "—";
      const cur = m.get(c) ?? { nome: c, categoria: cat, pedidos: new Set(), qtd: 0, bruto: 0, produtos: new Map() };
      cur.qtd += Number(it.quantity || 0);
      cur.bruto += Number(it.subtotal_bruto || 0);
      cur.pedidos.add(it.orders.id);
      const pNome = it.product_snapshot?.nomeComercial ?? it.sku;
      const p = cur.produtos.get(it.sku) ?? { nome: pNome, qtd: 0, bruto: 0 };
      p.qtd += Number(it.quantity || 0); p.bruto += Number(it.subtotal_bruto || 0);
      cur.produtos.set(it.sku, p);
      m.set(c, cur);
    });
    return Array.from(m.values()).map((r) => ({
      ...r,
      nPedidos: r.pedidos.size,
      pctTotal: totalFat > 0 ? (r.bruto / totalFat) * 100 : 0,
      produtosArr: Array.from(r.produtos.entries()).map(([sku, p]) => ({ sku, ...p })).sort((a, b) => b.bruto - a.bruto),
    })).sort((a, b) => b.bruto - a.bruto);
  }, [items, totalFat]);

  const top15 = colecoes.slice(0, 15).map((c) => ({ nome: c.nome, valor: Math.round(c.bruto) }));

  const exportar = () => {
    downloadCSV(`fetely_relatorio_colecoes_${periodSuffix(range.from)}.csv`, colecoes.map((c) => ({
      Coleção: c.nome, Categoria: c.categoria, Pedidos: c.nPedidos, Unidades: c.qtd,
      "Fat. Bruto": c.bruto.toFixed(2), "% Total": c.pctTotal.toFixed(2),
    })));
  };

  if (loadingItems) {
    return <div className="rounded-lg gold-border bg-surface p-8 text-center text-sm text-text-muted">Carregando itens...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end"><ExportBtn onClick={exportar} /></div>

      <Card title="Ranking de coleções por faturamento">
        <div className="h-[460px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top15} layout="vertical" margin={{ top: 8, right: 72, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <YAxis type="category" dataKey="nome" tick={AXIS_TICK} axisLine={false} tickLine={false} width={160} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                formatter={(v: number) => formatBRL(v)} />
              <Bar dataKey="valor" fill="url(#gBarH)" radius={[0, 6, 6, 0]} maxBarSize={20}>
                <LabelList dataKey="valor" position="right" formatter={(v: number) => fmtCompactBRL(v)}
                  style={{ fill: "var(--text-secondary)", fontSize: 10 }} />
              </Bar>
              <defs>
                <linearGradient id="gBarH" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={1} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>


      <Card title={`Detalhe por coleção (${colecoes.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-muted">
                <th className="px-2 py-2 text-left">Coleção</th>
                <th className="px-2 py-2 text-left">Categoria</th>
                <th className="px-2 py-2 text-right">Pedidos</th>
                <th className="px-2 py-2 text-right">Unidades</th>
                <th className="px-2 py-2 text-right">Fat. bruto</th>
                <th className="px-2 py-2 text-right">% Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {colecoes.map((c) => (
                <Fragment key={c.nome}>
                  <tr onClick={() => setExpanded(expanded === c.nome ? null : c.nome)}
                    className="hover:bg-surface-2/40 cursor-pointer">
                    <td className="px-2 py-2.5 text-text-primary">
                      <span className="inline-block w-3 text-gold">{expanded === c.nome ? "▾" : "▸"}</span>{c.nome}
                    </td>
                    <td className="px-2 py-2.5 text-text-secondary">{c.categoria}</td>
                    <td className="px-2 py-2.5 text-right">{c.nPedidos}</td>
                    <td className="px-2 py-2.5 text-right">{c.qtd}</td>
                    <td className="px-2 py-2.5 text-right text-gold font-medium">{formatBRL(c.bruto)}</td>
                    <td className="px-2 py-2.5 text-right text-text-secondary">{c.pctTotal.toFixed(1)}%</td>
                  </tr>
                  {expanded === c.nome && c.produtosArr.map((p) => (
                    <tr key={p.sku} className="bg-surface-2/30">
                      <td className="px-6 py-1.5 text-text-secondary" colSpan={2}>↳ {p.nome} <span className="text-text-muted">({p.sku})</span></td>
                      <td className="px-2 py-1.5"></td>
                      <td className="px-2 py-1.5 text-right text-text-secondary">{p.qtd}</td>
                      <td className="px-2 py-1.5 text-right text-text-secondary">{formatBRL(p.bruto)}</td>
                      <td className="px-2 py-1.5"></td>
                    </tr>
                  ))}
                </Fragment>
              ))}

            </tbody>
          </table>
          {colecoes.length === 0 && <div className="text-center text-sm text-text-muted py-6">Nenhuma coleção no período.</div>}
        </div>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// TAB: FINANCEIRO
// ────────────────────────────────────────────────────────────────────────────

function TabFinanceiro({ orders, range }: { orders: OrderRow[]; range: { from: Date; to: Date; label: string } }) {
  const fin = useMemo(() => {
    let bruto = 0, liquido = 0, descCelebra = 0, descMaster = 0, bonusPix = 0;
    orders.forEach((o) => {
      const c = o.commercial ?? {};
      bruto += Number(c.bruto) || Number(o.total) || 0;
      liquido += Number(o.total) || 0;
      descCelebra += Number(c.descontoCelebraValor) || 0;
      descMaster += Number(c.descontoMasterValor) || 0;
      bonusPix += Number(c.bonusPixValor) || 0;
    });
    const descTotal = descCelebra + descMaster + bonusPix;
    return { bruto, liquido, descCelebra, descMaster, bonusPix, descTotal, descPct: bruto > 0 ? (descTotal / bruto) * 100 : 0 };
  }, [orders]);

  const condicoes = useMemo(() => {
    const m = new Map<string, { pedidos: number; valor: number }>();
    orders.forEach((o) => {
      const k = o.commercial?.condicaoDescricao ?? o.forma_pagamento ?? "—";
      const c = m.get(k) ?? { pedidos: 0, valor: 0 };
      c.pedidos += 1; c.valor += Number(o.total || 0);
      m.set(k, c);
    });
    return Array.from(m.entries()).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.valor - a.valor);
  }, [orders]);

  const fretes = useMemo(() => {
    let cif = { n: 0, valor: 0 }, fob = { n: 0, valor: 0 };
    orders.forEach((o) => {
      const f = (o.frete ?? o.commercial?.frete ?? "").toUpperCase();
      const v = Number(o.total || 0);
      if (f === "CIF") { cif.n += 1; cif.valor += v; }
      else if (f === "FOB") { fob.n += 1; fob.valor += v; }
    });
    return { cif, fob };
  }, [orders]);

  const totalFrete = fretes.cif.valor + fretes.fob.valor;

  const serieDesconto = useMemo(() => {
    const m = new Map<string, { bruto: number; liquido: number }>();
    orders.forEach((o) => {
      const k = new Date(o.created_at).toISOString().slice(0, 10);
      const c = m.get(k) ?? { bruto: 0, liquido: 0 };
      c.bruto += Number(o.commercial?.bruto) || Number(o.total) || 0;
      c.liquido += Number(o.total) || 0;
      m.set(k, c);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({
      label: new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      descPct: v.bruto > 0 ? Number((((v.bruto - v.liquido) / v.bruto) * 100).toFixed(2)) : 0,
    }));
  }, [orders]);

  const exportar = () => {
    downloadCSV(`fetely_relatorio_financeiro_${periodSuffix(range.from)}.csv`, [
      { Item: "Receita bruta", Valor: fin.bruto.toFixed(2) },
      { Item: "Desconto Celebra", Valor: (-fin.descCelebra).toFixed(2) },
      { Item: "Desconto Master / negociação", Valor: (-fin.descMaster).toFixed(2) },
      { Item: "Bônus PIX", Valor: (-fin.bonusPix).toFixed(2) },
      { Item: "Receita líquida", Valor: fin.liquido.toFixed(2) },
      { Item: "Desconto %", Valor: fin.descPct.toFixed(2) },
    ]);
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end"><ExportBtn onClick={exportar} /></div>

      <Card title={`Demonstrativo do período — ${range.label}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border/40">
              <tr><td className="px-3 py-2.5 text-text-primary">Receita bruta (preço atacado)</td>
                <td className="px-3 py-2.5 text-right text-text-primary">{formatBRL(fin.bruto)}</td></tr>
              <tr><td className="px-3 py-2.5 text-text-secondary pl-6">(−) Desconto Celebra</td>
                <td className="px-3 py-2.5 text-right text-stock-out">− {formatBRL(fin.descCelebra)}</td></tr>
              <tr><td className="px-3 py-2.5 text-text-secondary pl-6">(−) Desconto Master / negociação</td>
                <td className="px-3 py-2.5 text-right text-stock-out">− {formatBRL(fin.descMaster)}</td></tr>
              <tr><td className="px-3 py-2.5 text-text-secondary pl-6">(−) Bônus PIX</td>
                <td className="px-3 py-2.5 text-right text-stock-out">− {formatBRL(fin.bonusPix)}</td></tr>
              <tr className="bg-surface-2/40"><td className="px-3 py-3 text-gold font-medium">Receita líquida</td>
                <td className="px-3 py-3 text-right text-gold font-medium">{formatBRL(fin.liquido)}</td></tr>
              <tr><td className="px-3 py-2 text-text-muted text-xs">Desconto total sobre bruto</td>
                <td className="px-3 py-2 text-right text-text-muted text-xs">{fin.descPct.toFixed(2)}%</td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Breakdown de descontos">
          <div className="space-y-2.5">
            {[
              ["Celebra (faixa)", fin.descCelebra],
              ["Negociação / master", fin.descMaster],
              ["Bônus PIX", fin.bonusPix],
            ].map(([nome, valor], i) => {
              const pct = fin.descTotal > 0 ? ((valor as number) / fin.descTotal) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-secondary">{nome as string}</span>
                    <span className="text-text-primary">{formatBRL(valor as number)} <span className="text-text-muted">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-gold/60 to-gold" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Frete">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-secondary">CIF (Fetély paga)</span>
                <span className="text-text-primary">{fretes.cif.n} pedidos · {formatBRL(fretes.cif.valor)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-gold/60 to-gold"
                  style={{ width: `${totalFrete > 0 ? (fretes.cif.valor / totalFrete) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-secondary">FOB (lojista paga)</span>
                <span className="text-text-primary">{fretes.fob.n} pedidos · {formatBRL(fretes.fob.valor)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-gold/60 to-gold"
                  style={{ width: `${totalFrete > 0 ? (fretes.fob.valor / totalFrete) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Pedidos por condição de pagamento">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-muted">
                <th className="px-2 py-2 text-left">Condição</th>
                <th className="px-2 py-2 text-right">Pedidos</th>
                <th className="px-2 py-2 text-right">Valor</th>
                <th className="px-2 py-2 text-right">% Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {condicoes.map((c) => (
                <tr key={c.nome} className="hover:bg-surface-2/40">
                  <td className="px-2 py-2 text-text-primary">{c.nome}</td>
                  <td className="px-2 py-2 text-right">{c.pedidos}</td>
                  <td className="px-2 py-2 text-right text-gold">{formatBRL(c.valor)}</td>
                  <td className="px-2 py-2 text-right text-text-secondary">{fin.liquido > 0 ? ((c.valor / fin.liquido) * 100).toFixed(1) : "0.0"}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Evolução do desconto médio (%)">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serieDesconto} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 10 }} minTickGap={24} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`${v}%`, "Desconto"]}
              />
              <Area type="monotone" dataKey="descPct" stroke={GOLD} strokeWidth={2} fill={GOLD} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers compartilhados (Grupo / Tipo / Departamento)
// ────────────────────────────────────────────────────────────────────────────

function aggregateBy(
  items: ItemRow[],
  keyFn: (it: ItemRow) => string,
) {
  const m = new Map<string, { nome: string; pedidos: Set<string>; qtd: number; bruto: number }>();
  items.forEach((it) => {
    const k = keyFn(it) || "—";
    const cur = m.get(k) ?? { nome: k, pedidos: new Set<string>(), qtd: 0, bruto: 0 };
    cur.qtd += Number(it.quantity || 0);
    cur.bruto += Number(it.subtotal_bruto || 0);
    cur.pedidos.add(it.orders.id);
    m.set(k, cur);
  });
  return Array.from(m.values()).map((r) => ({
    nome: r.nome,
    pedidos: r.pedidos.size,
    qtd: r.qtd,
    bruto: r.bruto,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// TAB: GRUPO
// ────────────────────────────────────────────────────────────────────────────

function TabGrupo({ items, loadingItems, range }: {
  items: ItemRow[]; loadingItems: boolean; range: { from: Date; to: Date };
}) {
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroColecao, setFiltroColecao] = useState("todas");
  const [expanded, setExpanded] = useState<string | null>(null);

  const categorias = useMemo(() => Array.from(new Set(items.map((it) => it.product_snapshot?.categoria ?? "—"))).sort(), [items]);
  const colecoes = useMemo(() => Array.from(new Set(items.map((it) => it.product_snapshot?.colecao ?? "—"))).sort(), [items]);

  const itemsFiltrados = useMemo(() => items.filter((it) => {
    if (filtroCategoria !== "todas" && (it.product_snapshot?.categoria ?? "—") !== filtroCategoria) return false;
    if (filtroColecao !== "todas" && (it.product_snapshot?.colecao ?? "—") !== filtroColecao) return false;
    return true;
  }), [items, filtroCategoria, filtroColecao]);

  const totalFat = itemsFiltrados.reduce((s, i) => s + Number(i.subtotal_bruto || 0), 0);

  const grupos = useMemo(() => {
    const base = aggregateBy(itemsFiltrados, (it) => it.product_snapshot?.grupo ?? "—");
    return base.map((g) => {
      const colByGrupo = aggregateBy(
        itemsFiltrados.filter((it) => (it.product_snapshot?.grupo ?? "—") === g.nome),
        (it) => it.product_snapshot?.colecao ?? "—",
      ).sort((a, b) => b.bruto - a.bruto);
      return {
        ...g,
        pctTotal: totalFat > 0 ? (g.bruto / totalFat) * 100 : 0,
        ticket: g.pedidos > 0 ? g.bruto / g.pedidos : 0,
        colecoes: colByGrupo,
      };
    }).sort((a, b) => b.bruto - a.bruto);
  }, [itemsFiltrados, totalFat]);

  const evolucao = useMemo(() => {
    const byDay = new Map<string, Record<string, number>>();
    const topGrupos = grupos.slice(0, 6).map((g) => g.nome);
    itemsFiltrados.forEach((it) => {
      const g = it.product_snapshot?.grupo ?? "—";
      if (!topGrupos.includes(g)) return;
      const k = new Date(it.orders.created_at).toISOString().slice(0, 10);
      const cur = byDay.get(k) ?? {};
      cur[g] = (cur[g] ?? 0) + Number(it.subtotal_bruto || 0);
      byDay.set(k, cur);
    });
    return Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({
      label: new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      ...topGrupos.reduce((acc, g) => ({ ...acc, [g]: Math.round(v[g] ?? 0) }), {}),
    }));
  }, [itemsFiltrados, grupos]);

  const topGrupos6 = grupos.slice(0, 6).map((g) => g.nome);

  // Matriz Grupo × Coleção
  const matriz = useMemo(() => {
    const topG = grupos.slice(0, 8).map((g) => g.nome);
    const colTotals = aggregateBy(itemsFiltrados, (it) => it.product_snapshot?.colecao ?? "—")
      .sort((a, b) => b.bruto - a.bruto).slice(0, 10);
    const topC = colTotals.map((c) => c.nome);
    const data: Array<{ grupo: string; cells: Array<{ colecao: string; valor: number }> }> = [];
    let max = 0;
    topG.forEach((g) => {
      const row = topC.map((c) => {
        const v = itemsFiltrados
          .filter((it) => (it.product_snapshot?.grupo ?? "—") === g && (it.product_snapshot?.colecao ?? "—") === c)
          .reduce((s, it) => s + Number(it.subtotal_bruto || 0), 0);
        if (v > max) max = v;
        return { colecao: c, valor: v };
      });
      data.push({ grupo: g, cells: row });
    });
    return { grupos: topG, colecoes: topC, data, max };
  }, [itemsFiltrados, grupos]);

  // Insight automático
  const insight = useMemo(() => {
    if (!grupos.length) return null;
    const top = grupos[0];
    if (top.pctTotal > 70) return `💡 ${top.nome} domina ${top.pctTotal.toFixed(0)}% do faturamento — considere diversificar o mix.`;
    const totalQtd = grupos.reduce((s, g) => s + g.qtd, 0);
    const qtdPct = totalQtd > 0 ? (top.qtd / totalQtd) * 100 : 0;
    if (Math.abs(qtdPct - top.pctTotal) > 10) {
      return `💡 ${top.nome} representa ${top.pctTotal.toFixed(0)}% do faturamento mas ${qtdPct.toFixed(0)}% das unidades — ticket médio ${qtdPct > top.pctTotal ? "abaixo" : "acima"} da média geral.`;
    }
    return null;
  }, [grupos]);

  const exportar = () => {
    downloadCSV(`fetely_relatorio_grupos_${periodSuffix(range.from)}.csv`, grupos.map((g) => ({
      grupo: g.nome, pedidos: g.pedidos, unidades: g.qtd,
      fat_bruto: g.bruto.toFixed(2), pct_total: g.pctTotal.toFixed(2),
      ticket_medio: g.ticket.toFixed(2),
    })));
  };

  if (loadingItems) {
    return <div className="rounded-lg gold-border bg-surface p-8 text-center text-sm text-text-muted">Carregando itens...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-end">
        <FieldSelect label="Categoria" value={filtroCategoria} onChange={setFiltroCategoria} options={[
          ["todas", "Todas"], ...categorias.map((c) => [c, c] as [string, string]),
        ]} />
        <FieldSelect label="Coleção" value={filtroColecao} onChange={setFiltroColecao} options={[
          ["todas", "Todas"], ...colecoes.map((c) => [c, c] as [string, string]),
        ]} />
        <div className="ml-auto"><ExportBtn onClick={exportar} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Participação por grupo">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={grupos} dataKey="bruto" nameKey="nome" cx="50%" cy="50%" outerRadius={100} innerRadius={55}>
                  {grupos.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatBRL(v)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Evolução por grupo (top 6)">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolucao} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} stackOffset="none">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 10 }} minTickGap={24} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} width={56}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatBRL(v)}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {topGrupos6.map((g, i) => (
                  <Area key={g} type="monotone" dataKey={g} stackId="1"
                    stroke={PIE_COLORS[i % PIE_COLORS.length]} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.6} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title={`Detalhe por grupo (${grupos.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-zinc-100">
                <th className="px-2 py-2 text-left">Grupo</th>
                <th className="px-2 py-2 text-right">Pedidos</th>
                <th className="px-2 py-2 text-right">Unidades</th>
                <th className="px-2 py-2 text-right">Fat. bruto</th>
                <th className="px-2 py-2 text-right">% Total</th>
                <th className="px-2 py-2 text-right">Ticket médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {grupos.map((g) => (
                <Fragment key={g.nome}>
                  <tr onClick={() => setExpanded(expanded === g.nome ? null : g.nome)}
                    className="hover:bg-surface-2/40 cursor-pointer">
                    <td className="px-2 py-2.5 text-text-primary">
                      <span className="inline-block w-3 text-gold">{expanded === g.nome ? "▾" : "▸"}</span>{g.nome}
                    </td>
                    <td className="px-2 py-2.5 text-right">{g.pedidos}</td>
                    <td className="px-2 py-2.5 text-right">{g.qtd}</td>
                    <td className="px-2 py-2.5 text-right text-gold font-medium">{formatBRL(g.bruto)}</td>
                    <td className="px-2 py-2.5 text-right text-text-secondary">{g.pctTotal.toFixed(1)}%</td>
                    <td className="px-2 py-2.5 text-right text-text-secondary">{formatBRL(g.ticket)}</td>
                  </tr>
                  {expanded === g.nome && g.colecoes.map((c) => (
                    <tr key={c.nome} className="bg-surface-2/30">
                      <td className="px-6 py-1.5 text-text-secondary">↳ {c.nome}</td>
                      <td className="px-2 py-1.5 text-right text-text-secondary">{c.pedidos}</td>
                      <td className="px-2 py-1.5 text-right text-text-secondary">{c.qtd}</td>
                      <td className="px-2 py-1.5 text-right text-text-secondary">{formatBRL(c.bruto)}</td>
                      <td className="px-2 py-1.5"></td>
                      <td className="px-2 py-1.5"></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          {grupos.length === 0 && <div className="text-center text-sm text-text-muted py-6">Nenhum item no período.</div>}
        </div>
      </Card>

      {insight && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-text-primary">
          {insight}
        </div>
      )}

      <Card title="Cruzamento Grupo × Coleção">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-zinc-100">
                <th className="px-2 py-2 text-left sticky left-0 bg-surface">Grupo \ Coleção</th>
                {matriz.colecoes.map((c) => (
                  <th key={c} className="px-2 py-2 text-right font-medium whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matriz.data.map((row) => (
                <tr key={row.grupo} className="border-t border-border/40">
                  <td className="px-2 py-2 text-text-primary sticky left-0 bg-surface font-medium">{row.grupo}</td>
                  {row.cells.map((cell) => {
                    const opacity = matriz.max > 0 ? cell.valor / matriz.max : 0;
                    return (
                      <td
                        key={cell.colecao}
                        className="px-2 py-2 text-right"
                        style={{
                          backgroundColor: cell.valor > 0 ? `rgba(201,168,76,${opacity * 0.55})` : "rgba(40,40,40,0.3)",
                          color: opacity > 0.4 ? "#fff" : "var(--text-secondary)",
                        }}
                      >
                        {cell.valor > 0 ? formatBRL(cell.valor) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// TAB: TIPO
// ────────────────────────────────────────────────────────────────────────────

function TabTipo({ items, loadingItems, range }: {
  items: ItemRow[]; loadingItems: boolean; range: { from: Date; to: Date };
}) {
  // Pré-selecionar grupo com maior faturamento
  const gruposDisponiveis = useMemo(() => {
    return aggregateBy(items, (it) => it.product_snapshot?.grupo ?? "—")
      .sort((a, b) => b.bruto - a.bruto)
      .map((g) => g.nome);
  }, [items]);

  const [filtroGrupo, setFiltroGrupo] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroColecao, setFiltroColecao] = useState("todas");
  const [expandedTipos, setExpandedTipos] = useState<Set<string>>(new Set());
  const [expandedColecoes, setExpandedColecoes] = useState<Set<string>>(new Set());
  const [expandedCores, setExpandedCores] = useState<Set<string>>(new Set());
  const [expandedNumeros, setExpandedNumeros] = useState<Set<string>>(new Set());
  const makeToggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (k: string) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });
  const toggleTipo = makeToggle(setExpandedTipos);
  const toggleColecao = makeToggle(setExpandedColecoes);
  const toggleCor = makeToggle(setExpandedCores);
  const toggleNumero = makeToggle(setExpandedNumeros);

  useEffect(() => {
    if (filtroGrupo === "todos" && gruposDisponiveis.length > 0) {
      setFiltroGrupo(gruposDisponiveis[0]);
    }
  }, [gruposDisponiveis, filtroGrupo]);

  const categorias = useMemo(() => Array.from(new Set(items.map((it) => it.product_snapshot?.categoria ?? "—"))).sort(), [items]);
  const colecoes = useMemo(() => Array.from(new Set(items.map((it) => it.product_snapshot?.colecao ?? "—"))).sort(), [items]);

  const itemsFiltrados = useMemo(() => items.filter((it) => {
    if (filtroGrupo !== "todos" && (it.product_snapshot?.grupo ?? "—") !== filtroGrupo) return false;
    if (filtroCategoria !== "todas" && (it.product_snapshot?.categoria ?? "—") !== filtroCategoria) return false;
    if (filtroColecao !== "todas" && (it.product_snapshot?.colecao ?? "—") !== filtroColecao) return false;
    return true;
  }), [items, filtroGrupo, filtroCategoria, filtroColecao]);

  const totalGrupoFat = itemsFiltrados.reduce((s, i) => s + Number(i.subtotal_bruto || 0), 0);

  const tipos = useMemo(() => {
    const m = new Map<string, {
      tipo: string; grupo: string; pedidos: Set<string>; qtd: number; bruto: number;
      precoMin: number; precoMax: number;
    }>();
    itemsFiltrados.forEach((it) => {
      const t = it.product_snapshot?.tipo ?? "—";
      const g = it.product_snapshot?.grupo ?? "—";
      const key = `${g}||${t}`;
      const preco = Number(it.product_snapshot?.precoAtacado) || 0;
      const cur = m.get(key) ?? {
        tipo: t, grupo: g, pedidos: new Set<string>(), qtd: 0, bruto: 0,
        precoMin: preco || Infinity, precoMax: preco,
      };
      cur.qtd += Number(it.quantity || 0);
      cur.bruto += Number(it.subtotal_bruto || 0);
      cur.pedidos.add(it.orders.id);
      if (preco > 0) {
        cur.precoMin = Math.min(cur.precoMin, preco);
        cur.precoMax = Math.max(cur.precoMax, preco);
      }
      m.set(key, cur);
    });
    return Array.from(m.values()).map((r) => ({
      ...r,
      nPedidos: r.pedidos.size,
      precoMin: r.precoMin === Infinity ? 0 : r.precoMin,
      pctGrupo: totalGrupoFat > 0 ? (r.bruto / totalGrupoFat) * 100 : 0,
    })).sort((a, b) => b.bruto - a.bruto);
  }, [itemsFiltrados, totalGrupoFat]);

  // Mix de tipos por grupo (todos os grupos)
  const mixData = useMemo(() => {
    const byGrupo = new Map<string, Map<string, number>>();
    items.forEach((it) => {
      const g = it.product_snapshot?.grupo ?? "—";
      const t = it.product_snapshot?.tipo ?? "—";
      if (!byGrupo.has(g)) byGrupo.set(g, new Map());
      const tm = byGrupo.get(g)!;
      tm.set(t, (tm.get(t) ?? 0) + Number(it.subtotal_bruto || 0));
    });
    return Array.from(byGrupo.entries()).map(([grupo, tm]) => {
      const total = Array.from(tm.values()).reduce((s, v) => s + v, 0);
      const obj: Record<string, string | number> = { grupo };
      tm.forEach((v, t) => { obj[t] = total > 0 ? Number(((v / total) * 100).toFixed(1)) : 0; });
      return obj;
    });
  }, [items]);

  const allTipos = useMemo(() => Array.from(new Set(items.map((it) => it.product_snapshot?.tipo ?? "—"))), [items]);

  // Insight
  const insight = useMemo(() => {
    if (!tipos.length || filtroGrupo === "todos") return null;
    const top = tipos[0];
    if (top.pctGrupo > 90) return `💡 ${top.tipo} concentra quase todo o volume de ${filtroGrupo} (${top.pctGrupo.toFixed(0)}%).`;
    return null;
  }, [tipos, filtroGrupo]);

  const exportar = () => {
    // Exporta hierarquia completa: Grupo → Tipo → Coleção → Cor → Nº → Produto (SKU)
    const rows: Array<Record<string, string | number>> = [];
    itemsFiltrados.forEach((it) => {
      const grupo = it.product_snapshot?.grupo ?? "—";
      const tipo = it.product_snapshot?.tipo ?? "—";
      const colecao = it.product_snapshot?.colecao ?? "—";
      const isVela = grupo === "Vela";
      const isNumerica = isVela && tipo === "Numérica";
      const cor = isVela ? (it.product_snapshot?.corNome ?? "—") : "";
      const numero = isNumerica ? extractNumero(it) : "";
      const qtd = Number(it.quantity || 0);
      const bruto = Number(it.subtotal_bruto || 0);
      const preco = Number(it.product_snapshot?.precoAtacado) || 0;
      const tipoTotal = tipos.find((tp) => tp.grupo === grupo && tp.tipo === tipo)?.bruto ?? 0;
      rows.push({
        grupo,
        tipo,
        colecao,
        cor,
        numero,
        sku: it.sku,
        produto: it.product_snapshot?.nomeComercial ?? "",
        pedido_id: it.orders.id,
        pedido_data: new Date(it.orders.created_at).toLocaleDateString("pt-BR"),
        unidades: qtd,
        preco_unit: preco.toFixed(2),
        fat_liquido: bruto.toFixed(2),
        pct_do_tipo: tipoTotal > 0 ? ((bruto / tipoTotal) * 100).toFixed(2) : "0.00",
        pct_do_grupo: totalGrupoFat > 0 ? ((bruto / totalGrupoFat) * 100).toFixed(2) : "0.00",
      });
    });
    downloadCSV(`fetely_relatorio_tipos_completo_${periodSuffix(range.from)}.csv`, rows);
  };

  if (loadingItems) {
    return <div className="rounded-lg gold-border bg-surface p-8 text-center text-sm text-text-muted">Carregando itens...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-end">
        <FieldSelect label="Grupo" value={filtroGrupo} onChange={setFiltroGrupo} options={[
          ["todos", "Todos"], ...gruposDisponiveis.map((g) => [g, g] as [string, string]),
        ]} />
        <FieldSelect label="Categoria" value={filtroCategoria} onChange={setFiltroCategoria} options={[
          ["todas", "Todas"], ...categorias.map((c) => [c, c] as [string, string]),
        ]} />
        <FieldSelect label="Coleção" value={filtroColecao} onChange={setFiltroColecao} options={[
          ["todas", "Todas"], ...colecoes.map((c) => [c, c] as [string, string]),
        ]} />
        <div className="ml-auto"><ExportBtn onClick={exportar} /></div>
      </div>

      <Card title={`Ranking de tipos${filtroGrupo !== "todos" ? ` em ${filtroGrupo}` : ""}`}>
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tipos.slice(0, 15).map((t) => ({ nome: t.tipo, valor: Math.round(t.bruto) }))}
              layout="vertical" margin={{ top: 8, right: 32, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <YAxis type="category" dataKey="nome" tick={{ fill: "var(--text-muted)", fontSize: 10 }} width={140} />
              <Tooltip
                contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => formatBRL(v)}
              />
              <Bar dataKey="valor" fill={GOLD} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {insight && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-text-primary">
          {insight}
        </div>
      )}

      <Card title={`Detalhe por tipo (${tipos.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-secondary">
                <th className="px-2 py-2 text-left w-6"></th>
                <th className="px-2 py-2 text-left">Tipo</th>
                <th className="px-2 py-2 text-left">Grupo</th>
                <th className="px-2 py-2 text-right">Pedidos</th>
                <th className="px-2 py-2 text-right">Unidades</th>
                <th className="px-2 py-2 text-right">Fat. líquido</th>
                <th className="px-2 py-2 text-right">% Grupo</th>
                <th className="px-2 py-2 text-right">Preço un.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {tipos.map((t) => {
                const key = `${t.grupo}||${t.tipo}`;
                const isOpen = expandedTipos.has(key);
                return (
                  <Fragment key={key}>
                    <tr className="hover:bg-surface-2/40 cursor-pointer" onClick={() => toggleTipo(key)}>
                      <td className="px-2 py-2 text-text-muted">{isOpen ? "▼" : "▶"}</td>
                      <td className="px-2 py-2 text-text-primary">{t.tipo}</td>
                      <td className="px-2 py-2 text-text-secondary">{t.grupo}</td>
                      <td className="px-2 py-2 text-right">{t.nPedidos}</td>
                      <td className="px-2 py-2 text-right">{t.qtd}</td>
                      <td className="px-2 py-2 text-right text-gold font-medium">{formatBRL(t.bruto)}</td>
                      <td className="px-2 py-2 text-right text-text-secondary">{t.pctGrupo.toFixed(1)}%</td>
                      <td className="px-2 py-2 text-right text-text-secondary">
                        {t.precoMin === t.precoMax ? formatBRL(t.precoMin) : `${formatBRL(t.precoMin)} – ${formatBRL(t.precoMax)}`}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-surface-2/30">
                        <td></td>
                        <td colSpan={7} className="px-2 py-3">
                          <TipoBreakdown
                            tipo={t}
                            items={itemsFiltrados.filter((it) =>
                              (it.product_snapshot?.grupo ?? "—") === t.grupo &&
                              (it.product_snapshot?.tipo ?? "—") === t.tipo,
                            )}
                            expandedColecoes={expandedColecoes}
                            expandedCores={expandedCores}
                            expandedNumeros={expandedNumeros}
                            toggleColecao={toggleColecao}
                            toggleCor={toggleCor}
                            toggleNumero={toggleNumero}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {tipos.length === 0 && <div className="text-center text-sm text-text-muted py-6">Nenhum item no período.</div>}
        </div>
      </Card>


      <Card title="Mix de tipos por grupo (% do faturamento)">
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mixData} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 8 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="grupo" tick={{ fill: "var(--text-muted)", fontSize: 10 }} width={130} />
              <Tooltip
                contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => `${v}%`}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {allTipos.map((t, i) => (
                <Bar key={t} dataKey={t} stackId="a" fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// TAB: DEPARTAMENTO
// ────────────────────────────────────────────────────────────────────────────

function TabDepartamento({ items, ordersPrev, loadingItems, range }: {
  items: ItemRow[]; ordersPrev: OrderRow[]; loadingItems: boolean; range: { from: Date; to: Date };
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  const totalFat = items.reduce((s, i) => s + Number(i.subtotal_bruto || 0), 0);

  // Drill-down completo: Departamento → Categoria → Grupo → Tipo
  const arvore = useMemo(() => {
    type No = { nome: string; pedidos: Set<string>; qtd: number; bruto: number; filhos: Map<string, No> };
    const root = new Map<string, No>();
    items.forEach((it) => {
      const dep = it.product_snapshot?.departamento ?? "—";
      const cat = it.product_snapshot?.categoria ?? "—";
      const grp = it.product_snapshot?.grupo ?? "—";
      const tip = it.product_snapshot?.tipo ?? "—";
      const path = [dep, cat, grp, tip];
      let curMap = root;
      path.forEach((n) => {
        const node = curMap.get(n) ?? { nome: n, pedidos: new Set<string>(), qtd: 0, bruto: 0, filhos: new Map() };
        node.qtd += Number(it.quantity || 0);
        node.bruto += Number(it.subtotal_bruto || 0);
        node.pedidos.add(it.orders.id);
        curMap.set(n, node);
        curMap = node.filhos;
      });
    });
    type NoArr = { nome: string; pedidos: number; qtd: number; bruto: number; filhos: NoArr[] };
    const toArr = (m: Map<string, No>): NoArr[] =>
      Array.from(m.values()).map((n) => ({
        nome: n.nome,
        pedidos: n.pedidos.size,
        qtd: n.qtd,
        bruto: n.bruto,
        filhos: toArr(n.filhos),
      })).sort((a, b) => b.bruto - a.bruto);
    return toArr(root);

  }, [items]);

  // Variação vs período anterior por departamento
  // Como ordersPrev não traz items, usamos uma aproximação: % do dept atual
  const departamentos = useMemo(() => arvore.map((d) => ({
    nome: d.nome,
    bruto: d.bruto,
    pctTotal: totalFat > 0 ? (d.bruto / totalFat) * 100 : 0,
  })), [arvore, totalFat]);

  const evolucao = useMemo(() => {
    const byDay = new Map<string, Record<string, number>>();
    const allDeps = departamentos.map((d) => d.nome);
    items.forEach((it) => {
      const dep = it.product_snapshot?.departamento ?? "—";
      const k = new Date(it.orders.created_at).toISOString().slice(0, 10);
      const cur = byDay.get(k) ?? {};
      cur[dep] = (cur[dep] ?? 0) + Number(it.subtotal_bruto || 0);
      byDay.set(k, cur);
    });
    return Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({
      label: new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      ...allDeps.reduce((acc, dep) => ({ ...acc, [dep]: Math.round(v[dep] ?? 0) }), {}),
    }));
  }, [items, departamentos]);

  // Variação aproximada usando ordersPrev total
  const totalPrev = ordersPrev.reduce((s, o) => s + Number(o.total || 0), 0);
  const totalCur = items.reduce((s, it) => s + Number(it.subtotal_bruto || 0), 0);
  const variacaoGeral = totalPrev > 0 ? ((totalCur - totalPrev) / totalPrev) * 100 : null;

  const allDeps = departamentos.map((d) => d.nome);

  const exportar = () => {
    const rows: Array<Record<string, string | number>> = [];
    arvore.forEach((d) => {
      d.filhos.forEach((c) => {
        c.filhos.forEach((g) => {
          g.filhos.forEach((t) => {
            rows.push({
              departamento: d.nome, categoria: c.nome, grupo: g.nome, tipo: t.nome,
              pedidos: t.pedidos, unidades: t.qtd, fat_liquido: t.bruto.toFixed(2),
              pct_total: totalFat > 0 ? ((t.bruto / totalFat) * 100).toFixed(2) : "0.00",
            });
          });
        });
      });
    });
    downloadCSV(`fetely_relatorio_departamentos_${periodSuffix(range.from)}.csv`, rows);
  };

  if (loadingItems) {
    return <div className="rounded-lg gold-border bg-surface p-8 text-center text-sm text-text-muted">Carregando itens...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end"><ExportBtn onClick={exportar} /></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Participação por departamento">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={departamentos} dataKey="bruto" nameKey="nome" cx="50%" cy="50%" outerRadius={110} innerRadius={70}
                  label={(e) => `${e.nome}: ${e.pctTotal.toFixed(0)}%`}>
                  {departamentos.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatBRL(v)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {variacaoGeral != null && (
            <div className="text-center text-xs text-text-muted mt-2">
              Total <span className={variacaoGeral >= 0 ? "text-stock-in" : "text-stock-out"}>
                {variacaoGeral >= 0 ? "↑" : "↓"} {Math.abs(variacaoGeral).toFixed(1)}%
              </span> vs período anterior
            </div>
          )}
        </Card>

        <Card title="Evolução por departamento">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 10 }} minTickGap={24} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} width={56}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatBRL(v)}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {allDeps.map((d, i) => (
                  <Line key={d} type="monotone" dataKey={d} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Drill-down completo (Departamento → Categoria → Grupo → Tipo)">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-zinc-100">
                <th className="px-2 py-2 text-left">Hierarquia</th>
                <th className="px-2 py-2 text-right">Pedidos</th>
                <th className="px-2 py-2 text-right">Unidades</th>
                <th className="px-2 py-2 text-right">Fat. líquido</th>
                <th className="px-2 py-2 text-right">% Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {arvore.map((dep) => {
                const depKey = `D:${dep.nome}`;
                const depOpen = expanded.has(depKey);
                return (
                  <Fragment key={depKey}>
                    <tr onClick={() => toggle(depKey)} className="hover:bg-surface-2/40 cursor-pointer bg-surface-2/20">
                      <td className="px-2 py-2.5 text-text-primary font-medium uppercase tracking-wider text-[11px]">
                        <span className="inline-block w-3 text-gold">{depOpen ? "▾" : "▸"}</span>{dep.nome}
                      </td>
                      <td className="px-2 py-2.5 text-right">{dep.pedidos}</td>
                      <td className="px-2 py-2.5 text-right">{dep.qtd}</td>
                      <td className="px-2 py-2.5 text-right text-gold font-medium">{formatBRL(dep.bruto)}</td>
                      <td className="px-2 py-2.5 text-right text-text-secondary">
                        {totalFat > 0 ? ((dep.bruto / totalFat) * 100).toFixed(1) : "0.0"}%
                      </td>
                    </tr>
                    {depOpen && dep.filhos.map((cat) => {
                      const catKey = `${depKey}>C:${cat.nome}`;
                      const catOpen = expanded.has(catKey);
                      return (
                        <Fragment key={catKey}>
                          <tr onClick={() => toggle(catKey)} className="hover:bg-surface-2/30 cursor-pointer">
                            <td className="pl-6 pr-2 py-1.5 text-text-secondary">
                              <span className="inline-block w-3 text-gold">{catOpen ? "▾" : "▸"}</span>{cat.nome}
                            </td>
                            <td className="px-2 py-1.5 text-right text-text-secondary">{cat.pedidos}</td>
                            <td className="px-2 py-1.5 text-right text-text-secondary">{cat.qtd}</td>
                            <td className="px-2 py-1.5 text-right text-text-secondary">{formatBRL(cat.bruto)}</td>
                            <td className="px-2 py-1.5 text-right text-text-muted">
                              {dep.bruto > 0 ? ((cat.bruto / dep.bruto) * 100).toFixed(1) : "0.0"}%
                            </td>
                          </tr>
                          {catOpen && cat.filhos.map((grp) => {
                            const grpKey = `${catKey}>G:${grp.nome}`;
                            const grpOpen = expanded.has(grpKey);
                            return (
                              <Fragment key={grpKey}>
                                <tr onClick={() => toggle(grpKey)} className="hover:bg-surface-2/20 cursor-pointer">
                                  <td className="pl-10 pr-2 py-1.5 text-text-secondary">
                                    <span className="inline-block w-3 text-gold">{grpOpen ? "▾" : "▸"}</span>{grp.nome}
                                  </td>
                                  <td className="px-2 py-1.5 text-right text-text-muted">{grp.pedidos}</td>
                                  <td className="px-2 py-1.5 text-right text-text-muted">{grp.qtd}</td>
                                  <td className="px-2 py-1.5 text-right text-text-muted">{formatBRL(grp.bruto)}</td>
                                  <td className="px-2 py-1.5 text-right text-text-muted">
                                    {cat.bruto > 0 ? ((grp.bruto / cat.bruto) * 100).toFixed(1) : "0.0"}%
                                  </td>
                                </tr>
                                {grpOpen && grp.filhos.map((tip) => (
                                  <tr key={`${grpKey}>T:${tip.nome}`} className="bg-surface-2/10">
                                    <td className="pl-14 pr-2 py-1 text-text-muted text-[11px]">└ {tip.nome}</td>
                                    <td className="px-2 py-1 text-right text-text-muted">{tip.pedidos}</td>
                                    <td className="px-2 py-1 text-right text-text-muted">{tip.qtd}</td>
                                    <td className="px-2 py-1 text-right text-text-muted">{formatBRL(tip.bruto)}</td>
                                    <td className="px-2 py-1 text-right text-text-muted">
                                      {grp.bruto > 0 ? ((tip.bruto / grp.bruto) * 100).toFixed(1) : "0.0"}%
                                    </td>
                                  </tr>
                                ))}
                              </Fragment>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {arvore.length === 0 && <div className="text-center text-sm text-text-muted py-6">Nenhum item no período.</div>}
        </div>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// TipoBreakdown — hierarquia Coleção → Cor → Número → Produtos
// ────────────────────────────────────────────────────────────────────────────

interface TipoBreakdownProps {
  tipo: { grupo: string; tipo: string; bruto: number };
  items: ItemRow[];
  expandedColecoes: Set<string>;
  expandedCores: Set<string>;
  expandedNumeros: Set<string>;
  toggleColecao: (k: string) => void;
  toggleCor: (k: string) => void;
  toggleNumero: (k: string) => void;
}

function extractNumero(it: ItemRow): string {
  const tn = it.product_snapshot?.tamanhoNumero;
  if (tn && /^\d+$/.test(String(tn).trim())) return String(tn).trim();
  const nome = it.product_snapshot?.nomeComercial ?? "";
  const m = nome.match(/N[ºo°]\s*(\d+)/i);
  if (m) return m[1];
  return "—";
}

function aggregate<T>(items: ItemRow[], keyFn: (it: ItemRow) => string, meta?: (it: ItemRow) => T) {
  const map = new Map<string, { key: string; meta: T | undefined; pedidos: Set<string>; qtd: number; bruto: number; precos: Set<number> }>();
  items.forEach((it) => {
    const k = keyFn(it);
    const cur = map.get(k) ?? { key: k, meta: meta?.(it), pedidos: new Set<string>(), qtd: 0, bruto: 0, precos: new Set<number>() };
    cur.qtd += Number(it.quantity || 0);
    cur.bruto += Number(it.subtotal_bruto || 0);
    cur.pedidos.add(it.orders.id);
    const p = Number(it.product_snapshot?.precoAtacado) || 0;
    if (p > 0) cur.precos.add(p);
    map.set(k, cur);
  });
  return Array.from(map.values()).sort((a, b) => b.bruto - a.bruto);
}

function priceRange(precos: Set<number>): string {
  if (precos.size === 0) return "—";
  const arr = Array.from(precos);
  const mn = Math.min(...arr), mx = Math.max(...arr);
  return mn === mx ? formatBRL(mn) : `${formatBRL(mn)} – ${formatBRL(mx)}`;
}

function TipoBreakdown({
  tipo, items,
  expandedColecoes, expandedCores, expandedNumeros,
  toggleColecao, toggleCor, toggleNumero,
}: TipoBreakdownProps) {
  const isVela = tipo.grupo === "Vela";
  const isNumerica = isVela && tipo.tipo === "Numérica";
  const totalTipo = tipo.bruto;

  const colecoes = aggregate(items, (it) => it.product_snapshot?.colecao ?? "—");

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
        Coleções ({colecoes.length})
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border/50">
            <th className="px-2 py-1 text-left w-6"></th>
            <th className="px-2 py-1 text-left">Coleção {isVela ? "/ Cor" : ""} {isNumerica ? "/ Nº" : ""} / Produto</th>
            <th className="px-2 py-1 text-right">Pedidos</th>
            <th className="px-2 py-1 text-right">Unidades</th>
            <th className="px-2 py-1 text-right">Fat. líquido</th>
            <th className="px-2 py-1 text-right">% do tipo</th>
            <th className="px-2 py-1 text-left w-[120px]">Participação</th>
            <th className="px-2 py-1 text-right">Preço un.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {colecoes.map((c) => {
            const colKey = `${tipo.grupo}||${tipo.tipo}||${c.key}`;
            const colOpen = expandedColecoes.has(colKey);
            const colPct = totalTipo > 0 ? (c.bruto / totalTipo) * 100 : 0;
            const colItems = items.filter((it) => (it.product_snapshot?.colecao ?? "—") === c.key);

            return (
              <Fragment key={colKey}>
                <tr className="hover:bg-surface/40 cursor-pointer bg-surface-2/50" onClick={() => toggleColecao(colKey)}>
                  <td className="px-2 py-1.5 text-text-muted">{colOpen ? "▼" : "▶"}</td>
                  <td className="px-2 py-1.5 text-text-primary font-medium">{c.key}</td>
                  <td className="px-2 py-1.5 text-right">{c.pedidos.size}</td>
                  <td className="px-2 py-1.5 text-right">{c.qtd}</td>
                  <td className="px-2 py-1.5 text-right text-gold">{formatBRL(c.bruto)}</td>
                  <td className="px-2 py-1.5 text-right text-text-secondary">{colPct.toFixed(1)}%</td>
                  <td className="px-2 py-1.5">
                    <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden">
                      <div className="h-full bg-gold rounded-full" style={{ width: `${Math.min(100, colPct)}%` }} />
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right text-text-secondary">{priceRange(c.precos)}</td>
                </tr>

                {colOpen && !isVela && (
                  <ProdutosRows
                    items={colItems}
                    totalRef={totalTipo}
                    indent={1}
                  />
                )}

                {colOpen && isVela && (() => {
                  const cores = aggregate(colItems, (it) => it.product_snapshot?.corNome ?? "—");
                  return cores.map((cor) => {
                    const corKey = `${colKey}||${cor.key}`;
                    const corOpen = expandedCores.has(corKey);
                    const corPct = totalTipo > 0 ? (cor.bruto / totalTipo) * 100 : 0;
                    const corItems = colItems.filter((it) => (it.product_snapshot?.corNome ?? "—") === cor.key);

                    return (
                      <Fragment key={corKey}>
                        <tr className="hover:bg-surface/40 cursor-pointer" onClick={() => toggleCor(corKey)}>
                          <td className="px-2 py-1 text-text-muted text-right pr-1">{corOpen ? "▼" : "▶"}</td>
                          <td className="px-2 py-1 text-text-secondary pl-6">{cor.key}</td>
                          <td className="px-2 py-1 text-right">{cor.pedidos.size}</td>
                          <td className="px-2 py-1 text-right">{cor.qtd}</td>
                          <td className="px-2 py-1 text-right text-gold/80">{formatBRL(cor.bruto)}</td>
                          <td className="px-2 py-1 text-right text-text-muted">{corPct.toFixed(1)}%</td>
                          <td className="px-2 py-1">
                            <div className="h-1 w-full rounded-full bg-surface overflow-hidden">
                              <div className="h-full bg-gold/70 rounded-full" style={{ width: `${Math.min(100, corPct)}%` }} />
                            </div>
                          </td>
                          <td className="px-2 py-1 text-right text-text-muted">{priceRange(cor.precos)}</td>
                        </tr>

                        {corOpen && !isNumerica && (
                          <ProdutosRows items={corItems} totalRef={totalTipo} indent={2} />
                        )}

                        {corOpen && isNumerica && (() => {
                          const numeros = aggregate(corItems, extractNumero);
                          return numeros.map((n) => {
                            const numKey = `${corKey}||${n.key}`;
                            const numOpen = expandedNumeros.has(numKey);
                            const numPct = totalTipo > 0 ? (n.bruto / totalTipo) * 100 : 0;
                            const numItems = corItems.filter((it) => extractNumero(it) === n.key);
                            return (
                              <Fragment key={numKey}>
                                <tr className="hover:bg-surface/40 cursor-pointer" onClick={() => toggleNumero(numKey)}>
                                  <td className="px-2 py-1 text-text-muted text-right pr-1">{numOpen ? "▼" : "▶"}</td>
                                  <td className="px-2 py-1 text-text-secondary pl-12">Nº {n.key}</td>
                                  <td className="px-2 py-1 text-right">{n.pedidos.size}</td>
                                  <td className="px-2 py-1 text-right">{n.qtd}</td>
                                  <td className="px-2 py-1 text-right text-gold/70">{formatBRL(n.bruto)}</td>
                                  <td className="px-2 py-1 text-right text-text-muted">{numPct.toFixed(1)}%</td>
                                  <td className="px-2 py-1">
                                    <div className="h-1 w-full rounded-full bg-surface overflow-hidden">
                                      <div className="h-full bg-gold/50 rounded-full" style={{ width: `${Math.min(100, numPct)}%` }} />
                                    </div>
                                  </td>
                                  <td className="px-2 py-1 text-right text-text-muted">{priceRange(n.precos)}</td>
                                </tr>
                                {numOpen && (
                                  <ProdutosRows items={numItems} totalRef={totalTipo} indent={3} />
                                )}
                              </Fragment>
                            );
                          });
                        })()}
                      </Fragment>
                    );
                  });
                })()}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProdutosRows({ items, totalRef, indent }: { items: ItemRow[]; totalRef: number; indent: number }) {
  const produtos = aggregate(items, (it) => it.sku, (it) => ({
    nome: it.product_snapshot?.nomeComercial ?? it.sku,
    preco: Number(it.product_snapshot?.precoAtacado) || 0,
  }));
  const padLeft = ["pl-2", "pl-8", "pl-14", "pl-20"][indent] ?? "pl-2";
  return (
    <>
      {produtos.map((p) => {
        const pct = totalRef > 0 ? (p.bruto / totalRef) * 100 : 0;
        const nome = p.meta?.nome ?? p.key;
        const preco = p.meta?.preco ?? 0;
        return (
          <tr key={p.key} className="bg-background/30">
            <td></td>
            <td className={`px-2 py-1 text-text-primary ${padLeft}`}>
              <span className="font-mono text-text-muted text-[10px] mr-2">{p.key}</span>
              {nome}
            </td>
            <td className="px-2 py-1 text-right">{p.pedidos.size}</td>
            <td className="px-2 py-1 text-right">{p.qtd}</td>
            <td className="px-2 py-1 text-right text-gold/80">{formatBRL(p.bruto)}</td>
            <td className="px-2 py-1 text-right text-text-muted">{pct.toFixed(1)}%</td>
            <td className="px-2 py-1">
              <div className="h-1 w-full rounded-full bg-surface overflow-hidden">
                <div className="h-full bg-gold/60 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </td>
            <td className="px-2 py-1 text-right text-text-secondary">{preco > 0 ? formatBRL(preco) : "—"}</td>
          </tr>
        );
      })}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// TAB: CLIENTE  (Por cliente · Estado · Representante · Atendimento · Recompra)
// ────────────────────────────────────────────────────────────────────────────

type ClienteView = "cliente" | "estado" | "representante" | "atendimento" | "profundidade" | "recompra";

function TabCliente({ orders, ordersPrev, items, range }: {
  orders: OrderRow[];
  ordersPrev: OrderRow[];
  items: ItemRow[];
  range: { from: Date; to: Date; label: string };
}) {
  const [view, setView] = useState<ClienteView>("cliente");

  const totalFat = orders.reduce((s, o) => s + Number(o.total || 0), 0);
  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  // ── Agregação por cliente
  const porCliente = useMemo(() => {
    const m = new Map<string, {
      key: string; razao: string; cnpj: string; cidade: string; estado: string;
      pedidos: number; unidades: number; bruto: number; liquido: number;
      vendedores: Set<string>; ultima: string;
    }>();
    orders.forEach((o) => {
      const c = o.cliente_snapshot ?? {};
      const cnpj = c.cnpj || "—";
      const key = (c as { clienteId?: string }).clienteId || cnpj || c.razaoSocial || "—";
      const cur = m.get(key) ?? {
        key,
        razao: c.razaoSocial || c.nomeFantasia || "—",
        cnpj,
        cidade: (c as { cidade?: string }).cidade || "—",
        estado: (c as { estado?: string }).estado || "—",
        pedidos: 0, unidades: 0, bruto: 0, liquido: 0,
        vendedores: new Set<string>(), ultima: o.created_at,
      };
      cur.pedidos += 1;
      cur.unidades += Number(o.total_unidades || 0);
      cur.bruto += Number(o.commercial?.bruto || o.total || 0);
      cur.liquido += Number(o.total || 0);
      if (o.vendedor_nome) cur.vendedores.add(o.vendedor_nome);
      if (new Date(o.created_at) > new Date(cur.ultima)) cur.ultima = o.created_at;
      m.set(key, cur);
    });
    return Array.from(m.values())
      .map((r) => ({ ...r, ticket: r.pedidos ? r.liquido / r.pedidos : 0, pct: totalFat > 0 ? (r.liquido / totalFat) * 100 : 0 }))
      .sort((a, b) => b.liquido - a.liquido);
  }, [orders, totalFat]);

  // ── Por estado
  const porEstado = useMemo(() => {
    const m = new Map<string, { uf: string; pedidos: number; clientes: Set<string>; bruto: number; liquido: number; unidades: number }>();
    orders.forEach((o) => {
      const uf = (o.cliente_snapshot as { estado?: string } | null)?.estado || "—";
      const cnpj = o.cliente_snapshot?.cnpj || "—";
      const cur = m.get(uf) ?? { uf, pedidos: 0, clientes: new Set<string>(), bruto: 0, liquido: 0, unidades: 0 };
      cur.pedidos += 1;
      cur.clientes.add(cnpj);
      cur.bruto += Number(o.commercial?.bruto || o.total || 0);
      cur.liquido += Number(o.total || 0);
      cur.unidades += Number(o.total_unidades || 0);
      m.set(uf, cur);
    });
    return Array.from(m.values())
      .map((r) => ({ uf: r.uf, pedidos: r.pedidos, clientes: r.clientes.size, bruto: r.bruto, liquido: r.liquido, unidades: r.unidades, ticket: r.pedidos ? r.liquido / r.pedidos : 0, pct: totalFat > 0 ? (r.liquido / totalFat) * 100 : 0 }))
      .sort((a, b) => b.liquido - a.liquido);
  }, [orders, totalFat]);

  // ── Por vendedor (todos ou filtrado por tipo)
  const aggVendedor = (tipo: "rep" | "interno" | "todos") => {
    const m = new Map<string, { id: string; nome: string; pedidos: number; clientes: Set<string>; bruto: number; liquido: number; unidades: number }>();
    const base = tipo === "todos" ? orders : orders.filter((o) => o.vendedor_tipo === tipo);
    base.forEach((o) => {
      const id = o.vendedor_id || o.vendedor_nome || "—";
      const cur = m.get(id) ?? { id, nome: o.vendedor_nome || "—", pedidos: 0, clientes: new Set<string>(), bruto: 0, liquido: 0, unidades: 0 };
      cur.pedidos += 1;
      cur.clientes.add(o.cliente_snapshot?.cnpj || "—");
      cur.bruto += Number(o.commercial?.bruto || o.total || 0);
      cur.liquido += Number(o.total || 0);
      cur.unidades += Number(o.total_unidades || 0);
      m.set(id, cur);
    });
    return Array.from(m.values())
      .map((r) => ({ id: r.id, nome: r.nome, pedidos: r.pedidos, clientes: r.clientes.size, bruto: r.bruto, liquido: r.liquido, unidades: r.unidades, ticket: r.pedidos ? r.liquido / r.pedidos : 0, pct: totalFat > 0 ? (r.liquido / totalFat) * 100 : 0 }))
      .sort((a, b) => b.liquido - a.liquido);
  };
  const porRepresentante = useMemo(() => aggVendedor("todos"), [orders, totalFat]); // eslint-disable-line react-hooks/exhaustive-deps
  const porAtendimento = useMemo(() => aggVendedor("interno"), [orders, totalFat]); // eslint-disable-line react-hooks/exhaustive-deps


  // ── Profundidade por vendedor (variedade, profundidade de linha, coleções, tempo)
  const profundidade = useMemo(() => {
    type Acc = {
      id: string; nome: string;
      pedidos: Set<string>; clientes: Set<string>;
      skus: Set<string>; colecoes: Map<string, number>; grupos: Map<string, number>;
      categorias: Set<string>; tipos: Set<string>;
      unidades: number; liquido: number; bruto: number;
    };
    const m = new Map<string, Acc>();
    // Inicializa com todos vendedores que aparecem em orders (para incluir os sem itens)
    orders.forEach((o) => {
      const id = o.vendedor_id || o.vendedor_nome || "—";
      if (!m.has(id)) m.set(id, {
        id, nome: o.vendedor_nome || "—",
        pedidos: new Set(), clientes: new Set(),
        skus: new Set(), colecoes: new Map(), grupos: new Map(),
        categorias: new Set(), tipos: new Set(),
        unidades: 0, liquido: 0, bruto: 0,
      });
      const cur = m.get(id)!;
      cur.pedidos.add(o.id);
      cur.clientes.add(o.cliente_snapshot?.cnpj || "—");
      cur.liquido += Number(o.total || 0);
      cur.bruto += Number(o.commercial?.bruto || o.total || 0);
    });
    items.forEach((it) => {
      const id = it.orders?.vendedor_id || "—";
      const cur = m.get(id);
      if (!cur) return;
      const ps = it.product_snapshot ?? {};
      cur.skus.add(it.sku);
      cur.unidades += Number(it.quantity || 0);
      const col = ps.colecao || "—"; cur.colecoes.set(col, (cur.colecoes.get(col) || 0) + Number(it.quantity || 0));
      const gr = ps.grupo || "—"; cur.grupos.set(gr, (cur.grupos.get(gr) || 0) + Number(it.quantity || 0));
      if (ps.categoria) cur.categorias.add(ps.categoria);
      if (ps.tipo) cur.tipos.add(ps.tipo);
    });

    // Previous period faturamento por vendedor (para crescimento)
    const prevByVend = new Map<string, number>();
    ordersPrev.forEach((o) => {
      const id = o.vendedor_id || o.vendedor_nome || "—";
      prevByVend.set(id, (prevByVend.get(id) || 0) + Number(o.total || 0));
    });

    const totalSkusUniverso = new Set(items.map((it) => it.sku)).size;
    const totalColecoesUniverso = new Set(items.map((it) => it.product_snapshot?.colecao || "—")).size;

    const rows = Array.from(m.values()).map((r) => {
      const skus = r.skus.size;
      const ped = r.pedidos.size;
      const colecoes = r.colecoes.size;
      const grupos = r.grupos.size;
      const topColecao = Array.from(r.colecoes.entries()).sort((a, b) => b[1] - a[1])[0];
      const topGrupo = Array.from(r.grupos.entries()).sort((a, b) => b[1] - a[1])[0];
      const prev = prevByVend.get(r.id) || 0;
      const crescPct = prev > 0 ? ((r.liquido - prev) / prev) * 100 : (r.liquido > 0 ? 100 : 0);
      return {
        id: r.id, nome: r.nome,
        pedidos: ped, clientes: r.clientes.size, skus, colecoes, grupos,
        categorias: r.categorias.size, tipos: r.tipos.size,
        unidades: r.unidades, liquido: r.liquido, bruto: r.bruto,
        ticket: ped ? r.liquido / ped : 0,
        unidadesPorPedido: ped ? r.unidades / ped : 0,
        profundidade: skus ? r.unidades / skus : 0, // unidades por SKU único (depth de linha)
        variedadePct: totalSkusUniverso ? (skus / totalSkusUniverso) * 100 : 0,
        coberturaColecoesPct: totalColecoesUniverso ? (colecoes / totalColecoesUniverso) * 100 : 0,
        topColecao: topColecao ? topColecao[0] : "—",
        topColecaoUn: topColecao ? topColecao[1] : 0,
        topGrupo: topGrupo ? topGrupo[0] : "—",
        topGrupoUn: topGrupo ? topGrupo[1] : 0,
        prevLiquido: prev,
        crescPct,
      };
    }).sort((a, b) => b.liquido - a.liquido);

    return { rows, totalSkusUniverso, totalColecoesUniverso };
  }, [orders, ordersPrev, items]);

  // ── Série temporal (faturamento por dia × top 5 vendedores)
  const serieTempo = useMemo(() => {
    const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const days: string[] = [];
    const cursor = new Date(range.from);
    while (cursor < range.to) { days.push(dayKey(cursor)); cursor.setDate(cursor.getDate() + 1); }
    const top5 = profundidade.rows.slice(0, 5).map((r) => r.nome);
    const byDay = new Map<string, Record<string, number>>();
    days.forEach((d) => { const o: Record<string, number> = { dia: 0 as unknown as number }; top5.forEach((n) => (o[n] = 0)); byDay.set(d, o); });
    orders.forEach((o) => {
      const nome = o.vendedor_nome || "—";
      if (!top5.includes(nome)) return;
      const d = dayKey(new Date(o.created_at));
      const row = byDay.get(d); if (!row) return;
      row[nome] = (row[nome] || 0) + Number(o.total || 0);
    });
    return {
      top5,
      data: days.map((d) => {
        const row = byDay.get(d) || {};
        const dt = new Date(d);
        return { dia: `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`, ...row } as Record<string, number | string>;
      }),
    };
  }, [orders, range, profundidade.rows]);

  // ── Insights (campeões por dimensão)
  const insights = useMemo(() => {
    if (!profundidade.rows.length) return [] as Array<{ titulo: string; vendedor: string; valor: string; hint: string }>;
    const max = <K extends keyof (typeof profundidade.rows)[number]>(k: K, fmt: (v: number) => string, hint: string) => {
      const r = [...profundidade.rows].sort((a, b) => Number(b[k]) - Number(a[k]))[0];
      return { titulo: hint, vendedor: r.nome, valor: fmt(Number(r[k])), hint };
    };
    return [
      { ...max("liquido", formatBRL, "Maior faturamento"), titulo: "Maior faturamento" },
      { ...max("ticket", formatBRL, "Maior ticket médio"), titulo: "Maior ticket médio" },
      { ...max("variedadePct", (v) => `${v.toFixed(1)}%`, "Maior variedade (SKUs únicos)"), titulo: "Maior variedade (SKUs únicos)" },
      { ...max("profundidade", (v) => `${v.toFixed(1)} un/SKU`, "Maior profundidade de linha"), titulo: "Maior profundidade de linha" },
      { ...max("colecoes", (v) => `${v} coleções`, "Mais coleções vendidas"), titulo: "Mais coleções vendidas" },
      { ...max("clientes", (v) => `${v} clientes`, "Mais clientes ativos"), titulo: "Mais clientes ativos" },
      { ...max("crescPct", (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`, "Maior crescimento vs período anterior"), titulo: "Maior crescimento vs anterior" },
      { ...max("unidadesPorPedido", (v) => `${v.toFixed(1)} un/pedido`, "Maior densidade por pedido"), titulo: "Maior densidade por pedido" },
    ];
  }, [profundidade.rows]);


  // ── Recompra (cliente com 2+ pedidos no período; comparação com período anterior)
  const recompra = useMemo(() => {
    const prevClientes = new Set(ordersPrev.map((o) => o.cliente_snapshot?.cnpj || "—"));
    const m = new Map<string, { cnpj: string; razao: string; estado: string; pedidos: number; liquido: number; ultima: string; existiaAntes: boolean }>();
    orders.forEach((o) => {
      const cnpj = o.cliente_snapshot?.cnpj || "—";
      const cur = m.get(cnpj) ?? {
        cnpj,
        razao: o.cliente_snapshot?.razaoSocial || o.cliente_snapshot?.nomeFantasia || "—",
        estado: (o.cliente_snapshot as { estado?: string } | null)?.estado || "—",
        pedidos: 0, liquido: 0, ultima: o.created_at,
        existiaAntes: prevClientes.has(cnpj),
      };
      cur.pedidos += 1;
      cur.liquido += Number(o.total || 0);
      if (new Date(o.created_at) > new Date(cur.ultima)) cur.ultima = o.created_at;
      m.set(cnpj, cur);
    });
    const all = Array.from(m.values());
    const recompraInterna = all.filter((c) => c.pedidos >= 2);
    const recompraHistorica = all.filter((c) => c.existiaAntes);
    const novos = all.filter((c) => !c.existiaAntes);
    return { all, recompraInterna, recompraHistorica, novos };
  }, [orders, ordersPrev]);

  // ── CSV exports
  const exportCliente = () => downloadCSV(`fetely_clientes_${periodSuffix(range.from)}.csv`, porCliente.map((c, i) => ({
    "#": i + 1, "Razão Social": c.razao, CNPJ: c.cnpj, Cidade: c.cidade, UF: c.estado,
    Pedidos: c.pedidos, Unidades: c.unidades,
    "Fat. Bruto": c.bruto.toFixed(2), "Fat. Líquido": c.liquido.toFixed(2),
    "Ticket Médio": c.ticket.toFixed(2), "% Total": c.pct.toFixed(2),
    Vendedores: Array.from(c.vendedores).join(", "),
    "Última Compra": new Date(c.ultima).toLocaleDateString("pt-BR"),
  })));
  const exportEstado = () => downloadCSV(`fetely_estados_${periodSuffix(range.from)}.csv`, porEstado.map((c, i) => ({
    "#": i + 1, UF: c.uf, Clientes: c.clientes, Pedidos: c.pedidos, Unidades: c.unidades,
    "Fat. Bruto": c.bruto.toFixed(2), "Fat. Líquido": c.liquido.toFixed(2),
    "Ticket Médio": c.ticket.toFixed(2), "% Total": c.pct.toFixed(2),
  })));
  const exportVend = (rows: typeof porRepresentante, label: string) => downloadCSV(`fetely_${label}_${periodSuffix(range.from)}.csv`, rows.map((c, i) => ({
    "#": i + 1, Vendedor: c.nome, Clientes: c.clientes, Pedidos: c.pedidos, Unidades: c.unidades,
    "Fat. Bruto": c.bruto.toFixed(2), "Fat. Líquido": c.liquido.toFixed(2),
    "Ticket Médio": c.ticket.toFixed(2), "% Total": c.pct.toFixed(2),
  })));
  const exportRecompra = () => downloadCSV(`fetely_recompra_${periodSuffix(range.from)}.csv`, recompra.all.map((c, i) => ({
    "#": i + 1, "Razão Social": c.razao, CNPJ: c.cnpj, UF: c.estado,
    "Pedidos no período": c.pedidos, "Fat. Líquido": c.liquido.toFixed(2),
    "Comprou antes": c.existiaAntes ? "Sim" : "Não",
    "Tipo": c.pedidos >= 2 ? "Recompra no período" : c.existiaAntes ? "Recompra histórica" : "Novo cliente",
    "Última Compra": new Date(c.ultima).toLocaleDateString("pt-BR"),
  })));
  const exportProfundidade = () => downloadCSV(`fetely_profundidade_vendedor_${periodSuffix(range.from)}.csv`, profundidade.rows.map((r, i) => ({
    "#": i + 1, Vendedor: r.nome,
    Pedidos: r.pedidos, Clientes: r.clientes, Unidades: r.unidades,
    "SKUs únicos": r.skus, "Coleções": r.colecoes, "Grupos": r.grupos,
    "Categorias": r.categorias, "Tipos": r.tipos,
    "Fat. Bruto": r.bruto.toFixed(2), "Fat. Líquido": r.liquido.toFixed(2),
    "Ticket Médio": r.ticket.toFixed(2),
    "Unid./Pedido": r.unidadesPorPedido.toFixed(2),
    "Profundidade (un/SKU)": r.profundidade.toFixed(2),
    "Variedade %": r.variedadePct.toFixed(2),
    "Cobertura Coleções %": r.coberturaColecoesPct.toFixed(2),
    "Top Coleção": r.topColecao, "Top Coleção (un)": r.topColecaoUn,
    "Top Grupo": r.topGrupo, "Top Grupo (un)": r.topGrupoUn,
    "Fat. Período Anterior": r.prevLiquido.toFixed(2),
    "Crescimento %": r.crescPct.toFixed(2),
  })));

  const views: Array<{ key: ClienteView; label: string }> = [
    { key: "cliente", label: "Por Cliente" },
    { key: "estado", label: "Por Estado" },
    { key: "representante", label: "Por Vendedor" },
    { key: "atendimento", label: "Por Atendimento" },
    { key: "profundidade", label: "Aprofundamento Vendedor" },
    { key: "recompra", label: "Recompra" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={
              "px-3 py-1.5 text-[11px] uppercase tracking-wider rounded-md border transition " +
              (view === v.key
                ? "border-gold text-gold bg-gold/10"
                : "border-border text-text-secondary hover:text-text-primary")
            }
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "cliente" && (
        <>
          <Card title="Top 10 clientes por faturamento líquido">
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porCliente.slice(0, 10).map((c) => ({ nome: c.razao.slice(0, 28), valor: Math.round(c.liquido) }))}
                  layout="vertical" margin={{ top: 8, right: 72, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="gCli" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={GOLD} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={GOLD} stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <YAxis type="category" dataKey="nome" tick={AXIS_TICK} axisLine={false} tickLine={false} width={200} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                    formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="valor" fill="url(#gCli)" radius={[0, 6, 6, 0]} maxBarSize={18}>
                    <LabelList dataKey="valor" position="right" formatter={(v: number) => fmtCompactBRL(v)}
                      style={{ fill: "var(--text-secondary)", fontSize: 10 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

        <Card title={`Detalhe por cliente (${porCliente.length})`} action={<ExportBtn onClick={exportCliente} />}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-muted">
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Cliente</th>
                  <th className="px-2 py-2 text-left">CNPJ</th>
                  <th className="px-2 py-2 text-left">Cidade / UF</th>
                  <th className="px-2 py-2 text-right">Pedidos</th>
                  <th className="px-2 py-2 text-right">Unid.</th>
                  <th className="px-2 py-2 text-right">Líquido</th>
                  <th className="px-2 py-2 text-right">Ticket</th>
                  <th className="px-2 py-2 text-right">% Total</th>
                  <th className="px-2 py-2 text-left">Última</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {porCliente.map((c, i) => (
                  <tr key={c.key} className="hover:bg-surface-2/40">
                    <td className="px-2 py-2 text-text-muted">{i + 1}</td>
                    <td className="px-2 py-2 text-text-primary">{c.razao}</td>
                    <td className="px-2 py-2 text-text-secondary">{c.cnpj}</td>
                    <td className="px-2 py-2 text-text-secondary">{c.cidade} / {c.estado}</td>
                    <td className="px-2 py-2 text-right">{c.pedidos}</td>
                    <td className="px-2 py-2 text-right">{c.unidades.toLocaleString("pt-BR")}</td>
                    <td className="px-2 py-2 text-right text-text-primary">{formatBRL(c.liquido)}</td>
                    <td className="px-2 py-2 text-right">{formatBRL(c.ticket)}</td>
                    <td className="px-2 py-2 text-right text-gold">{fmtPct(c.pct)}</td>
                    <td className="px-2 py-2 text-text-secondary">{new Date(c.ultima).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        </>
      )}

      {view === "estado" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title="Faturamento por UF">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porEstado.slice(0, 12).map((e) => ({ nome: e.uf, valor: Math.round(e.liquido) }))}
                    margin={{ top: 24, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="nome" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                      formatter={(v: number) => formatBRL(v)} />
                    <Bar dataKey="valor" fill={GOLD} radius={[6, 6, 0, 0]} maxBarSize={36}>
                      <LabelList dataKey="valor" position="top" formatter={(v: number) => fmtCompactBRL(v)}
                        style={{ fill: "var(--text-secondary)", fontSize: 10 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Participação por UF">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={porEstado.slice(0, 8).map((e) => ({ nome: e.uf, valor: e.liquido }))}
                      dataKey="valor" nameKey="nome" cx="50%" cy="50%"
                      outerRadius={108} innerRadius={64} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
                      {porEstado.slice(0, 8).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatBRL(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        <Card title={`Faturamento por estado (${porEstado.length})`} action={<ExportBtn onClick={exportEstado} />}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-muted">
                  <th className="px-2 py-2 text-left">UF</th>
                  <th className="px-2 py-2 text-right">Clientes</th>
                  <th className="px-2 py-2 text-right">Pedidos</th>
                  <th className="px-2 py-2 text-right">Unid.</th>
                  <th className="px-2 py-2 text-right">Líquido</th>
                  <th className="px-2 py-2 text-right">Ticket</th>
                  <th className="px-2 py-2 text-right">% Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {porEstado.map((c) => (
                  <tr key={c.uf} className="hover:bg-surface-2/40">
                    <td className="px-2 py-2 text-text-primary font-medium">{c.uf}</td>
                    <td className="px-2 py-2 text-right">{c.clientes}</td>
                    <td className="px-2 py-2 text-right">{c.pedidos}</td>
                    <td className="px-2 py-2 text-right">{c.unidades.toLocaleString("pt-BR")}</td>
                    <td className="px-2 py-2 text-right text-text-primary">{formatBRL(c.liquido)}</td>
                    <td className="px-2 py-2 text-right">{formatBRL(c.ticket)}</td>
                    <td className="px-2 py-2 text-right text-gold">{fmtPct(c.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        </>
      )}

      {(view === "representante" || view === "atendimento") && (
        <>
          {(() => {
            const rows = view === "representante" ? porRepresentante : porAtendimento;
            const top = rows.slice(0, 10).map((r) => ({ nome: r.nome.slice(0, 22), valor: Math.round(r.liquido) }));
            return (
              <Card title={view === "representante" ? "Top vendedores" : "Top atendimento interno"}>
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={top} layout="vertical" margin={{ top: 8, right: 72, left: 8, bottom: 8 }}>
                      <defs>
                        <linearGradient id="gVend" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={GOLD} stopOpacity={0.55} />
                          <stop offset="100%" stopColor={GOLD} stopOpacity={1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                      <YAxis type="category" dataKey="nome" tick={AXIS_TICK} axisLine={false} tickLine={false} width={180} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                        formatter={(v: number) => formatBRL(v)} />
                      <Bar dataKey="valor" fill="url(#gVend)" radius={[0, 6, 6, 0]} maxBarSize={18}>
                        <LabelList dataKey="valor" position="right" formatter={(v: number) => fmtCompactBRL(v)}
                          style={{ fill: "var(--text-secondary)", fontSize: 10 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            );
          })()}
        <Card
          title={view === "representante" ? `Vendedores (${porRepresentante.length})` : `Atendimento interno (${porAtendimento.length})`}
          action={<ExportBtn onClick={() => exportVend(view === "representante" ? porRepresentante : porAtendimento, view)} />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-muted">
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Vendedor</th>
                  <th className="px-2 py-2 text-right">Clientes</th>
                  <th className="px-2 py-2 text-right">Pedidos</th>
                  <th className="px-2 py-2 text-right">Unid.</th>
                  <th className="px-2 py-2 text-right">Líquido</th>
                  <th className="px-2 py-2 text-right">Ticket</th>
                  <th className="px-2 py-2 text-right">% Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(view === "representante" ? porRepresentante : porAtendimento).map((c, i) => (
                  <tr key={c.id} className="hover:bg-surface-2/40">
                    <td className="px-2 py-2 text-text-muted">{i + 1}</td>
                    <td className="px-2 py-2 text-text-primary">{c.nome}</td>
                    <td className="px-2 py-2 text-right">{c.clientes}</td>
                    <td className="px-2 py-2 text-right">{c.pedidos}</td>
                    <td className="px-2 py-2 text-right">{c.unidades.toLocaleString("pt-BR")}</td>
                    <td className="px-2 py-2 text-right text-text-primary">{formatBRL(c.liquido)}</td>
                    <td className="px-2 py-2 text-right">{formatBRL(c.ticket)}</td>
                    <td className="px-2 py-2 text-right text-gold">{fmtPct(c.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        </>
      )}

      {view === "profundidade" && (
        <>
          {profundidade.rows.length === 0 ? (
            <Card title="Aprofundamento por vendedor">
              <p className="text-sm text-text-secondary">Sem dados de itens no período selecionado.</p>
            </Card>
          ) : (
            <>
              {/* Insights / campeões */}
              <Card title="Insights · destaques do período">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {insights.map((it) => (
                    <div key={it.titulo} className="rounded-lg border border-border bg-surface-2/40 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-text-muted">{it.titulo}</div>
                      <div className="mt-1 text-sm font-medium text-text-primary truncate" title={it.vendedor}>{it.vendedor}</div>
                      <div className="mt-0.5 text-gold text-sm">{it.valor}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-text-muted">
                  Universo do período: {profundidade.totalSkusUniverso} SKUs únicos · {profundidade.totalColecoesUniverso} coleções ativas.
                </div>
              </Card>

              {/* Variedade × Profundidade × Faturamento */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Card title="Variedade de SKUs vendidos (Top 10)">
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...profundidade.rows].sort((a, b) => b.skus - a.skus).slice(0, 10).map((r) => ({ nome: r.nome.slice(0, 22), skus: r.skus }))}
                        layout="vertical" margin={{ top: 8, right: 48, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="nome" tick={AXIS_TICK} axisLine={false} tickLine={false} width={170} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-2)", opacity: 0.5 }} formatter={(v: number) => `${v} SKUs`} />
                        <Bar dataKey="skus" fill={GOLD} radius={[0, 6, 6, 0]} maxBarSize={16}>
                          <LabelList dataKey="skus" position="right" style={{ fill: "var(--text-secondary)", fontSize: 10 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card title="Profundidade de linha (un. por SKU)">
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...profundidade.rows].sort((a, b) => b.profundidade - a.profundidade).slice(0, 10).map((r) => ({ nome: r.nome.slice(0, 22), prof: Number(r.profundidade.toFixed(1)) }))}
                        layout="vertical" margin={{ top: 8, right: 48, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="nome" tick={AXIS_TICK} axisLine={false} tickLine={false} width={170} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-2)", opacity: 0.5 }} formatter={(v: number) => `${v} un/SKU`} />
                        <Bar dataKey="prof" fill="#6FB36F" radius={[0, 6, 6, 0]} maxBarSize={16}>
                          <LabelList dataKey="prof" position="right" style={{ fill: "var(--text-secondary)", fontSize: 10 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {/* Coleções e crescimento */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Card title="Cobertura de coleções (qtd. de coleções vendidas)">
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...profundidade.rows].sort((a, b) => b.colecoes - a.colecoes).slice(0, 10).map((r) => ({ nome: r.nome.slice(0, 22), col: r.colecoes }))}
                        layout="vertical" margin={{ top: 8, right: 48, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="nome" tick={AXIS_TICK} axisLine={false} tickLine={false} width={170} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-2)", opacity: 0.5 }} formatter={(v: number) => `${v} coleções`} />
                        <Bar dataKey="col" fill="#C58CD8" radius={[0, 6, 6, 0]} maxBarSize={16}>
                          <LabelList dataKey="col" position="right" style={{ fill: "var(--text-secondary)", fontSize: 10 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card title="Crescimento vs período anterior (%)">
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...profundidade.rows].sort((a, b) => b.crescPct - a.crescPct).slice(0, 10).map((r) => ({ nome: r.nome.slice(0, 22), pct: Number(r.crescPct.toFixed(1)) }))}
                        layout="vertical" margin={{ top: 8, right: 56, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="nome" tick={AXIS_TICK} axisLine={false} tickLine={false} width={170} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-2)", opacity: 0.5 }} formatter={(v: number) => `${v}%`} />
                        <Bar dataKey="pct" radius={[0, 6, 6, 0]} maxBarSize={16}>
                          {[...profundidade.rows].sort((a, b) => b.crescPct - a.crescPct).slice(0, 10).map((r, i) => (
                            <Cell key={i} fill={r.crescPct >= 0 ? GOLD : "#B26464"} />
                          ))}
                          <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v}%`} style={{ fill: "var(--text-secondary)", fontSize: 10 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {/* Série temporal Top 5 vendedores */}
              <Card title="Vendas no tempo · Top 5 vendedores (faturamento líquido por dia)">
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={serieTempo.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="dia" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                      <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCompactBRL(Number(v))} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatBRL(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                      {serieTempo.top5.map((nome, i) => (
                        <Line key={nome} type="monotone" dataKey={nome} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Tabela detalhada */}
              <Card title={`Aprofundamento por vendedor (${profundidade.rows.length})`} action={<ExportBtn onClick={exportProfundidade} />}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-muted">
                        <th className="px-2 py-2 text-left">#</th>
                        <th className="px-2 py-2 text-left">Vendedor</th>
                        <th className="px-2 py-2 text-right">Pedidos</th>
                        <th className="px-2 py-2 text-right">Clientes</th>
                        <th className="px-2 py-2 text-right">Unid.</th>
                        <th className="px-2 py-2 text-right">SKUs</th>
                        <th className="px-2 py-2 text-right">Coleções</th>
                        <th className="px-2 py-2 text-right">Grupos</th>
                        <th className="px-2 py-2 text-right">Cat.</th>
                        <th className="px-2 py-2 text-right">Prof. (un/SKU)</th>
                        <th className="px-2 py-2 text-right">Variedade %</th>
                        <th className="px-2 py-2 text-right">Un/Pedido</th>
                        <th className="px-2 py-2 text-right">Líquido</th>
                        <th className="px-2 py-2 text-right">Ticket</th>
                        <th className="px-2 py-2 text-left">Top coleção</th>
                        <th className="px-2 py-2 text-right">Δ vs ant.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {profundidade.rows.map((r, i) => (
                        <tr key={r.id} className="hover:bg-surface-2/40">
                          <td className="px-2 py-2 text-text-muted">{i + 1}</td>
                          <td className="px-2 py-2 text-text-primary">{r.nome}</td>
                          <td className="px-2 py-2 text-right">{r.pedidos}</td>
                          <td className="px-2 py-2 text-right">{r.clientes}</td>
                          <td className="px-2 py-2 text-right">{r.unidades.toLocaleString("pt-BR")}</td>
                          <td className="px-2 py-2 text-right text-gold">{r.skus}</td>
                          <td className="px-2 py-2 text-right">{r.colecoes}</td>
                          <td className="px-2 py-2 text-right">{r.grupos}</td>
                          <td className="px-2 py-2 text-right">{r.categorias}</td>
                          <td className="px-2 py-2 text-right">{r.profundidade.toFixed(1)}</td>
                          <td className="px-2 py-2 text-right">{r.variedadePct.toFixed(1)}%</td>
                          <td className="px-2 py-2 text-right">{r.unidadesPorPedido.toFixed(1)}</td>
                          <td className="px-2 py-2 text-right text-text-primary">{formatBRL(r.liquido)}</td>
                          <td className="px-2 py-2 text-right">{formatBRL(r.ticket)}</td>
                          <td className="px-2 py-2 text-text-secondary truncate max-w-[160px]" title={`${r.topColecao} (${r.topColecaoUn})`}>{r.topColecao}</td>
                          <td className={"px-2 py-2 text-right " + (r.crescPct >= 0 ? "text-stock-in" : "text-stock-out")}>
                            {r.crescPct >= 0 ? "+" : ""}{r.crescPct.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {view === "recompra" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniKpi label="Clientes únicos" value={String(recompra.all.length)} />
            <MiniKpi label="Recompra no período (2+ pedidos)" value={String(recompra.recompraInterna.length)} hint={recompra.all.length ? `${((recompra.recompraInterna.length / recompra.all.length) * 100).toFixed(1)}% da base` : undefined} />
            <MiniKpi label="Recompra histórica" value={String(recompra.recompraHistorica.length)} hint="Já compraram no período anterior" />
            <MiniKpi label="Novos no período" value={String(recompra.novos.length)} />
          </div>

          {(() => {
            const novos = recompra.novos.length;
            const recorrentes = recompra.recompraHistorica.length;
            const mix = [
              { nome: "Novos no período", valor: novos },
              { nome: "Recompra histórica", valor: recorrentes },
            ].filter((x) => x.valor > 0);
            const COLORS = [GOLD, "#5C5028"];
            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Card title="Mix novos × recorrentes">
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={mix} dataKey="valor" nameKey="nome" cx="50%" cy="50%"
                          outerRadius={100} innerRadius={62} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
                          {mix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `${v} clientes`} />
                        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card title="Top 10 clientes por recompra (pedidos no período)">
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical"
                        data={recompra.all.slice().sort((a, b) => b.pedidos - a.pedidos).slice(0, 10)
                          .map((c) => ({ nome: c.razao.slice(0, 24), valor: c.pedidos }))}
                        margin={{ top: 8, right: 32, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="nome" tick={AXIS_TICK} axisLine={false} tickLine={false} width={170} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                          formatter={(v: number) => `${v} pedidos`} />
                        <Bar dataKey="valor" fill={GOLD} radius={[0, 6, 6, 0]} maxBarSize={16}>
                          <LabelList dataKey="valor" position="right" style={{ fill: "var(--text-secondary)", fontSize: 10 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            );
          })()}



          <Card title={`Recompra · Detalhe (${recompra.all.length} clientes)`} action={<ExportBtn onClick={exportRecompra} />}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-muted">
                    <th className="px-2 py-2 text-left">Cliente</th>
                    <th className="px-2 py-2 text-left">UF</th>
                    <th className="px-2 py-2 text-right">Pedidos</th>
                    <th className="px-2 py-2 text-right">Líquido</th>
                    <th className="px-2 py-2 text-left">Tipo</th>
                    <th className="px-2 py-2 text-left">Última</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recompra.all
                    .slice()
                    .sort((a, b) => b.pedidos - a.pedidos || b.liquido - a.liquido)
                    .map((c) => {
                      const tipo = c.pedidos >= 2 ? "Recompra no período" : c.existiaAntes ? "Recompra histórica" : "Novo";
                      const cor = tipo === "Recompra no período" ? "text-stock-in" : tipo === "Novo" ? "text-gold" : "text-text-secondary";
                      return (
                        <tr key={c.cnpj} className="hover:bg-surface-2/40">
                          <td className="px-2 py-2 text-text-primary">{c.razao}</td>
                          <td className="px-2 py-2 text-text-secondary">{c.estado}</td>
                          <td className="px-2 py-2 text-right">{c.pedidos}</td>
                          <td className="px-2 py-2 text-right text-text-primary">{formatBRL(c.liquido)}</td>
                          <td className={"px-2 py-2 " + cor}>{tipo}</td>
                          <td className="px-2 py-2 text-text-secondary">{new Date(c.ultima).toLocaleDateString("pt-BR")}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
