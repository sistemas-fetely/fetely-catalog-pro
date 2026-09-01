import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Boxes, Layers, ShoppingBag, Search, ArrowUpDown } from "lucide-react";
import { useAuth } from "@/store/authStore";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged, applyVendaValida, applyVendaValidaEmbed, isVendaValida } from "@/lib/reportQuery";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Análise detalhada — Fetély" },
      { name: "description", content: "Análise completa de produtos, coleções e pedidos." },
    ],
  }),
  component: AnalyticsPage,
});

type Periodo = "mes_atual" | "mes_anterior" | "ultimos_90" | "ultimos_180" | "ano_atual";
type View = "produtos" | "colecoes" | "pedidos";
type SortKey = "valor" | "quantidade" | "nome" | "data";

function rangeFor(p: Periodo): { from: Date; to: Date; label: string } {
  const now = new Date();
  if (p === "mes_atual") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      label: "Mês atual",
    };
  }
  if (p === "mes_anterior") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: new Date(now.getFullYear(), now.getMonth(), 1),
      label: "Mês anterior",
    };
  }
  if (p === "ano_atual") {
    return {
      from: new Date(now.getFullYear(), 0, 1),
      to: new Date(now.getFullYear() + 1, 0, 1),
      label: "Ano atual",
    };
  }
  const days = p === "ultimos_180" ? 180 : 90;
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { from, to, label: `Últimos ${days} dias` };
}

interface DashItem {
  sku: string;
  quantity: number;
  subtotal_bruto: number;
  product_snapshot: {
    nomeComercial?: string;
    colecao?: string;
    corNome?: string;
    categoria?: string;
    grupo?: string;
  } | null;
  orders: {
    id: string;
    created_at: string;
    vendedor_id: string;
    vendedor_nome: string;
    cliente_snapshot: { razaoSocial?: string; nomeFantasia?: string } | null;
    total: number;
  };
}

interface OrderRow {
  id: string;
  created_at: string;
  vendedor_nome: string;
  cliente_snapshot: { razaoSocial?: string; nomeFantasia?: string } | null;
  total: number;
  total_unidades: number;
  total_skus: number;
  forma_pagamento: string | null;
  commercial: { faixaNome?: string } | null;
}

