import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronRight, Pause, AlertTriangle, Circle,
  Building, Truck, CheckCircle, ArrowRight, MessageCircle,
  Copy, ExternalLink, Loader2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { CanalDialog } from "@/components/canal/CanalDialog";

export const Route = createFileRoute("/farol")({
  head: () => ({
    meta: [
      { title: "Farol de Pedidos — Fetély B2B" },
      { name: "description", content: "Acompanhamento de prazo de entrega." },
    ],
  }),
  component: FarolPage,
});

type SlaFaseRow = {
  estagio: string;
  ordem: number | null;
  tipo_sla: string | null;
  sla_dias: number | null;
};

type FarolRow = {
  pedido_id: string;
  id_externo: string | null;
  cliente: string | null;
  valor_liquido: number | null;
  estagio: string | null;
  status_label: string | null;
  data_estagio: string | null;
  expedido: boolean | null;
  data_pg: string | null;
  meta: string | null;
  eta_vivo: string | null;
  dias_vs_meta: number | null;
  prazo: string | null;
  bloqueio: string | null;
  pago_apos_expedicao: boolean | null;
  fase_gargalo: string | null;
  tempo_na_fase: number | null;
  sla_fase_atual: number | null;
  sla_cor: "verde" | "amarelo" | "vermelho" | null;
  fase_logistica: string | null;
};

const SLA_LABEL: Record<string, string> = {
  recebido: "Recebido",
  em_analise_credito: "Análise crédito",
  cobranca: "Cobrança",
  pre_separacao: "Pré-Separação",
  em_separacao: "Separação",
  pre_faturamento: "Pré-Faturamento",
  faturado: "Faturamento",
  em_transporte: "Transporte",
  entregue: "Entregue",
  aguardando_pagamento: "Aguardando pagamento",
  aguardando_estoque: "Aguardando estoque",
};

const ESTAGIO_LABEL: Record<string, string> = {
  recebido: "Recebido",
  em_analise_credito: "Análise crédito",
  cobranca: "Cobrança",
  pre_separacao: "Pré-Separação",
  em_separacao: "Separação",
  pre_faturamento: "Pré-Faturamento",
  faturado: "Faturamento",
  em_transporte: "Transporte",
};

const PRAZO_LABEL: Record<string, string> = {
  no_prazo: "No prazo",
  atrasado: "Atrasado",
  pausado: "— pausado",
  sem_dado: "—",
};

const BLOQUEIO_LABEL: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  aguardando_estoque: "Aguardando estoque",
};

const PRAZO_ORDER: Record<string, number> = {
  atrasado: 0,
  no_prazo: 1,
  sem_dado: 2,
  pausado: 3,
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DATA_FMT = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const DATA_CURTA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const COLS = 5;

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const p = new Date(d);
  return Number.isNaN(p.getTime()) ? "—" : DATA_FMT.format(p);
}

function fmtCurta(d: string | null): string {
  if (!d) return "—";
  const p = new Date(d);
  return Number.isNaN(p.getTime()) ? "—" : DATA_CURTA.format(p);
}

function prazoBadgeClass(prazo: string | null): string {
  switch (prazo) {
    case "atrasado":
      return "bg-red-100 text-red-800 hover:bg-red-100 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900";
    case "no_prazo":
      return "bg-green-100 text-green-800 hover:bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900";
    default:
      return "bg-muted text-muted-foreground hover:bg-muted border-border";
  }
}

const BLOQUEIO_BADGE =
  "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900";

// ─── B2C: tipos e helpers ───
type B2CRow = {
  shopify_id: string;
  order_name: string | null;
  created_at_shopify: string | null;
  estagio_derivado: string | null;
  financial_status: string | null;
  payment_method: string | null;
  total: number | null;
  paid_at: string | null;
  cancelled_at: string | null;
  fulfilled_at: string | null;
  shipping_province: string | null;
  shipping_city: string | null;
  wns_pedidowns: string | null;
  alerta: string | null;
  tracking_number: string | null;
  tracking_company: string | null;
  rastreio_status: string | null;
  rastreio_entregue: boolean | null;
};

