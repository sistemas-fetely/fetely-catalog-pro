import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, Package, DollarSign, ShoppingBag, Users, Trophy, Percent, Sparkles, Boxes, Layers, LineChart as LineChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { useAuth } from "@/store/authStore";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Fetély" },
      { name: "description", content: "Visão geral de pedidos e performance." },
    ],
  }),
  component: DashboardPage,
});

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

type Periodo = "mes_atual" | "mes_anterior" | "ultimos_90";

interface OrderRow {
  id: string;
  created_at: string;
  vendedor_id: string;
  vendedor_nome: string;
  cliente_id: string | null;
  cliente_snapshot: { razaoSocial?: string; nomeFantasia?: string } | null;
  total: number;
  total_unidades: number;
  forma_pagamento: string | null;
  commercial: { faixaNome?: string; descontoMasterPct?: number } | null;
}

// ──────────────────────────────────────────────────────────────────────────
// Period helpers
// ──────────────────────────────────────────────────────────────────────────

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
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - 90);
  return { from, to, label: "Últimos 90 dias" };
}

// ──────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const session = useAuth((s) => s.session);
  const loading = useAuth((s) => s.loading);
  const profile = useAuth((s) => s.profile);
  const roles = useAuth((s) => s.roles);
  const isAdminOrMaster = roles.includes("admin") || roles.includes("master");
  const isCliente = roles.includes("cliente");
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    if (isCliente && !isAdminOrMaster) {
      navigate({ to: "/portal" });
    }
  }, [loading, session, isCliente, isAdminOrMaster, navigate]);

  const [periodo, setPeriodo] = useState<Periodo>("mes_atual");
  const [rankingMetric, setRankingMetric] = useState<"valor" | "quantidade">("valor");
  const [chartMetric, setChartMetric] = useState<"valor" | "pedidos">("valor");
  const [vendedorFiltro, setVendedorFiltro] = useState<string>("todos");
  const range = useMemo(() => rangeFor(periodo), [periodo]);
  const rangeAnterior = useMemo(() => {
    const span = range.to.getTime() - range.from.getTime();
    return {
      from: new Date(range.from.getTime() - span),
      to: range.from,
    };
  }, [range]);

  // Query principal — RLS filtra automaticamente pelo perfil do usuário
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    enabled: !!session && !isCliente,
    queryKey: ["dashboard-orders", range.from.toISOString(), range.to.toISOString(), vendedorFiltro],
    queryFn: async (): Promise<OrderRow[]> => {
      let q = supabase
        .from("orders")
        .select(
          "id, created_at, vendedor_id, vendedor_nome, cliente_id, cliente_snapshot, total, total_unidades, forma_pagamento, commercial",
        )
        .gte("created_at", range.from.toISOString())
        .lt("created_at", range.to.toISOString())
        .order("created_at", { ascending: false });
      if (vendedorFiltro !== "todos") q = q.eq("vendedor_id", vendedorFiltro);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });




  // Período anterior para deltas
  const { data: ordersPrev = [] } = useQuery({
    enabled: !!session && !isCliente,
    queryKey: ["dashboard-orders-prev", rangeAnterior.from.toISOString(), rangeAnterior.to.toISOString(), vendedorFiltro],
    queryFn: async (): Promise<OrderRow[]> => {
      let q = supabase
        .from("orders")
        .select("total, total_unidades")
        .gte("created_at", rangeAnterior.from.toISOString())
        .lt("created_at", rangeAnterior.to.toISOString());
      if (vendedorFiltro !== "todos") q = q.eq("vendedor_id", vendedorFiltro);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  // Itens de pedido no período — para ranking de produtos/coleções
  // RLS em order_items filtra automaticamente pelo perfil
  const { data: items = [], isLoading: loadingItems } = useQuery({
    enabled: !!session && !isCliente,
    queryKey: ["dashboard-items", range.from.toISOString(), range.to.toISOString(), vendedorFiltro],
    queryFn: async () => {
      let q = supabase
        .from("order_items")
        .select("sku, quantity, subtotal_bruto, product_snapshot, orders!inner(created_at, vendedor_id)")
        .gte("orders.created_at", range.from.toISOString())
        .lt("orders.created_at", range.to.toISOString());
      if (vendedorFiltro !== "todos") q = q.eq("orders.vendedor_id", vendedorFiltro);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<{
        sku: string;
        quantity: number;
        subtotal_bruto: number;
        product_snapshot: { nomeComercial?: string; colecao?: string; corNome?: string } | null;
      }>;
    },
  });

  // Lista de vendedores para o filtro (admin/master)
  const { data: vendedoresList = [] } = useQuery({
    enabled: !!session && isAdminOrMaster,
    queryKey: ["dashboard-vendedores-list"],
    queryFn: async (): Promise<Array<{ id: string; nome: string }>> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome_completo")
        .not("tipo_vendedor", "is", null)
        .eq("ativo", true)
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id as string,
        nome: (p.nome_completo as string) ?? "—",
      }));
    },
  });

  // Vendedores ativos (somente admin/master)
  const { data: vendedoresAtivos = 0 } = useQuery({
    enabled: !!session && isAdminOrMaster,
    queryKey: ["dashboard-vendedores-ativos"],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  if (loading || !session || isCliente) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center text-text-secondary text-sm">
        Carregando...
      </main>
    );
  }

  // ─── KPIs ─────────────────────────────────────────────────────────────
  const totalPedidos = orders.length;
  const faturamento = orders.reduce((s, o) => s + Number(o.total || 0), 0);
  const ticketMedio = totalPedidos > 0 ? faturamento / totalPedidos : 0;
  const unidades = orders.reduce((s, o) => s + (o.total_unidades || 0), 0);

  const fatPrev = ordersPrev.reduce((s, o) => s + Number(o.total || 0), 0);
  const deltaFat = fatPrev > 0 ? ((faturamento - fatPrev) / fatPrev) * 100 : null;
  const deltaPedidos = ordersPrev.length > 0
    ? ((totalPedidos - ordersPrev.length) / ordersPrev.length) * 100
    : null;
  const ticketPrev = ordersPrev.length > 0 ? fatPrev / ordersPrev.length : 0;
  const deltaTicket = ticketPrev > 0 ? ((ticketMedio - ticketPrev) / ticketPrev) * 100 : null;

  // ─── Ranking de vendedores (admin/master) ─────────────────────────────
  const ranking = isAdminOrMaster
    ? Array.from(
        orders.reduce((map, o) => {
          const k = o.vendedor_id;
          const cur = map.get(k) ?? { nome: o.vendedor_nome, total: 0, pedidos: 0 };
          cur.total += Number(o.total || 0);
          cur.pedidos += 1;
          map.set(k, cur);
          return map;
        }, new Map<string, { nome: string; total: number; pedidos: number }>()),
      )
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.total - a.total)
    : [];
  const melhorVendedor = ranking[0];

  // ─── Ranking de produtos e coleções ───────────────────────────────────
  type AggRow = { key: string; nome: string; valor: number; quantidade: number };
  const aggregate = (keyFn: (it: typeof items[number]) => { key: string; nome: string } | null) => {
    const map = new Map<string, AggRow>();
    items.forEach((it) => {
      const k = keyFn(it);
      if (!k || !k.key) return;
      const cur = map.get(k.key) ?? { key: k.key, nome: k.nome, valor: 0, quantidade: 0 };
      cur.valor += Number(it.subtotal_bruto || 0);
      cur.quantidade += Number(it.quantity || 0);
      map.set(k.key, cur);
    });
    return Array.from(map.values()).sort((a, b) =>
      rankingMetric === "valor" ? b.valor - a.valor : b.quantidade - a.quantidade,
    );
  };
  const rankingProdutos = aggregate((it) => ({
    key: it.sku,
    nome: it.product_snapshot?.nomeComercial ?? it.sku,
  }));
  const rankingColecoes = aggregate((it) => {
    const c = it.product_snapshot?.colecao;
    return c ? { key: c, nome: c } : null;
  });

  // ─── Série temporal (evolução diária) ─────────────────────────────────
  const timeseries = (() => {
    const buckets = new Map<string, { valor: number; pedidos: number }>();
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.min(
      Math.ceil((range.to.getTime() - range.from.getTime()) / dayMs),
      92,
    );
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(range.from.getTime() + i * dayMs);
      const k = d.toISOString().slice(0, 10);
      buckets.set(k, { valor: 0, pedidos: 0 });
    }
    orders.forEach((o) => {
      const k = new Date(o.created_at).toISOString().slice(0, 10);
      const cur = buckets.get(k) ?? { valor: 0, pedidos: 0 };
      cur.valor += Number(o.total || 0);
      cur.pedidos += 1;
      buckets.set(k, cur);
    });
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        label: new Date(date + "T00:00:00").toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        valor: Math.round(v.valor),
        pedidos: v.pedidos,
      }));
  })();


  // ─── Desconto médio (vendedor) ────────────────────────────────────────
  const descontoMedio =
    orders.length > 0
      ? orders.reduce((s, o) => s + (Number(o.commercial?.descontoMasterPct) || 0), 0) /
        orders.length
      : 0;

  // ─── Faixa mais frequente ─────────────────────────────────────────────
  const faixaCount = new Map<string, number>();
  orders.forEach((o) => {
    const f = o.commercial?.faixaNome ?? "—";
    faixaCount.set(f, (faixaCount.get(f) ?? 0) + 1);
  });
  const faixaTop =
    Array.from(faixaCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // ─── Pagamento preferido ──────────────────────────────────────────────
  const pagCount = new Map<string, number>();
  orders.forEach((o) => {
    if (!o.forma_pagamento) return;
    const k = o.forma_pagamento.split("(")[0].trim();
    pagCount.set(k, (pagCount.get(k) ?? 0) + 1);
  });
  const pagTop =
    Array.from(pagCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const nomeUsuario = profile?.nome_completo?.split(" ")[0] ?? "";

  return (
    <main className="mx-auto max-w-[1400px] px-3 sm:px-6 py-6 sm:py-8 lg:py-10 space-y-6 lg:space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Dashboard</div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl mt-1">
            {isAdminOrMaster ? "Visão geral" : `Olá, ${nomeUsuario || "vendedor"}`}
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            {isAdminOrMaster
              ? "Performance consolidada da operação"
              : "Sua performance neste período"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdminOrMaster && (
            <select
              value={vendedorFiltro}
              onChange={(e) => setVendedorFiltro(e.target.value)}
              className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs uppercase tracking-wider text-text-primary outline-none focus:border-gold max-w-[200px]"
            >
              <option value="todos">Todos os vendedores</option>
              {vendedoresList.map((v) => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          )}
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs uppercase tracking-wider text-text-primary outline-none focus:border-gold"
          >
            <option value="mes_atual">Mês atual</option>
            <option value="mes_anterior">Mês anterior</option>
            <option value="ultimos_90">Últimos 90 dias</option>
          </select>
        </div>
      </header>

      {/* KPIs principais */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          icon={<ShoppingBag className="h-4 w-4" />}
          label={isAdminOrMaster ? "Pedidos" : "Meus pedidos"}
          value={String(totalPedidos)}
          delta={deltaPedidos}
          loading={loadingOrders}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label={isAdminOrMaster ? "Faturamento" : "Meu faturamento"}
          value={formatBRL(faturamento)}
          delta={deltaFat}
          loading={loadingOrders}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Ticket médio"
          value={formatBRL(ticketMedio)}
          delta={deltaTicket}
          loading={loadingOrders}
        />
        <KpiCard
          icon={<Package className="h-4 w-4" />}
          label="Unidades"
          value={unidades.toLocaleString("pt-BR")}
          loading={loadingOrders}
        />
      </section>

      {/* Linha secundária — varia por perfil */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {isAdminOrMaster ? (
          <>
            <KpiCard
              icon={<Users className="h-4 w-4" />}
              label="Vendedores ativos"
              value={String(vendedoresAtivos)}
              hint="Cadastros ativos no sistema"
            />
            <KpiCard
              icon={<Trophy className="h-4 w-4" />}
              label="Melhor vendedor"
              value={melhorVendedor?.nome ?? "—"}
              hint={melhorVendedor ? formatBRL(melhorVendedor.total) : undefined}
              accent
            />
            <KpiCard
              icon={<Sparkles className="h-4 w-4" />}
              label="Faixa mais frequente"
              value={faixaTop}
              hint={`${faixaCount.get(faixaTop) ?? 0} pedidos`}
            />
          </>
        ) : (
          <>
            <KpiCard
              icon={<Percent className="h-4 w-4" />}
              label="Desconto médio"
              value={`${descontoMedio.toFixed(1)}%`}
              hint="Negociação aplicada"
            />
            <KpiCard
              icon={<Sparkles className="h-4 w-4" />}
              label="Faixa mais frequente"
              value={faixaTop}
              hint={`${faixaCount.get(faixaTop) ?? 0} pedidos`}
            />
            <KpiCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Pagamento preferido"
              value={pagTop}
              hint={`${pagCount.get(pagTop) ?? 0} pedidos`}
            />
          </>
        )}
      </section>

      {/* Evolução no período */}
      <section className="rounded-lg gold-border bg-surface overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border bg-surface-2">
          <div className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4 text-gold" />
            <h2 className="font-display text-lg sm:text-xl">Evolução no período</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-text-muted">
              {range.label}
            </span>
            <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-[10px] uppercase tracking-wider">
              <button
                type="button"
                onClick={() => setChartMetric("valor")}
                className={
                  "px-3 py-1.5 rounded " +
                  (chartMetric === "valor"
                    ? "bg-gold text-background"
                    : "text-text-secondary hover:text-text-primary")
                }
              >
                Faturamento
              </button>
              <button
                type="button"
                onClick={() => setChartMetric("pedidos")}
                className={
                  "px-3 py-1.5 rounded " +
                  (chartMetric === "pedidos"
                    ? "bg-gold text-background"
                    : "text-text-secondary hover:text-text-primary")
                }
              >
                Pedidos
              </button>
            </div>
          </div>
        </header>
        <div className="p-3 sm:p-4 h-[260px] sm:h-[300px]">
          {loadingOrders ? (
            <div className="h-full flex items-center justify-center text-sm text-text-muted">
              Carregando...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="evoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--text-muted))", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--text-muted))", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={chartMetric === "valor" ? 64 : 36}
                  tickFormatter={(v) =>
                    chartMetric === "valor"
                      ? v >= 1000
                        ? `${(v / 1000).toFixed(0)}k`
                        : String(v)
                      : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--surface-2))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--text-muted))", fontSize: 11 }}
                  formatter={(value: number) =>
                    chartMetric === "valor"
                      ? [formatBRL(value), "Faturamento"]
                      : [String(value), "Pedidos"]
                  }
                />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  stroke="hsl(var(--gold))"
                  strokeWidth={2}
                  fill="url(#evoFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Ranking de vendedores — somente admin/master */}
      {isAdminOrMaster && ranking.length > 0 && (
        <section className="rounded-lg gold-border bg-surface overflow-hidden">
          <header className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border bg-surface-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" />
              <h2 className="font-display text-lg sm:text-xl">Ranking de vendedores</h2>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">
              {range.label}
            </span>
          </header>
          <ul className="divide-y divide-border/50">
            {ranking.slice(0, 8).map((r, i) => {
              const maxTotal = ranking[0].total || 1;
              const pct = (r.total / maxTotal) * 100;
              return (
                <li key={r.id} className="px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4">
                  <div className="w-6 text-center font-display text-lg text-gold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <span className="text-sm text-text-primary truncate">{r.nome}</span>
                      <span className="text-xs text-text-secondary shrink-0">
                        {r.pedidos} pedido{r.pedidos !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold/60 to-gold rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0 w-24 sm:w-32">
                    <div className="text-gold font-medium text-sm">{formatBRL(r.total)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Ranking de produtos e coleções */}
      {(rankingProdutos.length > 0 || rankingColecoes.length > 0 || loadingItems) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg sm:text-xl">Top produtos & coleções</h2>
            <div className="inline-flex rounded-md border border-border bg-surface-2 p-0.5 text-[10px] uppercase tracking-wider">
              <button
                type="button"
                onClick={() => setRankingMetric("valor")}
                className={
                  "px-3 py-1.5 rounded " +
                  (rankingMetric === "valor"
                    ? "bg-gold text-background"
                    : "text-text-secondary hover:text-text-primary")
                }
              >
                Por valor
              </button>
              <button
                type="button"
                onClick={() => setRankingMetric("quantidade")}
                className={
                  "px-3 py-1.5 rounded " +
                  (rankingMetric === "quantidade"
                    ? "bg-gold text-background"
                    : "text-text-secondary hover:text-text-primary")
                }
              >
                Por quantidade
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <RankingList
              icon={<Boxes className="h-4 w-4 text-gold" />}
              title="Produtos"
              rows={rankingProdutos.slice(0, 8)}
              metric={rankingMetric}
              loading={loadingItems}
              emptyLabel="Nenhum produto neste período."
            />
            <RankingList
              icon={<Layers className="h-4 w-4 text-gold" />}
              title="Coleções"
              rows={rankingColecoes.slice(0, 8)}
              metric={rankingMetric}
              loading={loadingItems}
              emptyLabel="Nenhuma coleção neste período."
            />
          </div>
        </section>
      )}



      {/* Tabela de pedidos */}
      <section className="rounded-lg gold-border bg-surface overflow-hidden">
        <header className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border bg-surface-2">
          <h2 className="font-display text-lg sm:text-xl">
            {isAdminOrMaster ? `Todos os pedidos` : `Meus pedidos`}
            <span className="text-text-muted text-sm ml-2">({orders.length})</span>
          </h2>
          <Link to="/orders" className="text-[10px] sm:text-xs uppercase tracking-wider text-gold hover:text-gold-light">
            Ver todos →
          </Link>
        </header>

        {loadingOrders ? (
          <div className="p-8 text-center text-sm text-text-muted">Carregando pedidos...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-text-secondary">Nenhum pedido neste período.</p>
            <Link
              to="/new-order"
              className="inline-flex mt-4 items-center gap-2 rounded-md bg-gold px-4 py-2 text-[11px] uppercase tracking-[0.15em] text-background hover:bg-gold-light"
            >
              Novo pedido
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile — cards */}
            <ul className="sm:hidden divide-y divide-border/50">
              {orders.slice(0, 12).map((o) => (
                <li key={o.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-text-muted">
                      {new Date(o.created_at).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="text-gold font-medium text-sm">{formatBRL(Number(o.total))}</span>
                  </div>
                  <div className="text-sm text-text-primary mt-1 truncate">
                    {o.cliente_snapshot?.nomeFantasia || o.cliente_snapshot?.razaoSocial || "—"}
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5 flex items-center gap-2">
                    {isAdminOrMaster && <span>{o.vendedor_nome}</span>}
                    {isAdminOrMaster && <span>·</span>}
                    <span>{o.commercial?.faixaNome ?? "—"}</span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop/tablet — table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-muted">
                    <th className="px-5 py-2.5 text-left font-medium">Data</th>
                    {isAdminOrMaster && (
                      <th className="px-5 py-2.5 text-left font-medium">Vendedor</th>
                    )}
                    <th className="px-5 py-2.5 text-left font-medium">Cliente</th>
                    <th className="px-5 py-2.5 text-left font-medium">Faixa</th>
                    <th className="px-5 py-2.5 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 15).map((o) => (
                    <tr key={o.id} className="border-b border-border/40 hover:bg-surface-2/40">
                      <td className="px-5 py-3 text-text-secondary whitespace-nowrap">
                        {new Date(o.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      {isAdminOrMaster && (
                        <td className="px-5 py-3 text-text-primary whitespace-nowrap">
                          {o.vendedor_nome}
                        </td>
                      )}
                      <td className="px-5 py-3 text-text-primary truncate max-w-[260px]">
                        {o.cliente_snapshot?.nomeFantasia || o.cliente_snapshot?.razaoSocial || "—"}
                      </td>
                      <td className="px-5 py-3 text-text-secondary whitespace-nowrap">
                        {o.commercial?.faixaNome ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-gold font-medium whitespace-nowrap">
                        {formatBRL(Number(o.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// KPI Card
// ──────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, delta, hint, accent, loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number | null;
  hint?: string;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg p-3 sm:p-4 space-y-1.5 " +
        (accent
          ? "border border-gold/50 bg-gradient-to-br from-gold/10 to-transparent"
          : "gold-border bg-surface")
      }
    >
      <div className="flex items-center gap-2 text-text-muted">
        <span className="text-gold">{icon}</span>
        <span className="text-[10px] uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className={"font-display truncate " + (accent ? "text-gold text-xl sm:text-2xl" : "text-text-primary text-xl sm:text-2xl")}>
        {loading ? "..." : value}
      </div>
      {delta != null && !loading && (
        <div className={"text-[11px] " + (delta >= 0 ? "text-stock-in" : "text-stock-out")}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% vs período anterior
        </div>
      )}
      {hint && !loading && (
        <div className="text-[11px] text-text-muted truncate">{hint}</div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Ranking list (produtos / coleções)
// ──────────────────────────────────────────────────────────────────────────

function RankingList({
  icon, title, rows, metric, loading, emptyLabel,
}: {
  icon: React.ReactNode;
  title: string;
  rows: Array<{ key: string; nome: string; valor: number; quantidade: number }>;
  metric: "valor" | "quantidade";
  loading?: boolean;
  emptyLabel: string;
}) {
  const max =
    rows.length > 0
      ? Math.max(...rows.map((r) => (metric === "valor" ? r.valor : r.quantidade))) || 1
      : 1;

  return (
    <div className="rounded-lg gold-border bg-surface overflow-hidden">
      <header className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-border bg-surface-2">
        {icon}
        <h3 className="font-display text-base sm:text-lg">{title}</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-text-muted">
          {metric === "valor" ? "Valor" : "Quantidade"}
        </span>
      </header>
      {loading ? (
        <div className="p-6 text-center text-sm text-text-muted">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-text-secondary">{emptyLabel}</div>
      ) : (
        <ul className="divide-y divide-border/50">
          {rows.map((r, i) => {
            const v = metric === "valor" ? r.valor : r.quantidade;
            const pct = (v / max) * 100;
            return (
              <li key={r.key} className="px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4">
                <div className="w-6 text-center font-display text-base text-gold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <span className="text-sm text-text-primary truncate">{r.nome}</span>
                    <span className="text-xs text-text-secondary shrink-0">
                      {metric === "valor"
                        ? `${r.quantidade} un.`
                        : formatBRL(r.valor)}
                    </span>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold/60 to-gold rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0 w-24 sm:w-28">
                  <div className="text-gold font-medium text-sm">
                    {metric === "valor"
                      ? formatBRL(r.valor)
                      : `${r.quantidade.toLocaleString("pt-BR")} un.`}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