function AnalyticsPage() {
  const session = useAuth((s) => s.session);
  const loading = useAuth((s) => s.loading);
  const roles = useAuth((s) => s.roles);
  const isCliente = roles.includes("cliente");
  const isAdminOrMaster = roles.includes("admin") || roles.includes("master");
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (isCliente && !isAdminOrMaster) navigate({ to: "/portal" });
  }, [loading, session, isCliente, isAdminOrMaster, navigate]);

  const [view, setView] = useState<View>("produtos");
  const [periodo, setPeriodo] = useState<Periodo>("mes_atual");
  const [busca, setBusca] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("valor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const range = useMemo(() => rangeFor(periodo), [periodo]);

  const { data: items = [], isLoading: loadingItems } = useQuery({
    enabled: !!session && !isCliente && (view === "produtos" || view === "colecoes"),
    queryKey: ["analytics-items", range.from.toISOString(), range.to.toISOString()],
    queryFn: async (): Promise<DashItem[]> => {
      const rows = await fetchAllPaged<DashItem & { orders: Record<string, unknown> }>(() =>
        applyVendaValidaEmbed(
          supabase
            .from("order_items")
            .select(
              "id, sku, quantity, subtotal_bruto, product_snapshot, orders!inner(id, created_at, vendedor_id, vendedor_nome, cliente_snapshot, total, status_pedido, reprovado, sncf_status_sync, bonificado)",
            )
            .gte("orders.created_at", range.from.toISOString())
            .lt("orders.created_at", range.to.toISOString()),
        ).order("id", { ascending: true }),
      );
      // Checagem defensiva (embeds do PostgREST podem ser inconsistentes)
      return rows.filter((r) => isVendaValida(r.orders as never)) as unknown as DashItem[];
    },
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    enabled: !!session && !isCliente && view === "pedidos",
    queryKey: ["analytics-orders", range.from.toISOString(), range.to.toISOString()],
    queryFn: async (): Promise<OrderRow[]> => {
      return await fetchAllPaged<OrderRow>(() =>
        applyVendaValida(
          supabase
            .from("orders")
            .select(
              "id, created_at, vendedor_nome, cliente_snapshot, total, total_unidades, total_skus, forma_pagamento, commercial",
            )
            .gte("created_at", range.from.toISOString())
            .lt("created_at", range.to.toISOString()),
        )
          .order("created_at", { ascending: false })
          .order("id", { ascending: false }),
      );
    },
  });

  if (loading || !session || isCliente) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center text-text-secondary text-sm">
        Carregando...
      </main>
    );
  }

  // Agregações
  type AggRow = {
    key: string;
    nome: string;
    sub?: string;
    valor: number;
    quantidade: number;
    pedidos: Set<string>;
  };

  const aggregate = (keyFn: (it: DashItem) => { key: string; nome: string; sub?: string } | null) => {
    const map = new Map<string, AggRow>();
    items.forEach((it) => {
      const k = keyFn(it);
      if (!k?.key) return;
      const cur =
        map.get(k.key) ??
        { key: k.key, nome: k.nome, sub: k.sub, valor: 0, quantidade: 0, pedidos: new Set<string>() };
      cur.valor += Number(it.subtotal_bruto || 0);
      cur.quantidade += Number(it.quantity || 0);
      cur.pedidos.add(it.orders.id);
      map.set(k.key, cur);
    });
    return Array.from(map.values());
  };

  const produtos = useMemo(
    () =>
      aggregate((it) => ({
        key: it.sku,
        nome: it.product_snapshot?.nomeComercial ?? it.sku,
        sub: [it.product_snapshot?.colecao, it.product_snapshot?.corNome]
          .filter(Boolean)
          .join(" · "),
      })),
    [items],
  );

  const colecoes = useMemo(
    () =>
      aggregate((it) => {
        const c = it.product_snapshot?.colecao;
        return c ? { key: c, nome: c, sub: it.product_snapshot?.categoria } : null;
      }),
    [items],
  );

  const sortRows = <T extends AggRow>(rows: T[]) => {
    const filtered = busca
      ? rows.filter(
          (r) =>
            r.nome.toLowerCase().includes(busca.toLowerCase()) ||
            r.key.toLowerCase().includes(busca.toLowerCase()),
        )
      : rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "nome") return a.nome.localeCompare(b.nome) * dir;
      if (sortKey === "quantidade") return (a.quantidade - b.quantidade) * dir;
      return (a.valor - b.valor) * dir;
    });
  };

  const sortedProdutos = useMemo(() => sortRows(produtos), [produtos, busca, sortKey, sortDir]);
  const sortedColecoes = useMemo(() => sortRows(colecoes), [colecoes, busca, sortKey, sortDir]);

  const filteredOrders = useMemo(() => {
    const b = busca.toLowerCase();
    const list = busca
      ? orders.filter(
          (o) =>
            o.id.toLowerCase().includes(b) ||
            (o.cliente_snapshot?.nomeFantasia || "").toLowerCase().includes(b) ||
            (o.cliente_snapshot?.razaoSocial || "").toLowerCase().includes(b) ||
            (o.vendedor_nome || "").toLowerCase().includes(b),
        )
      : orders;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "data")
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      if (sortKey === "nome")
        return (
          (a.cliente_snapshot?.nomeFantasia || a.cliente_snapshot?.razaoSocial || "").localeCompare(
            b.cliente_snapshot?.nomeFantasia || b.cliente_snapshot?.razaoSocial || "",
          ) * dir
        );
      if (sortKey === "quantidade") return ((a.total_unidades || 0) - (b.total_unidades || 0)) * dir;
      return (Number(a.total) - Number(b.total)) * dir;
    });
  }, [orders, busca, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "nome" ? "asc" : "desc");
    }
  };

  // Totais agregados
  const totalRowsProdutos = sortedProdutos.length;
  const totalValorProdutos = sortedProdutos.reduce((s, r) => s + r.valor, 0);
  const totalQtdProdutos = sortedProdutos.reduce((s, r) => s + r.quantidade, 0);

  const totalRowsColecoes = sortedColecoes.length;
  const totalValorColecoes = sortedColecoes.reduce((s, r) => s + r.valor, 0);
  const totalQtdColecoes = sortedColecoes.reduce((s, r) => s + r.quantidade, 0);

  const totalValorOrders = filteredOrders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <main className="mx-auto max-w-[1400px] px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gold hover:text-gold-light mb-2"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar ao dashboard
          </Link>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl">Análise detalhada</h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Lista completa de produtos vendidos, coleções e pedidos no período.
          </p>
        </div>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as Periodo)}
          className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs uppercase tracking-wider text-text-primary outline-none focus:border-gold"
        >
          <option value="mes_atual">Mês atual</option>
          <option value="mes_anterior">Mês anterior</option>
          <option value="ultimos_90">Últimos 90 dias</option>
          <option value="ultimos_180">Últimos 180 dias</option>
          <option value="ano_atual">Ano atual</option>
        </select>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border">
        <TabBtn active={view === "produtos"} onClick={() => setView("produtos")} icon={<Boxes className="h-4 w-4" />}>
          Produtos
        </TabBtn>
        <TabBtn active={view === "colecoes"} onClick={() => setView("colecoes")} icon={<Layers className="h-4 w-4" />}>
          Coleções
        </TabBtn>
        <TabBtn active={view === "pedidos"} onClick={() => setView("pedidos")} icon={<ShoppingBag className="h-4 w-4" />}>
          Pedidos
        </TabBtn>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={
              view === "pedidos" ? "Buscar por cliente, vendedor ou ID..." : "Buscar..."
            }
            className="w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-text-muted">
          {range.label}
        </span>
      </div>

      {/* Resumo */}
      {view === "produtos" && (
        <ResumoBar
          rows={[
            { label: "SKUs distintos", value: String(totalRowsProdutos) },
            { label: "Unidades", value: totalQtdProdutos.toLocaleString("pt-BR") },
            { label: "Faturamento bruto", value: formatBRL(totalValorProdutos) },
          ]}
        />
      )}
      {view === "colecoes" && (
        <ResumoBar
          rows={[
            { label: "Coleções", value: String(totalRowsColecoes) },
            { label: "Unidades", value: totalQtdColecoes.toLocaleString("pt-BR") },
            { label: "Faturamento bruto", value: formatBRL(totalValorColecoes) },
          ]}
        />
      )}
      {view === "pedidos" && (
        <ResumoBar
          rows={[
            { label: "Pedidos", value: String(filteredOrders.length) },
            { label: "Faturamento", value: formatBRL(totalValorOrders) },
          ]}
        />
      )}

      {/* Tabelas */}
      {view !== "pedidos" ? (
        <AggregateTable
          rows={view === "produtos" ? sortedProdutos : sortedColecoes}
          loading={loadingItems}
          firstColLabel={view === "produtos" ? "Produto" : "Coleção"}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
        />
      ) : (
        <OrdersTable
          rows={filteredOrders}
          loading={loadingOrders}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          showVendedor={isAdminOrMaster}
        />
      )}
    </main>
  );
}