type B2CSituacao = "no_prazo" | "atrasado" | "bloqueado";

function diasUteis(dataInicio: string | null): number {
  if (!dataInicio) return 0;
  const inicio = new Date(dataInicio);
  const hoje = new Date();
  let count = 0;
  const cur = new Date(inicio);
  while (cur < hoje) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function derivarSituacao(
  estagio: string | null,
  alerta: string | null,
  dias: number,
): B2CSituacao {
  if (alerta === "pago_sem_wns") return "bloqueado";
  if (estagio === "pago" && dias > 2) return "atrasado";
  if (estagio === "em_separacao" && dias > 5) return "atrasado";
  if (estagio === "expedido" && dias > 10) return "atrasado";
  return "no_prazo";
}

const B2C_ESTAGIO_LABEL: Record<string, string> = {
  pago: "Pago",
  em_separacao: "Em separação",
  expedido: "Expedido",
  em_transito: "Em trânsito",
  entregue: "Entregue",
};

const B2C_ESTAGIO_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pago: "secondary",
  em_separacao: "default",
  expedido: "outline",
  em_transito: "outline",
  entregue: "default",
};


function AbaB2B() {
  const [busca, setBusca] = useState("");
  const [filtroPrazo, setFiltroPrazo] = useState("todos");
  const [filtroBloqueio, setFiltroBloqueio] = useState("todos");

  const [canalTarget, setCanalTarget] = useState<{
    sncfPedidoId: string;
    numero: string;
    cliente: string;
  } | null>(null);

  const { data: badgesData } = useQuery({
    queryKey: ["canal_badges"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("enviar-para-sncf", {
        body: { tipo: "canal_badges" },
      });
      if (error) return {} as Record<string, number>;
      return (data?.badges ?? {}) as Record<string, number>;
    },
    refetchInterval: 60_000,
  });
  const badges: Record<string, number> = badgesData ?? {};

  const { data, isLoading, error } = useQuery({
    queryKey: ["farol_pedidos"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("enviar-para-sncf", {
        body: { tipo: "farol" },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Erro na ponte SNCF");
      return {
        pedidos: (data.pedidos ?? []) as FarolRow[],
        regua: (data.regua ?? []) as SlaFaseRow[],
      };
    },
  });

  const rows = data?.pedidos ?? [];
  const slaFases = data?.regua ?? [];

  const regua = useMemo(() => {
    const fases = slaFases.filter((f) => f.estagio in SLA_LABEL);
    const EXCLUIR_PREP = new Set(["em_separacao", "faturado", "em_transporte", "entregue"]);
    const internas = fases.filter(
      (f) => f.tipo_sla === "interno" && (f.sla_dias ?? 0) > 0 && !EXCLUIR_PREP.has(f.estagio),
    );
    const esperas = fases.filter((f) => f.tipo_sla === "espera_externa");
    const somaInternos = internas.reduce((acc, f) => acc + (f.sla_dias ?? 0), 0);
    const totalDias = somaInternos + 8;
    return { internas, esperas, somaInternos, totalDias };
  }, [slaFases]);

  const resumo = useMemo(() => {
    const r = {
      no_prazo: { count: 0, soma: 0 },
      atrasado: { count: 0, soma: 0 },
      bloqueado: { count: 0, soma: 0 },
    };
    for (const it of rows) {
      const v = Number(it.valor_liquido ?? 0);
      if (it.prazo === "no_prazo") { r.no_prazo.count++; r.no_prazo.soma += v; }
      if (it.prazo === "atrasado") { r.atrasado.count++; r.atrasado.soma += v; }
      if (it.bloqueio) { r.bloqueado.count++; r.bloqueado.soma += v; }
    }
    return r;
  }, [rows]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let arr = rows.filter((r) => {
      if (filtroPrazo !== "todos" && (r.prazo ?? "") !== filtroPrazo) return false;
      if (filtroBloqueio !== "todos" && filtroBloqueio !== "__qualquer__") {
        if (filtroBloqueio === "sem") { if (r.bloqueio) return false; }
        else if ((r.bloqueio ?? "") !== filtroBloqueio) return false;
      }
      if (filtroBloqueio === "__qualquer__" && !r.bloqueio) return false;
      if (q) {
        const hay = `${r.id_externo ?? ""} ${r.cliente ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    arr = [...arr].sort((a, b) => {
      const pa = PRAZO_ORDER[a.prazo ?? ""] ?? 99;
      const pb = PRAZO_ORDER[b.prazo ?? ""] ?? 99;
      if (pa !== pb) return pa - pb;
      const da = a.dias_vs_meta ?? -Infinity;
      const db = b.dias_vs_meta ?? -Infinity;
      if (da !== db) return db - da;
      return (a.bloqueio ? 1 : 0) - (b.bloqueio ? 1 : 0);
    });
    return arr;
  }, [rows, busca, filtroPrazo, filtroBloqueio]);

  type CardKey = "no_prazo" | "atrasado" | "bloqueado";
  const cardAtivo: CardKey | null =
    filtroPrazo === "no_prazo" ? "no_prazo"
    : filtroPrazo === "atrasado" ? "atrasado"
    : filtroBloqueio === "__qualquer__" ? "bloqueado"
    : null;

  function toggleCard(key: CardKey) {
    if (key === "no_prazo") {
      setFiltroPrazo(filtroPrazo === "no_prazo" ? "todos" : "no_prazo");
      setFiltroBloqueio("todos");
    } else if (key === "atrasado") {
      setFiltroPrazo(filtroPrazo === "atrasado" ? "todos" : "atrasado");
      setFiltroBloqueio("todos");
    } else {
      setFiltroBloqueio(cardAtivo === "bloqueado" ? "todos" : "__qualquer__");
      setFiltroPrazo("todos");
    }
  }

  const KpiCard = ({
    label, count, soma, tone, ativo, onClick, sufixo,
  }: {
    label: string; count: number; soma: number; tone: string;
    ativo: boolean; onClick: () => void; sufixo?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`text-left transition rounded-lg border ${ativo ? "ring-2 ring-gold border-gold" : "border-border hover:border-gold/50"} ${tone}`}
    >
      <Card className="border-0 bg-transparent shadow-none">
        <CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-[0.15em] text-text-secondary">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">{count}</p>
          <p className="text-xs text-text-secondary mt-0.5">
            {BRL.format(soma)}{sufixo ? ` ${sufixo}` : ""}
          </p>
        </CardContent>
      </Card>
    </button>
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 md:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display tracking-wider text-text-primary">Farol de Pedidos</h1>
        <p className="text-xs uppercase tracking-[0.15em] text-text-secondary mt-1">
          Acompanhamento de prazo de entrega (somente leitura)
        </p>
      </div>

      {/* Régua de SLA */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-gold">régua de prazos</p>
            <p className="text-xs text-text-secondary mt-1">
              Meta = data prometida, fixada quando o pedido chega
              {" · "}
              ETA = previsão atual, atualizada conforme o pedido avança
            </p>
          </div>

          <div className="overflow-x-auto"><div className="flex items-start gap-4 min-w-max">
            {/* Preparação interna */}
            <div>
              <p className="text-[11px] uppercase tracking-wider text-text-secondary flex items-center gap-1.5 mb-2">
                <Building className="h-3.5 w-3.5" /> preparação · ~{regua.somaInternos} d.u.
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {regua.internas.map((f, idx) => (
                  <div key={f.estagio} className="flex items-center gap-1.5">
                    <div className="rounded border border-border bg-surface px-2 py-1 text-[11px]">
                      <span className="text-text-primary">{SLA_LABEL[f.estagio] ?? f.estagio}</span>
                      <span className="text-text-secondary ml-1">{f.sla_dias} d.u.</span>
                    </div>
                    {idx < regua.internas.length - 1 && (
                      <ChevronRight className="h-3 w-3 text-text-secondary" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Logística */}
            <div>
              <p className="text-[11px] uppercase tracking-wider text-text-secondary flex items-center gap-1.5 mb-2">
                <Truck className="h-3.5 w-3.5" /> logística · ~8 d.u.
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: "Separando", sla: "1 d.u." },
                  { label: "Conf. / NF", sla: "1 d.u." },
                  { label: "Expedido", sla: "1 d.u." },
                  { label: "Em trânsito", sla: "~5 d.u. · real por CEP" },
                ].map((c, idx) => (
                  <div key={c.label} className="flex items-center gap-1.5">
                    <div className="rounded border border-border bg-surface px-2 py-1 text-[11px]">
                      <span className="text-text-primary">{c.label}</span>
                      <span className="text-text-secondary ml-1">{c.sla}</span>
                    </div>
                    {idx < 3 && <ArrowRight className="h-3 w-3 text-text-secondary" />}
                  </div>
                ))}
                <ChevronRight className="h-3 w-3 text-text-secondary" />
                <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Entregue
                </div>
              </div>
            </div>
          </div></div>

          <p className="text-[11px] text-text-secondary">
            prazo base ≈ {regua.totalDias} dias úteis = {regua.somaInternos} preparação + 8 logística · sábados e domingos não contam
          </p>

          {regua.esperas.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-2 border-t border-border">
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Pause className="h-3 w-3" /> pausam o relógio:
              </span>
              {regua.esperas.map((f) => (
                <span key={f.estagio} className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">
                  {SLA_LABEL[f.estagio] ?? f.estagio}
                </span>
              ))}
              <span className="text-text-secondary">dependem de terceiros, não contam no prazo</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard
          label="no prazo"
          count={resumo.no_prazo.count}
          soma={resumo.no_prazo.soma}
          tone="bg-emerald-500/5"
          ativo={cardAtivo === "no_prazo"}
          onClick={() => toggleCard("no_prazo")}
        />
        <KpiCard
          label="atrasado"
          count={resumo.atrasado.count}
          soma={resumo.atrasado.soma}
          tone="bg-red-500/5"
          ativo={cardAtivo === "atrasado"}
          onClick={() => toggleCard("atrasado")}
          sufixo="em risco"
        />
        <KpiCard
          label="bloqueado"
          count={resumo.bloqueado.count}
          soma={resumo.bloqueado.soma}
          tone="bg-amber-500/5"
          ativo={cardAtivo === "bloqueado"}
          onClick={() => toggleCard("bloqueado")}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="buscar por cliente ou nº pedido…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filtroPrazo} onValueChange={setFiltroPrazo}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">todos os prazos</SelectItem>
            <SelectItem value="no_prazo">no prazo</SelectItem>
            <SelectItem value="atrasado">atrasado</SelectItem>
            <SelectItem value="pausado">pausado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroBloqueio} onValueChange={setFiltroBloqueio}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">todos os bloqueios</SelectItem>
            <SelectItem value="aguardando_pagamento">aguardando pagamento</SelectItem>
            <SelectItem value="aguardando_estoque">aguardando estoque</SelectItem>
            <SelectItem value="sem">sem bloqueio</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-text-secondary ml-auto">
          {filtradas.length} pedido(s)
        </p>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>cliente</TableHead>
                <TableHead>estágio · desde</TableHead>
                <TableHead>prazo</TableHead>
                <TableHead>eta · meta</TableHead>
                <TableHead>situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: COLS }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={COLS} className="text-center text-red-500 py-8">
                    Erro ao carregar pedidos. Tente recarregar a página.
                  </TableCell>
                </TableRow>
              ) : filtradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLS} className="text-center text-text-secondary py-8">
                    Nenhum pedido encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtradas.map((r) => {
                  const dvm = r.dias_vs_meta;
                  const dvmColor =
                    r.prazo === "atrasado" ? "text-red-500"
                    : r.prazo === "no_prazo" ? "text-emerald-500"
                    : "text-text-secondary";
                  const dvmNode =
                    dvm === null || dvm === undefined ? null
                    : <span className={`${dvmColor} text-xs ml-1`}>{dvm > 0 ? `+${dvm}` : dvm}</span>;

                  let situacao: React.ReactNode = <span className="text-text-secondary">—</span>;
                  if (r.bloqueio) {
                    situacao = (
                      <Badge variant="outline" className={BLOQUEIO_BADGE}>
                        {BLOQUEIO_LABEL[r.bloqueio] ?? r.bloqueio}
                      </Badge>
                    );
                  } else if (r.pago_apos_expedicao) {
                    situacao = (
                      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" /> pago após expedição
                      </span>
                    );
                  } else if (r.sla_cor) {
                    const corClass =
                      r.sla_cor === "verde" ? "text-emerald-500"
                      : r.sla_cor === "amarelo" ? "text-amber-500"
                      : "text-red-500";
                    situacao = (
                      <span className={`flex items-center gap-1 text-xs ${corClass}`}>
                        <Circle className="h-2.5 w-2.5 fill-current" />
                        {r.tempo_na_fase ?? 0}d em {r.status_label ?? ESTAGIO_LABEL[r.estagio ?? ""] ?? "—"}
                      </span>
                    );
                  }

                  return (
                    <TableRow key={r.pedido_id}>
                      <TableCell>
                        <p className="text-sm text-text-primary">{r.cliente || "—"}</p>
                        <p className="text-[11px] text-text-secondary font-mono">{r.id_externo ?? "—"}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{r.status_label ?? "—"}</p>
                        <p className="text-[11px] text-text-secondary">
                          desde {fmtCurta(r.data_estagio)}
                          {r.pago_apos_expedicao && r.data_pg ? ` · pago ${fmtCurta(r.data_pg)}` : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Badge variant="outline" className={prazoBadgeClass(r.prazo)}>
                            {PRAZO_LABEL[r.prazo ?? ""] ?? "—"}
                          </Badge>
                          {dvmNode}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs">eta {fmtCurta(r.eta_vivo)}</p>
                        <p className="text-[11px] text-text-secondary">meta {fmtDate(r.meta)}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">{situacao}</div>
                          {r.pedido_id && (
                            <button
                              type="button"
                              onClick={() =>
                                setCanalTarget({
                                  sncfPedidoId: r.pedido_id,
                                  numero: r.id_externo ?? r.pedido_id.slice(0, 8).toUpperCase(),
                                  cliente: r.cliente ?? "—",
                                })
                              }
                              title={
                                badges[r.pedido_id]
                                  ? `${badges[r.pedido_id]} resposta(s) não lida(s) do SOPS`
                                  : "Canal com SOPS"
                              }
                              className="relative inline-flex items-center justify-center w-6 h-6 rounded border hover:bg-muted transition-colors shrink-0"
                              style={
                                badges[r.pedido_id]
                                  ? { color: "#185FA5", borderColor: "#85B7EB" }
                                  : {
                                      color: "var(--color-text-secondary)",
                                      borderColor: "var(--color-border-secondary)",
                                    }
                              }
                            >
                              <MessageCircle className="h-3 w-3" />
                              {(badges[r.pedido_id] ?? 0) > 0 && (
                                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                              )}
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canalTarget && (
        <CanalDialog
          open={!!canalTarget}
          onClose={() => setCanalTarget(null)}
          sncfPedidoId={canalTarget.sncfPedidoId}
          numeroPedido={canalTarget.numero}
          nomeCliente={canalTarget.cliente}
        />
      )}
    </div>
  );
}

// ─── Aba B2C ───
const B2C_ESTAGIOS: Array<string | null> = [null, "pago", "em_separacao", "expedido", "em_transito", "entregue"];

function AbaB2C() {
  const [busca, setBusca] = useState("");
  const [filtroEstagio, setFiltroEstagio] = useState<string | null>(null);
  const [filtroPrazo, setFiltroPrazo] = useState<B2CSituacao | null>(null);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["farol_b2c"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("enviar-para-sncf", {
        body: { tipo: "farol_b2c" },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Erro na ponte SNCF");
      return (data.pedidos ?? []) as B2CRow[];
    },
    staleTime: 60_000,
  });

  const enriquecidos = useMemo(
    () =>
      pedidos.map((p) => {
        const diasDesdePago = diasUteis(p.paid_at);
        const situacao = derivarSituacao(p.estagio_derivado, p.alerta, diasDesdePago);
        return { ...p, diasDesdePago, situacao };
      }),
    [pedidos],
  );

  const resumo = useMemo(() => {
    const r = {
      no_prazo: { count: 0, soma: 0 },
      atrasado: { count: 0, soma: 0 },
      bloqueado: { count: 0, soma: 0 },
    };
    for (const p of enriquecidos) {
      const v = Number(p.total ?? 0);
      r[p.situacao].count++;
      r[p.situacao].soma += v;
    }
    return r;
  }, [enriquecidos]);

  const contagemPorEstagio = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of enriquecidos) {
      const k = p.estagio_derivado ?? "";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [enriquecidos]);

  const filtrados = useMemo(() => {
    let arr = enriquecidos;
    if (filtroEstagio) arr = arr.filter((p) => p.estagio_derivado === filtroEstagio);
    if (filtroPrazo) arr = arr.filter((p) => p.situacao === filtroPrazo);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      arr = arr.filter((p) => (p.order_name ?? "").toLowerCase().includes(q));
    }
    return [...arr].sort((a, b) => {
      const aAtraso = a.situacao === "atrasado" ? 0 : 1;
      const bAtraso = b.situacao === "atrasado" ? 0 : 1;
      if (aAtraso !== bAtraso) return aAtraso - bAtraso;
      return b.diasDesdePago - a.diasDesdePago;
    });
  }, [enriquecidos, filtroEstagio, filtroPrazo, busca]);

  function togglePrazo(s: B2CSituacao) {
    setFiltroPrazo((cur) => (cur === s ? null : s));
  }
  function toggleEstagio(e: string | null) {
    if (e === null) {
      setFiltroEstagio(null);
      return;
    }
    setFiltroEstagio((cur) => (cur === e ? null : e));
  }

  return (
    <div className="space-y-6">
      {/* Régua de prazos */}
      <div className="rounded-lg border bg-muted/40 p-4">
        <div className="text-sm font-semibold mb-1">Régua de prazos B2C</div>
        <div className="text-xs text-muted-foreground mb-3">
          Meta = dias desde pagamento confirmado (T0)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            "SHOPIFY",
            "Pago · T0",
            "Em separação · 1-2d",
            "Expedido · 1d",
            "Em trânsito · ~Xd CEP",
            "✓ Entregue",
          ].map((chip, i, arr) => (
            <div key={chip} className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md border bg-background px-2 py-1 text-xs gap-1">
                {chip}
              </span>
              {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-3">
          prazo base ≈ 2 dias úteis preparo + trânsito por CEP
        </div>
        <div className="text-xs text-muted-foreground">
          pausam o relógio: pedidos sem WNS vinculado (pago_sem_wns)
        </div>
      </div>

      {/* Mini-pipeline clicável */}
      <div className="flex flex-wrap gap-2">
        {B2C_ESTAGIOS.map((e) => {
          const ativo = filtroEstagio === e;
          const label = e === null ? "Todos" : (B2C_ESTAGIO_LABEL[e] ?? e);
          const count = e === null ? enriquecidos.length : (contagemPorEstagio.get(e) ?? 0);
          return (
            <button
              key={e ?? "todos"}
              onClick={() => toggleEstagio(e)}
              className={
                "inline-flex items-center rounded-md px-3 py-1 text-xs gap-2 transition " +
                (ativo
                  ? "bg-primary text-primary-foreground"
                  : "border bg-background hover:bg-muted")
              }
            >
              <span>{label}</span>
              <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {([
          { key: "no_prazo" as const, titulo: "No prazo", border: "border-green-200 bg-green-50", sufixo: "" },
          { key: "atrasado" as const, titulo: "Atrasado", border: "border-red-200 bg-red-50", sufixo: " em risco" },
          { key: "bloqueado" as const, titulo: "Bloqueados", border: "border-amber-200 bg-amber-50", sufixo: "" },
        ]).map(({ key, titulo, border, sufixo }) => {
          const ativo = filtroPrazo === key;
          return (
            <button
              key={key}
              onClick={() => togglePrazo(key)}
              className={
                "rounded-lg border p-4 text-left transition " +
                border +
                (ativo ? " ring-2 ring-offset-1 ring-foreground/40" : "")
              }
            >
              <div className="text-sm text-muted-foreground">{titulo}</div>
              <div className="text-3xl font-semibold mt-1">{resumo[key].count}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {BRL.format(resumo[key].soma)}{sufixo}
              </div>
            </button>
          );
        })}
      </div>

      {/* Busca */}
      <Input
        placeholder="buscar por pedido..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="max-w-xs"
      />

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando pedidos B2C...</span>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum pedido B2C ativo.</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente / Pedido</TableHead>
                <TableHead>Estágio · desde</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Rastreio</TableHead>
                <TableHead>Status rastreio</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((p) => {
                const estagio = p.estagio_derivado ?? "";
                const labelEstagio = B2C_ESTAGIO_LABEL[estagio] ?? estagio ?? "—";
                const variantEstagio = B2C_ESTAGIO_BADGE[estagio] ?? "outline";
                const desdeBase =
                  estagio === "pago" || estagio === "em_separacao" ? p.paid_at : p.fulfilled_at;
                const rastreioStatus = p.rastreio_status ?? "";
                return (
                  <TableRow key={p.shopify_id}>
                    <TableCell>
                      <div className="font-semibold">{p.order_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {[p.shipping_city, p.shipping_province].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={variantEstagio}>{labelEstagio}</Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        desde {fmtCurta(desdeBase)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xl font-semibold">{p.diasDesdePago}</div>
                      <div className="text-xs text-muted-foreground">d.u. desde pgto</div>
                    </TableCell>
                    <TableCell>{BRL.format(Number(p.total ?? 0))}</TableCell>
                    <TableCell>{p.payment_method ?? "—"}</TableCell>
                    <TableCell>
                      {p.tracking_number ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{p.tracking_number}</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(p.tracking_number!)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Copiar"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <a
                            href="https://rastreamento.correios.com.br/app/index.php"
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            title="Abrir rastreamento"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {p.rastreio_entregue === true ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                          Entregue
                        </Badge>
                      ) : rastreioStatus ? (
                        <span className="text-xs text-muted-foreground">
                          {rastreioStatus.length > 30
                            ? rastreioStatus.slice(0, 30) + "…"
                            : rastreioStatus}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {p.situacao === "atrasado" ? (
                        <div className="flex items-center gap-1 text-red-600 text-sm">
                          <AlertTriangle className="h-4 w-4" />
                          <span>{p.diasDesdePago}d sem avanço</span>
                        </div>
                      ) : p.situacao === "bloqueado" ? (
                        <div className="flex items-center gap-1 text-amber-700 text-sm">
                          <Pause className="h-4 w-4" />
                          <span>Sem WNS</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-green-600 text-sm">
                          <Circle className="h-4 w-4" />
                          <span>no prazo</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Wrapper com tab switcher ───
function FarolPage() {
  const [aba, setAba] = useState<"b2b" | "b2c">("b2b");
  return (
    <div className="space-y-4">
      <div className="border-b">
        <div className="flex gap-6">
          {(["b2b", "b2c"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setAba(t)}
              className={
                "px-1 py-3 text-sm font-medium border-b-2 -mb-px transition " +
                (aba === t
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t === "b2b" ? "B2B" : "B2C"}
            </button>
          ))}
        </div>
      </div>
      {aba === "b2b" ? <AbaB2B /> : <AbaB2C />}
    </div>
  );
}

