import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil, ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  getMetasPaceData,
  upsertMetaMensal,
  upsertMetaVendedor,
  type MetasPaceDataResult,
} from "@/lib/metasPace.functions";
import { calcularPace, serieGrafico, type StatusPace } from "@/lib/metasPace";
import { formatBRL } from "@/lib/format";
import { useAuth } from "@/store/authStore";

export const Route = createFileRoute("/metas-pace")({
  head: () => ({
    meta: [
      { title: "Metas & Pace — Fetély B2B" },
      { name: "description", content: "Acompanhamento de metas e pace do time interno." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MetasPacePage,
});

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function MetasPacePage() {
  const navigate = useNavigate();
  const roles = useAuth((s) => s.roles);
  const profile = useAuth((s) => s.profile);
  const loadingAuth = useAuth((s) => s.loading);

  const isAdminOrMaster = roles.includes("admin") || roles.includes("master");
  const isVendedorInterno =
    roles.includes("vendedor") && (profile?.tipo_vendedor ?? "interno") === "interno";
  const podeAcessar = isAdminOrMaster || isVendedorInterno;

  useEffect(() => {
    if (!loadingAuth && !podeAcessar) {
      toast.error("Painel exclusivo do time interno de vendas");
      navigate({ to: "/orders" });
    }
  }, [loadingAuth, podeAcessar, navigate]);

  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [editOpen, setEditOpen] = useState(false);

  const fetchData = useServerFn(getMetasPaceData);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["metas-pace", ano, mes],
    queryFn: () => fetchData({ data: { ano, mes } }),
    enabled: podeAcessar,
  });

  const setMonth = (delta: number) => {
    const d = new Date(ano, mes - 1 + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth() + 1);
  };

  if (!podeAcessar) return null;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-text-secondary hover:text-gold"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Pedidos
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Time interno</div>
          <h1 className="font-display text-3xl sm:text-4xl mt-1">Meta &amp; Pace do mês</h1>
          <p className="text-xs text-text-secondary mt-2 max-w-lg">
            Visualização. O time acompanha; não edita vendas. Metas e definição de realizado ficam com o admin.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-md gold-border bg-surface px-1 py-1">
            <button
              onClick={() => setMonth(-1)}
              className="p-1.5 hover:bg-gold/10 rounded"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-3 py-1 text-sm font-medium min-w-[140px] text-center">
              {MESES[mes - 1]} {ano}
            </div>
            <button
              onClick={() => setMonth(1)}
              className="p-1.5 hover:bg-gold/10 rounded"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {data?.podeEditar && (
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-2 text-xs uppercase tracking-wider text-background hover:bg-gold-light"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar metas
            </button>
          )}
        </div>
      </header>

      {isLoading && (
        <div className="rounded-lg gold-border bg-surface p-12 text-center text-text-secondary">
          Carregando…
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-stock-out/40 bg-stock-out/10 p-6 text-stock-out">
          {(error as Error).message}
        </div>
      )}

      {data && <MetasPaceView data={data} ano={ano} mes={mes} hoje={hoje} />}

      {editOpen && data?.podeEditar && (
        <EditarMetasModal
          data={data}
          ano={ano}
          mes={mes}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["metas-pace", ano, mes] });
          }}
        />
      )}
    </div>
  );
}