function TabBtn({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-wider border-b-2 -mb-px transition " +
        (active
          ? "border-gold text-gold"
          : "border-transparent text-text-secondary hover:text-text-primary")
      }
    >
      {icon}
      {children}
    </button>
  );
}

function ResumoBar({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {rows.map((r) => (
        <div key={r.label} className="rounded-lg gold-border bg-surface p-3 sm:p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{r.label}</div>
          <div className="font-display text-xl sm:text-2xl text-text-primary mt-1">{r.value}</div>
        </div>
      ))}
    </div>
  );
}

function SortHeader({
  label, active, dir, onClick, align = "left",
}: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void; align?: "left" | "right" }) {
  return (
    <th className={`px-4 py-2.5 text-[10px] uppercase tracking-wider font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className={
          "inline-flex items-center gap-1 hover:text-text-primary transition " +
          (active ? "text-gold" : "text-text-muted")
        }
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
        {active && <span className="ml-0.5">{dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

function AggregateTable({
  rows, loading, firstColLabel, sortKey, sortDir, onSort,
}: {
  rows: Array<{ key: string; nome: string; sub?: string; valor: number; quantidade: number; pedidos: Set<string> }>;
  loading: boolean;
  firstColLabel: string;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  return (
    <div className="rounded-lg gold-border bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-2">
            <tr>
              <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider font-medium text-text-muted w-12">#</th>
              <SortHeader label={firstColLabel} active={sortKey === "nome"} dir={sortDir} onClick={() => onSort("nome")} />
              <SortHeader label="Pedidos" active={false} dir={sortDir} onClick={() => onSort("quantidade")} align="right" />
              <SortHeader label="Quantidade" active={sortKey === "quantidade"} dir={sortDir} onClick={() => onSort("quantidade")} align="right" />
              <SortHeader label="Faturamento" active={sortKey === "valor"} dir={sortDir} onClick={() => onSort("valor")} align="right" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-text-muted">Carregando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-text-secondary">Nenhum dado neste período.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.key} className="border-b border-border/40 hover:bg-surface-2/40">
                <td className="px-4 py-3 text-text-muted text-xs">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="text-text-primary">{r.nome}</div>
                  {r.sub && <div className="text-[11px] text-text-muted mt-0.5">{r.sub}</div>}
                </td>
                <td className="px-4 py-3 text-right text-text-secondary">{r.pedidos.size}</td>
                <td className="px-4 py-3 text-right text-text-secondary">{r.quantidade.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3 text-right text-gold font-medium">{formatBRL(r.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrdersTable({
  rows, loading, sortKey, sortDir, onSort, showVendedor,
}: {
  rows: OrderRow[];
  loading: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  showVendedor: boolean;
}) {
  return (
    <div className="rounded-lg gold-border bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-2">
            <tr>
              <SortHeader label="Data" active={sortKey === "data"} dir={sortDir} onClick={() => onSort("data")} />
              <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider font-medium text-text-muted">Pedido</th>
              <SortHeader label="Cliente" active={sortKey === "nome"} dir={sortDir} onClick={() => onSort("nome")} />
              {showVendedor && <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider font-medium text-text-muted">Vendedor</th>}
              <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider font-medium text-text-muted">Faixa / Pagamento</th>
              <SortHeader label="Unidades" active={sortKey === "quantidade"} dir={sortDir} onClick={() => onSort("quantidade")} align="right" />
              <SortHeader label="Valor" active={sortKey === "valor"} dir={sortDir} onClick={() => onSort("valor")} align="right" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={showVendedor ? 7 : 6} className="px-4 py-12 text-center text-sm text-text-muted">Carregando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={showVendedor ? 7 : 6} className="px-4 py-12 text-center text-sm text-text-secondary">Nenhum pedido neste período.</td></tr>
            ) : rows.map((o) => (
              <tr key={o.id} className="border-b border-border/40 hover:bg-surface-2/40">
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                  {new Date(o.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-text-muted font-mono text-xs whitespace-nowrap">
                  {o.id.replace("PED-", "#")}
                </td>
                <td className="px-4 py-3 text-text-primary truncate max-w-[260px]">
                  {o.cliente_snapshot?.nomeFantasia || o.cliente_snapshot?.razaoSocial || "—"}
                </td>
                {showVendedor && (
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{o.vendedor_nome}</td>
                )}
                <td className="px-4 py-3 text-text-secondary text-xs">
                  <div>{o.commercial?.faixaNome ?? "—"}</div>
                  {o.forma_pagamento && (
                    <div className="text-text-muted mt-0.5 truncate max-w-[200px]">
                      {o.forma_pagamento}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-text-secondary">
                  {(o.total_unidades || 0).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-right text-gold font-medium whitespace-nowrap">
                  {formatBRL(Number(o.total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
