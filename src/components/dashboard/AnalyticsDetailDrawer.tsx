import { useMemo } from "react";
import { X, Boxes, Layers, TrendingUp, Users, Trophy, ShoppingBag, Package } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatBRL } from "@/lib/format";

interface DashItem {
  sku: string;
  quantity: number;
  subtotal_bruto: number;
  product_snapshot: { nomeComercial?: string; colecao?: string; corNome?: string } | null;
  orders: {
    id: string;
    created_at: string;
    vendedor_id: string;
    vendedor_nome: string;
    cliente_snapshot: { razaoSocial?: string; nomeFantasia?: string } | null;
    total: number;
  };
}

export type AnalyticsScope = {
  kind: "produto" | "colecao";
  key: string;
  nome: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  scope: AnalyticsScope | null;
  items: DashItem[];
  periodoLabel: string;
  showVendedores?: boolean;
}

export function AnalyticsDetailDrawer({
  open,
  onClose,
  scope,
  items,
  periodoLabel,
  showVendedores,
}: Props) {
  const filtered = useMemo(() => {
    if (!scope) return [];
    if (scope.kind === "produto") {
      return items.filter((it) => it.sku === scope.key);
    }
    return items.filter((it) => it.product_snapshot?.colecao === scope.key);
  }, [items, scope]);

  const totals = useMemo(() => {
    const valor = filtered.reduce((s, it) => s + Number(it.subtotal_bruto || 0), 0);
    const quantidade = filtered.reduce((s, it) => s + Number(it.quantity || 0), 0);
    const pedidos = new Set(filtered.map((it) => it.orders.id)).size;
    const ticket = pedidos > 0 ? valor / pedidos : 0;
    return { valor, quantidade, pedidos, ticket };
  }, [filtered]);

  const clientes = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number; quantidade: number; pedidos: Set<string> }>();
    filtered.forEach((it) => {
      const nome =
        it.orders.cliente_snapshot?.nomeFantasia ||
        it.orders.cliente_snapshot?.razaoSocial ||
        "—";
      const cur = map.get(nome) ?? { nome, valor: 0, quantidade: 0, pedidos: new Set<string>() };
      cur.valor += Number(it.subtotal_bruto || 0);
      cur.quantidade += Number(it.quantity || 0);
      cur.pedidos.add(it.orders.id);
      map.set(nome, cur);
    });
    return Array.from(map.values())
      .map((c) => ({ ...c, pedidosQtd: c.pedidos.size }))
      .sort((a, b) => b.valor - a.valor);
  }, [filtered]);

  const vendedores = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number; quantidade: number; pedidos: Set<string> }>();
    filtered.forEach((it) => {
      const cur = map.get(it.orders.vendedor_id) ?? {
        nome: it.orders.vendedor_nome,
        valor: 0,
        quantidade: 0,
        pedidos: new Set<string>(),
      };
      cur.valor += Number(it.subtotal_bruto || 0);
      cur.quantidade += Number(it.quantity || 0);
      cur.pedidos.add(it.orders.id);
      map.set(it.orders.vendedor_id, cur);
    });
    return Array.from(map.values())
      .map((v) => ({ ...v, pedidosQtd: v.pedidos.size }))
      .sort((a, b) => b.valor - a.valor);
  }, [filtered]);

  // Variantes por SKU (relevante para coleção)
  const variantes = useMemo(() => {
    if (!scope || scope.kind !== "colecao") return [];
    const map = new Map<string, { nome: string; valor: number; quantidade: number }>();
    filtered.forEach((it) => {
      const nome =
        it.product_snapshot?.nomeComercial ?? it.sku;
      const cur = map.get(it.sku) ?? { nome, valor: 0, quantidade: 0 };
      cur.valor += Number(it.subtotal_bruto || 0);
      cur.quantidade += Number(it.quantity || 0);
      map.set(it.sku, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [filtered, scope]);

  // Pedidos detalhados
  const pedidos = useMemo(() => {
    const map = new Map<string, {
      id: string;
      created_at: string;
      cliente: string;
      vendedor: string;
      quantidade: number;
      valor: number;
      pedidoTotal: number;
    }>();
    filtered.forEach((it) => {
      const cur = map.get(it.orders.id) ?? {
        id: it.orders.id,
        created_at: it.orders.created_at,
        cliente:
          it.orders.cliente_snapshot?.nomeFantasia ||
          it.orders.cliente_snapshot?.razaoSocial ||
          "—",
        vendedor: it.orders.vendedor_nome,
        quantidade: 0,
        valor: 0,
        pedidoTotal: Number(it.orders.total || 0),
      };
      cur.quantidade += Number(it.quantity || 0);
      cur.valor += Number(it.subtotal_bruto || 0);
      map.set(it.orders.id, cur);
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [filtered]);

  // Série diária
  const timeseries = useMemo(() => {
    const map = new Map<string, { valor: number; quantidade: number }>();
    filtered.forEach((it) => {
      const k = new Date(it.orders.created_at).toISOString().slice(0, 10);
      const cur = map.get(k) ?? { valor: 0, quantidade: 0 };
      cur.valor += Number(it.subtotal_bruto || 0);
      cur.quantidade += Number(it.quantity || 0);
      map.set(k, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        label: new Date(date + "T00:00:00").toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        valor: Math.round(v.valor),
        quantidade: v.quantidade,
      }));
  }, [filtered]);

  if (!open || !scope) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative ml-auto h-full w-full max-w-3xl bg-background border-l border-border shadow-2xl overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-surface-2/95 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-gold">
              {scope.kind === "produto" ? <Boxes className="h-5 w-5" /> : <Layers className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted">
                {scope.kind === "produto" ? "Análise de produto" : "Análise de coleção"}
              </div>
              <h2 className="font-display text-lg sm:text-xl truncate">{scope.nome}</h2>
              <div className="text-[11px] text-text-muted">{periodoLabel}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-surface text-text-secondary hover:text-text-primary"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5 space-y-6">
          {/* KPIs */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniKpi icon={<TrendingUp className="h-3.5 w-3.5" />} label="Faturamento" value={formatBRL(totals.valor)} accent />
            <MiniKpi icon={<Package className="h-3.5 w-3.5" />} label="Unidades" value={totals.quantidade.toLocaleString("pt-BR")} />
            <MiniKpi icon={<ShoppingBag className="h-3.5 w-3.5" />} label="Pedidos" value={String(totals.pedidos)} />
            <MiniKpi icon={<Trophy className="h-3.5 w-3.5" />} label="Ticket médio" value={formatBRL(totals.ticket)} />
          </section>

          {/* Evolução */}
          {timeseries.length > 0 && (
            <section className="rounded-lg gold-border bg-surface overflow-hidden">
              <header className="px-4 py-2.5 border-b border-border bg-surface-2 text-[11px] uppercase tracking-wider text-text-muted">
                Evolução diária — faturamento
              </header>
              <div className="p-3 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeseries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="detailFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={20} />
                    <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                    <Tooltip
                      contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "var(--text-muted)", fontSize: 11 }}
                      formatter={(value: number) => [formatBRL(value), "Faturamento"]}
                    />
                    <Area type="monotone" dataKey="valor" stroke="var(--gold)" strokeWidth={2} fill="url(#detailFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Variantes (coleção) */}
          {scope.kind === "colecao" && variantes.length > 0 && (
            <DataList
              icon={<Boxes className="h-4 w-4 text-gold" />}
              title="Produtos da coleção"
              rows={variantes.map((v) => ({
                primary: v.nome,
                secondary: `${v.quantidade.toLocaleString("pt-BR")} un.`,
                value: formatBRL(v.valor),
              }))}
            />
          )}

          {/* Clientes */}
          {clientes.length > 0 && (
            <DataList
              icon={<Users className="h-4 w-4 text-gold" />}
              title="Top clientes"
              rows={clientes.map((c) => ({
                primary: c.nome,
                secondary: `${c.pedidosQtd} pedido${c.pedidosQtd !== 1 ? "s" : ""} · ${c.quantidade.toLocaleString("pt-BR")} un.`,
                value: formatBRL(c.valor),
              }))}
            />
          )}

          {/* Vendedores */}
          {showVendedores && vendedores.length > 0 && (
            <DataList
              icon={<Trophy className="h-4 w-4 text-gold" />}
              title="Vendedores"
              rows={vendedores.map((v) => ({
                primary: v.nome,
                secondary: `${v.pedidosQtd} pedido${v.pedidosQtd !== 1 ? "s" : ""} · ${v.quantidade.toLocaleString("pt-BR")} un.`,
                value: formatBRL(v.valor),
              }))}
            />
          )}

          {/* Pedidos */}
          {pedidos.length > 0 && (
            <section className="rounded-lg gold-border bg-surface overflow-hidden">
              <header className="px-4 py-2.5 border-b border-border bg-surface-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-muted">
                <ShoppingBag className="h-3.5 w-3.5 text-gold" />
                Pedidos ({pedidos.length})
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-muted">
                      <th className="px-4 py-2 text-left font-medium">Data</th>
                      <th className="px-4 py-2 text-left font-medium">Cliente</th>
                      {showVendedores && (
                        <th className="px-4 py-2 text-left font-medium">Vendedor</th>
                      )}
                      <th className="px-4 py-2 text-right font-medium">Qtd.</th>
                      <th className="px-4 py-2 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map((p) => (
                      <tr key={p.id} className="border-b border-border/40 hover:bg-surface-2/40">
                        <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">
                          {new Date(p.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-2.5 text-text-primary truncate max-w-[220px]">
                          {p.cliente}
                        </td>
                        {showVendedores && (
                          <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">
                            {p.vendedor}
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-right text-text-secondary whitespace-nowrap">
                          {p.quantidade.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gold font-medium whitespace-nowrap">
                          {formatBRL(p.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

function MiniKpi({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "rounded-md p-3 " +
        (accent
          ? "border border-gold/50 bg-gradient-to-br from-gold/10 to-transparent"
          : "gold-border bg-surface")
      }
    >
      <div className="flex items-center gap-1.5 text-text-muted text-[10px] uppercase tracking-[0.18em]">
        <span className="text-gold">{icon}</span>
        {label}
      </div>
      <div className={"font-display mt-1 truncate " + (accent ? "text-gold text-lg" : "text-text-primary text-lg")}>
        {value}
      </div>
    </div>
  );
}

function DataList({
  icon,
  title,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  rows: Array<{ primary: string; secondary?: string; value: string }>;
}) {
  return (
    <section className="rounded-lg gold-border bg-surface overflow-hidden">
      <header className="px-4 py-2.5 border-b border-border bg-surface-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-muted">
        {icon}
        {title}
      </header>
      <ul className="divide-y divide-border/50">
        {rows.slice(0, 10).map((r, i) => (
          <li key={i} className="px-4 py-2.5 flex items-center gap-3">
            <div className="w-5 text-center font-display text-sm text-gold shrink-0">{i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-text-primary truncate">{r.primary}</div>
              {r.secondary && (
                <div className="text-[11px] text-text-muted truncate">{r.secondary}</div>
              )}
            </div>
            <div className="text-gold font-medium text-sm whitespace-nowrap">{r.value}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