function MetasPaceView({
  data,
  ano,
  mes,
  hoje,
}: {
  data: MetasPaceDataResult;
  ano: number;
  mes: number;
  hoje: Date;
}) {
  const pace = calcularPace({
    meta: data.metaGlobal,
    realizado: data.totalRealizado,
    ano,
    mes,
    hoje,
  });
  const pctMeta = data.metaGlobal > 0 ? (data.totalRealizado / data.metaGlobal) * 100 : 0;
  const gap = pace.projecaoFimMes - data.metaGlobal;
  const somaMetasInd = data.vendedores.reduce((s, v) => s + v.meta, 0);
  const diffReconc = somaMetasInd - data.metaGlobal;

  const serie = useMemo(
    () => serieGrafico(ano, mes, data.metaGlobal, data.realizadoPorDiaTime, hoje),
    [ano, mes, data.metaGlobal, data.realizadoPorDiaTime, hoje],
  );

  const mesmoMes =
    hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes;
  const hojeDia = mesmoMes ? hoje.getDate() : null;

  return (
    <div className="space-y-6">
      {Math.abs(diffReconc) > 1 && data.vendedores.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          Metas individuais somam {formatBRL(somaMetasInd)} — {formatBRL(Math.abs(diffReconc))}{" "}
          {diffReconc > 0 ? "acima" : "abaixo"} da meta global de {formatBRL(data.metaGlobal)}.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Meta do mês" value={formatBRL(data.metaGlobal)} />
        <KpiCard
          label="Realizado"
          value={formatBRL(data.totalRealizado)}
          sub={`${pctMeta.toFixed(1)}% da meta`}
        />
        <KpiCard
          label={pace.mesFechado ? "Resultado" : "Pace (dias úteis)"}
          value={
            pace.mesFechado ? (
              data.totalRealizado >= data.metaGlobal ? "Meta batida" : "Não bateu"
            ) : (
              <StatusBadge status={pace.status} />
            )
          }
          sub={
            pace.mesFechado
              ? `${(pctMeta).toFixed(1)}% · ${data.totalRealizado >= data.metaGlobal ? "✓" : "✗"}`
              : `ideal ${(pace.fracUtil * 100).toFixed(0)}% · real ${pctMeta.toFixed(0)}% · dia útil ${pace.diasUteisDecorridos}/${pace.diasUteisTotal}`
          }
        />
        <KpiCard
          label="Projeção fim do mês"
          value={formatBRL(pace.projecaoFimMes)}
          sub={
            <span className={gap >= 0 ? "text-stock-in" : "text-stock-out"}>
              {gap >= 0 ? "+" : ""}
              {formatBRL(gap)} vs meta
            </span>
          }
        />
        <KpiCard
          label={pace.mesFechado ? "Mês encerrado" : "Falta / dia útil restante"}
          value={
            pace.mesFechado
              ? formatBRL(Math.max(0, data.metaGlobal - data.totalRealizado))
              : formatBRL(pace.faltaPorDiaUtil)
          }
          sub={
            pace.mesFechado
              ? "diferença final"
              : `${pace.diasUteisRestantes} dia${pace.diasUteisRestantes === 1 ? "" : "s"} útil restante`
          }
        />
      </div>

      {/* Gráfico */}
      <div className="rounded-lg gold-border bg-surface p-4">
        <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted mb-3">
          Pace acumulado (R$)
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <LineChart data={serie} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--surface))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                }}
                formatter={(v: number) => formatBRL(v)}
                labelFormatter={(d) => `Dia ${d}`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine
                y={data.metaGlobal}
                stroke="#5A1533"
                strokeDasharray="4 4"
                label={{ value: "Meta", fill: "#5A1533", fontSize: 10, position: "right" }}
              />
              {hojeDia !== null && (
                <ReferenceLine x={hojeDia} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" />
              )}
              <Line
                type="stepAfter"
                dataKey="ideal"
                name="Ideal (dias úteis)"
                stroke="#C79A55"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="realizado"
                name="Realizado"
                stroke="#5A1533"
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="projecao"
                name="Projeção"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela por vendedor */}
      <div className="rounded-lg gold-border bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted">
            Por vendedor interno
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/50 text-[10px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="text-left px-4 py-2">Vendedor</th>
                <th className="text-right px-3 py-2">Meta</th>
                <th className="text-right px-3 py-2">Realizado</th>
                <th className="text-left px-3 py-2 w-40">% meta</th>
                <th className="text-left px-3 py-2">Pace</th>
                <th className="text-right px-3 py-2">Projeção</th>
                <th className="text-right px-4 py-2">Falta/dia útil</th>
              </tr>
            </thead>
            <tbody>
              {data.vendedores.map((v) => {
                const p = calcularPace({
                  meta: v.meta,
                  realizado: v.realizado,
                  ano,
                  mes,
                  hoje,
                });
                const pct = v.meta > 0 ? (v.realizado / v.meta) * 100 : 0;
                return (
                  <tr key={v.vendedorId} className="border-t border-border/40 hover:bg-background/30">
                    <td className="px-4 py-2">
                      <div className="text-text-primary">{v.nome}</div>
                      {v.login && <div className="text-[10px] text-text-muted">{v.login}</div>}
                    </td>
                    <td className="text-right px-3 py-2 font-mono text-xs">{formatBRL(v.meta)}</td>
                    <td className="text-right px-3 py-2 font-mono text-xs text-gold">
                      {formatBRL(v.realizado)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-border/40 rounded overflow-hidden">
                          <div
                            className="h-full bg-gold"
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-text-muted w-10 text-right">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {v.meta > 0 ? <StatusBadge status={p.status} /> : <span className="text-[10px] text-text-muted">sem meta</span>}
                    </td>
                    <td className="text-right px-3 py-2 font-mono text-xs">
                      {formatBRL(p.projecaoFimMes)}
                    </td>
                    <td className="text-right px-4 py-2 font-mono text-xs">
                      {v.meta > 0 ? formatBRL(p.faltaPorDiaUtil) : "—"}
                    </td>
                  </tr>
                );
              })}
              {data.semVendedor.realizado > 0 && (
                <tr className="border-t border-border/40 bg-amber-500/5">
                  <td className="px-4 py-2 text-amber-300">
                    ⚠ Sem vendedor
                    <div className="text-[10px] text-text-muted">
                      pedidos sem vendedor responsável definido
                    </div>
                  </td>
                  <td className="text-right px-3 py-2 text-text-muted">—</td>
                  <td className="text-right px-3 py-2 font-mono text-xs text-amber-300">
                    {formatBRL(data.semVendedor.realizado)}
                  </td>
                  <td colSpan={4} className="px-3 py-2 text-[10px] text-text-muted">
                    (contabilizado no time, não nas metas individuais)
                  </td>
                </tr>
              )}
              {/* Rodapé Time */}
              <tr className="border-t-2 border-gold/40 bg-gold/5 font-medium">
                <td className="px-4 py-2 text-gold uppercase tracking-wider text-[11px]">Time</td>
                <td className="text-right px-3 py-2 font-mono text-xs">{formatBRL(data.metaGlobal)}</td>
                <td className="text-right px-3 py-2 font-mono text-xs text-gold">
                  {formatBRL(data.totalRealizado)}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{pctMeta.toFixed(1)}%</td>
                <td className="px-3 py-2">
                  <StatusBadge status={pace.status} />
                </td>
                <td className="text-right px-3 py-2 font-mono text-xs">
                  {formatBRL(pace.projecaoFimMes)}
                </td>
                <td className="text-right px-4 py-2 font-mono text-xs">
                  {formatBRL(pace.faltaPorDiaUtil)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg gold-border bg-surface p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">{label}</div>
      <div className="mt-2 text-xl font-display text-text-primary">{value}</div>
      {sub && <div className="text-[11px] text-text-secondary mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: StatusPace }) {
  const cfg = {
    adiantado: { txt: "Adiantado", cls: "text-stock-in border-stock-in/40 bg-stock-in/10", Icon: TrendingUp },
    no_ritmo: { txt: "No ritmo", cls: "text-gold border-gold/40 bg-gold/10", Icon: Minus },
    atrasado: { txt: "Atrasado", cls: "text-stock-out border-stock-out/40 bg-stock-out/10", Icon: TrendingDown },
  }[status];
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      {cfg.txt}
    </span>
  );
}

function EditarMetasModal({
  data,
  ano,
  mes,
  onClose,
  onSaved,
}: {
  data: MetasPaceDataResult;
  ano: number;
  mes: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const saveGlobal = useServerFn(upsertMetaMensal);
  const saveVend = useServerFn(upsertMetaVendedor);
  const [metaGlobal, setMetaGlobal] = useState(String(data.metaGlobal));
  const [metasVend, setMetasVend] = useState<Record<string, string>>(
    Object.fromEntries(data.vendedores.map((v) => [v.vendedorId!, String(v.meta)])),
  );
  const [saving, setSaving] = useState(false);

  const somaInd = Object.values(metasVend).reduce((s, v) => s + (Number(v) || 0), 0);
  const globalNum = Number(metaGlobal) || 0;
  const diff = somaInd - globalNum;

  async function handleSalvar() {
    setSaving(true);
    try {
      await saveGlobal({ data: { ano, mes, metaGlobal: globalNum } });
      for (const v of data.vendedores) {
        const novo = Number(metasVend[v.vendedorId!] ?? 0) || 0;
        if (novo !== v.meta) {
          await saveVend({ data: { ano, mes, vendedorId: v.vendedorId!, meta: novo } });
        }
      }
      toast.success("Metas atualizadas");
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-background border border-border rounded-lg overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border">
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted">
            Admin · {MESES[mes - 1]} {ano}
          </div>
          <h2 className="font-display text-2xl mt-1">Editar metas</h2>
        </div>
        <div className="p-5 space-y-5 overflow-auto">
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
              Meta global do mês
            </label>
            <input
              type="number"
              value={metaGlobal}
              onChange={(e) => setMetaGlobal(e.target.value)}
              className="mt-1 w-full rounded-md gold-border bg-surface px-3 py-2 text-lg font-mono"
              min={0}
            />
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted mb-2">
              Metas por vendedor interno
            </div>
            <div className="space-y-2">
              {data.vendedores.map((v) => (
                <div key={v.vendedorId} className="flex items-center gap-3">
                  <div className="flex-1 text-sm">{v.nome}</div>
                  <input
                    type="number"
                    value={metasVend[v.vendedorId!] ?? ""}
                    onChange={(e) =>
                      setMetasVend((prev) => ({ ...prev, [v.vendedorId!]: e.target.value }))
                    }
                    className="w-40 rounded-md gold-border bg-surface px-3 py-1.5 text-sm font-mono text-right"
                    min={0}
                  />
                </div>
              ))}
              {data.vendedores.length === 0 && (
                <div className="text-xs text-text-muted">
                  Nenhum vendedor interno ativo cadastrado.
                </div>
              )}
            </div>
          </div>

          {Math.abs(diff) > 1 && data.vendedores.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Soma das metas individuais: {formatBRL(somaInd)} — {formatBRL(Math.abs(diff))}{" "}
              {diff > 0 ? "acima" : "abaixo"} da meta global.
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-xs uppercase tracking-wider text-text-secondary hover:text-text-primary"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={saving}
            className="rounded-md bg-gold px-4 py-2 text-xs uppercase tracking-wider text-background hover:bg-gold-light disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
