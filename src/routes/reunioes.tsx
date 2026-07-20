import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link as LinkIcon, MessageCircle, Copy, QrCode, Trash2, CheckCircle2, Eye, ArrowRight, X, AlertTriangle, Clock, Activity, MessageSquareText, Check, ChevronDown, ChevronRight, Users } from "lucide-react";

import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/store/authStore";
import { usePreSelecao, usePreSelecoesEscopo } from "@/store/preSelecaoStore";
import { useCatalog } from "@/store/catalogStore";
import { useCotacao } from "@/store/cotacaoStore";
import { STATUS_PRE_LABEL, SEGMENTO_LABEL, type StatusPreSelecao, type PreSelecao } from "@/types/preSelecao";
import type { CartItem, OrderMeta } from "@/types";
import { formatBRL } from "@/lib/format";
import { tempoRestante, PUBLIC_SITE_URL } from "@/lib/preSelecao";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSessoesCatalogo, ESTADO_SESSAO_LABEL, type SessaoRow, type EstadoSessao } from "@/lib/sessoesCatalogo";

export const Route = createFileRoute("/reunioes")({
  head: () => ({
    meta: [{ title: "Reuniões — Fetély B2B" }],
  }),
  component: ReunioesPage,
});

const TABS: { key: StatusPreSelecao | "todas"; label: string }[] = [
  { key: "nova", label: "Novas" },
  { key: "visualizada", label: "Visualizadas" },
  { key: "em_contato", label: "Em contato" },
  { key: "convertida", label: "Convertidas" },
  { key: "todas", label: "Todas" },
];

/** Grupo consolidado de sessões da mesma pessoa/dispositivo. */
interface SessaoGrupo {
  key: string;
  latest: SessaoRow;
  historico: SessaoRow[]; // ordenado desc por ultimo_evento (inclui a latest)
  acessos: number;
  primeiroAcesso: string | null;
}

/** Agrupa por telefone (WhatsApp) OU (nome normalizado + device_id) OU device_id sozinho. */
function agruparSessoes(rows: SessaoRow[]): SessaoGrupo[] {
  const normNome = (s: string | null) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const digits = (s: string | null) => (s ?? "").replace(/\D/g, "");
  const keyOf = (s: SessaoRow): string => {
    const wa = digits(s.whatsapp);
    if (wa.length >= 10) return `wa:${wa}`;
    const nm = normNome(s.nome);
    const dv = (s.device_id ?? "").trim();
    if (nm && dv) return `nd:${nm}|${dv}`;
    if (dv) return `d:${dv}`;
    return `s:${s.id}`;
  };
  const map = new Map<string, SessaoRow[]>();
  for (const r of rows) {
    const k = keyOf(r);
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  const grupos: SessaoGrupo[] = [];
  for (const [key, arr] of map) {
    const historico = [...arr].sort((a, b) =>
      (b.ultimo_evento ?? b.created_at) < (a.ultimo_evento ?? a.created_at) ? -1 : 1,
    );
    const latest = historico[0];
    const primeiro = arr.reduce<string | null>((min, r) => {
      const t = r.primeiro_acesso ?? r.created_at;
      if (!min || t < min) return t;
      return min;
    }, null);
    grupos.push({ key, latest, historico, acessos: arr.length, primeiroAcesso: primeiro });
  }
  grupos.sort((a, b) => (b.latest.ultimo_evento ?? "") < (a.latest.ultimo_evento ?? "") ? -1 : 1);
  return grupos;
}


function ReunioesPage() {
  const hydrate = usePreSelecao((s) => s.hydrate);
  const refresh = usePreSelecao((s) => s.refresh);
  const session = useAuth((s) => s.session);
  const profile = useAuth((s) => s.profile);
  const [sessoesTick, setSessoesTick] = useState(0);
  useEffect(() => { hydrate(); }, [hydrate, session?.user.id, profile?.id]);
  useEffect(() => {
    if (!session) return;
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
      setSessoesTick((t) => t + 1);
    }, 10000);
    const onFocus = () => {
      void refresh();
      setSessoesTick((t) => t + 1);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, session]);

  const { rows: sessoes } = useSessoesCatalogo(sessoesTick);

  const todas = usePreSelecoesEscopo();
  const [panel, setPanel] = useState<"presel" | "sessoes">("presel");
  const [tab, setTab] = useState<StatusPreSelecao | "todas">("nova");
  const [sessaoTab, setSessaoTab] = useState<"todas" | "abandonado" | "aberto" | "montando" | "identificado" | "anonimo">("todas");
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<PreSelecao | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const filtradas = useMemo(() => {
    let out = todas;
    if (tab !== "todas") out = out.filter((p) => p.status === tab);
    const q = busca.trim().toLowerCase();
    if (q) {
      out = out.filter((p) =>
        `${p.nomeFantasia} ${p.razaoSocial} ${p.cnpj} ${p.contatoNome} ${p.id}`.toLowerCase().includes(q),
      );
    }
    return out.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1));
  }, [todas, tab, busca]);

  const kpis = useMemo(() => {
    const novas = todas.filter((p) => p.status === "nova").length;
    const valorPotencial = todas
      .filter((p) => ["nova", "visualizada", "em_contato"].includes(p.status))
      .reduce((s, p) => s + p.totalVarejoRef, 0);
    const convertidas = todas.filter((p) => p.status === "convertida").length;
    const total = todas.length || 1;
    return { novas, valorPotencial, taxa: Math.round((convertidas / total) * 100) };
  }, [todas]);

  const sessoesGrupos = useMemo(() => agruparSessoes(sessoes), [sessoes]);

  const sessoesKpis = useMemo(() => {
    let abandonoForm = 0;
    let ativos = 0;
    let acessos = 0;
    for (const g of sessoesGrupos) {
      const e = g.latest.estado_derivado;
      if (e === "formulario_abandonado") abandonoForm++;
      else if (e === "formulario_aberto" || e === "montando") ativos++;
      else if (e === "acessou" || e === "montagem_abandonada") acessos++;
    }
    return { abandonoForm, ativos, acessos };
  }, [sessoesGrupos]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todas: todas.length };
    for (const p of todas) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [todas]);

  const classifyGrupo = (g: SessaoGrupo): "abandonado" | "aberto" | "montando" | "identificado" | "anonimo" => {
    const e = g.latest.estado_derivado;
    if (e === "formulario_abandonado") return "abandonado";
    if (e === "formulario_aberto") return "aberto";
    if ((g.latest.qtd_itens ?? 0) >= 1 || e === "montando") return "montando";
    if (g.latest.identificado_gate) return "identificado";
    return "anonimo";
  };

  const sessoesFiltradas = useMemo(() => {
    let out = sessoesGrupos;
    if (sessaoTab !== "todas") {
      out = out.filter((g) => classifyGrupo(g) === sessaoTab);
    }
    const q = busca.trim().toLowerCase();
    if (q) {
      out = out.filter((g) =>
        g.historico.some((s) =>
          `${s.nome ?? ""} ${s.whatsapp ?? ""} ${s.razao_social ?? ""} ${s.cnpj ?? ""}`.toLowerCase().includes(q),
        ),
      );
    }
    return out;
  }, [sessoesGrupos, sessaoTab, busca]);

  const sessoesCounts = useMemo(() => {
    const c = { todas: sessoesGrupos.length, abandonado: 0, aberto: 0, montando: 0, identificado: 0, anonimo: 0 };
    for (const g of sessoesGrupos) {
      c[classifyGrupo(g)]++;
    }
    return c;
  }, [sessoesGrupos]);


  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-6">
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl">Reuniões</h1>
          <p className="text-sm text-text-secondary">Jornada dos clientes no catálogo público</p>
        </div>
        <div className="md:ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setLinkModalOpen(true)}>
            <LinkIcon className="h-4 w-4" />
            Gerar meu link
          </Button>
        </div>
      </div>

      {/* Alerta crítico: formulários abandonados */}
      {sessoesKpis.abandonoForm > 0 && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-red-500">
              {sessoesKpis.abandonoForm} formulário{sessoesKpis.abandonoForm > 1 ? "s" : ""} abandonado{sessoesKpis.abandonoForm > 1 ? "s" : ""}
            </div>
            <div className="text-xs text-text-secondary">
              Cliente abriu o formulário, preencheu algo, mas não enviou. Recupere pelo WhatsApp.
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-red-500/40 text-red-500 hover:bg-red-500/10"
            onClick={() => { setPanel("sessoes"); setSessaoTab("abandonado"); }}
          >
            Ver abandonos
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KpiCard label="Novas" value={String(kpis.novas)} accent={kpis.novas > 0} />
        <KpiCard label="Form. abandonado" value={String(sessoesKpis.abandonoForm)} danger={sessoesKpis.abandonoForm > 0} />
        <KpiCard label="Em andamento" value={String(sessoesKpis.ativos)} />
        <KpiCard label="Valor ref. potencial" value={formatBRL(kpis.valorPotencial)} />
        <KpiCard label="Taxa de conversão" value={`${kpis.taxa}%`} />
      </div>

      {/* Switch entre pré-seleções (enviadas) e sessões (jornada) */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        <PanelTab active={panel === "presel"} onClick={() => setPanel("presel")} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
          Pré-seleções enviadas ({todas.length})
        </PanelTab>
        <PanelTab active={panel === "sessoes"} onClick={() => setPanel("sessoes")} icon={<Activity className="h-3.5 w-3.5" />} highlight={sessoesKpis.abandonoForm > 0}>
          Em andamento ({sessoesGrupos.length})
          {sessoesKpis.abandonoForm > 0 && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
        </PanelTab>
      </div>

      {panel === "presel" ? (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs uppercase tracking-wider border transition",
                tab === t.key
                  ? "bg-gold text-background border-gold"
                  : "border-border text-text-secondary hover:border-gold/40 hover:text-gold",
              )}
            >
              {t.label} {counts[t.key] > 0 && <span className="opacity-70">({counts[t.key]})</span>}
              {t.key === "nova" && counts["nova"] > 0 && <span className="inline-block ml-1 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
            </button>
          ))}
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa, CNPJ..."
            className="ml-auto max-w-xs h-9"
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {([
            { key: "todas", label: "Todas" },
            { key: "abandonado", label: "Formulário abandonado", danger: true },
            { key: "aberto", label: "Preenchendo" },
            { key: "montando", label: "Montando" },
            { key: "acessou", label: "Só acessou" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setSessaoTab(t.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs uppercase tracking-wider border transition",
                sessaoTab === t.key
                  ? "danger" in t
                    ? "bg-red-500 text-white border-red-500"
                    : "bg-gold text-background border-gold"
                  : "danger" in t && sessoesCounts.abandonado > 0
                  ? "border-red-500/40 text-red-500 hover:bg-red-500/10"
                  : "border-border text-text-secondary hover:border-gold/40 hover:text-gold",
              )}
            >
              {t.label} <span className="opacity-70">({sessoesCounts[t.key]})</span>
            </button>
          ))}
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome, WhatsApp, CNPJ..."
            className="ml-auto max-w-xs h-9"
          />
        </div>
      )}

      {panel === "sessoes" && (
        <SessoesTable rows={sessoesFiltradas} vendedorNome={profile?.nome_completo ?? ""} />
      )}

      {panel === "presel" && (

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wider text-text-secondary">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Empresa</th>
              <th className="text-left px-3 py-2">Vendedor</th>
              <th className="text-left px-3 py-2">Itens</th>
              <th className="text-left px-3 py-2">Ref. Varejo</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Expira em</th>
              <th></th>

            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-text-secondary text-sm">
                  Nenhuma pré-seleção nesta aba.
                </td>
              </tr>
            ) : (
              filtradas.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-border hover:bg-surface-hover cursor-pointer"
                  onClick={() => setSelecionada(p)}
                >
                  <td className="px-3 py-3 font-mono text-xs">{p.id}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{p.nomeFantasia}</div>
                    <div className="text-xs text-text-secondary">{p.cidadeEstado} · {SEGMENTO_LABEL[p.segmento]}</div>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {p.vendedorNome || p.vendedorId ? (
                      <span className="text-text-primary uppercase tracking-wider">
                        {p.vendedorNome || p.vendedorId}
                      </span>
                    ) : (
                      <span className="text-text-muted italic">sem vendedor</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {p.totalItens} · {p.totalUnidades} un
                  </td>
                  <td className="px-3 py-3 text-gold">{formatBRL(p.totalVarejoRef)}</td>
                  <td className="px-3 py-3">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="px-3 py-3 text-xs text-text-secondary">{tempoRestante(p)}</td>
                  <td className="px-3 py-3">
                    <Eye className="h-4 w-4 text-text-muted" />
                  </td>
                </tr>
              ))
            )}

          </tbody>
        </table>
      </div>
      )}



      <Sheet open={!!selecionada} onOpenChange={(v) => !v && setSelecionada(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          {selecionada && (
            <PreSelecaoDetail
              pre={selecionada}
              onClose={() => setSelecionada(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <GerarLinkModal open={linkModalOpen} onOpenChange={setLinkModalOpen} />
    </div>
  );
}

function KpiCard({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <Card className={cn(danger && "border-red-500/40 bg-red-500/5")}>
      <CardContent className="p-4">
        <div className={cn("text-[10px] uppercase tracking-widest", danger ? "text-red-500" : "text-text-secondary")}>{label}</div>
        <div className={cn("mt-1 font-display text-2xl", (accent || danger) && "text-red-500")}>{value}</div>
      </CardContent>
    </Card>
  );
}

function PanelTab({
  active,
  onClick,
  icon,
  highlight,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-2 text-sm inline-flex items-center gap-1.5 border-b-2 -mb-px transition",
        active
          ? highlight
            ? "border-red-500 text-red-500"
            : "border-gold text-gold"
          : "border-transparent text-text-secondary hover:text-text-primary",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function SessoesTable({ rows, vendedorNome }: { rows: SessaoGrupo[]; vendedorNome: string }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-xs uppercase tracking-wider text-text-secondary">
          <tr>
            <th className="w-8 px-2 py-2"></th>
            <th className="text-left px-3 py-2">Cliente</th>
            <th className="text-left px-3 py-2">WhatsApp</th>
            <th className="text-left px-3 py-2">Acessos</th>
            <th className="text-left px-3 py-2">Itens</th>
            <th className="text-left px-3 py-2">Valor (atacado)</th>
            <th className="text-left px-3 py-2">Estado</th>
            <th className="text-left px-3 py-2">Último evento</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center py-12 text-text-secondary text-sm">
                Nenhuma sessão nesta aba.
              </td>
            </tr>
          ) : (
            rows.map((g) => <SessaoRowView key={g.key} grupo={g} vendedorNome={vendedorNome} />)
          )}
        </tbody>
      </table>
    </div>
  );
}

function SessaoRowView({ grupo, vendedorNome }: { grupo: SessaoGrupo; vendedorNome: string }) {
  const s = grupo.latest;
  const abandonado = s.estado_derivado === "formulario_abandonado";
  const nome = s.nome ?? s.razao_social ?? "— (não identificado)";
  const ultimo = s.ultimo_evento ? new Date(s.ultimo_evento) : null;
  const rel = ultimo ? relativeTime(ultimo) : "—";
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [aberto, setAberto] = useState(false);
  const temHistorico = grupo.acessos > 1;

  const digits = (s.whatsapp ?? "").replace(/\D/g, "");

  function recuperar() {
    if (!digits) {
      toast.error("Sessão sem WhatsApp — cliente não completou o gate.");
      return;
    }
    const nomeMsg = s.nome ? `, ${s.nome}` : "";
    const assinatura = vendedorNome ? ` — ${vendedorNome}` : "";
    const msg = abandonado
      ? `Olá${nomeMsg}! Vi que você começou a preencher o formulário do nosso catálogo mas talvez tenha ficado alguma dúvida. Posso te ajudar a finalizar?${assinatura}`
      : `Olá${nomeMsg}! Vi que você está montando sua lista no nosso catálogo. Precisa de ajuda com algum produto?${assinatura}`;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noreferrer");
  }

  return (
    <>
      <tr className={cn("border-t border-border", abandonado && "bg-red-500/5")}>
        <td className="px-2 py-3 align-top">
          {temHistorico ? (
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              className="p-1 rounded hover:bg-surface-2 text-text-secondary"
              aria-label={aberto ? "Recolher histórico" : "Expandir histórico"}
            >
              {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : null}
        </td>
        <td className="px-3 py-3">
          <div className="font-medium">{nome}</div>
          <div className="text-xs text-text-secondary">
            {s.identificado_gate ? "identificado no gate" : "anônimo"}
            {s.cnpj && ` · ${s.cnpj}`}
          </div>
        </td>
        <td className="px-3 py-3 text-xs">{s.whatsapp || <span className="text-text-muted italic">—</span>}</td>
        <td className="px-3 py-3 text-xs">
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border",
            grupo.acessos > 1 ? "border-gold/40 text-gold bg-gold/5" : "border-border text-text-secondary",
          )}>
            <Users className="h-3 w-3" /> {grupo.acessos}
          </span>
        </td>
        <td className="px-3 py-3 text-xs">{s.qtd_itens ?? 0}</td>
        <td className="px-3 py-3 text-xs text-gold">{formatBRL(Number(s.valor_wishlist ?? 0))}</td>
        <td className="px-3 py-3">
          <EstadoPill estado={s.estado_derivado} />
        </td>
        <td className="px-3 py-3 text-xs text-text-secondary">
          <div className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {rel}
          </div>
        </td>
        <td className="px-3 py-3">
          {s.whatsapp && (
            <div className="inline-flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTemplatesOpen(true)}
                title="Mensagens sugeridas para esta etapa"
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                Mensagens
              </Button>
              <Button
                size="sm"
                variant={abandonado ? "default" : "outline"}
                className={cn(abandonado && "bg-red-500 hover:bg-red-600 text-white")}
                onClick={recuperar}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {abandonado ? "Recuperar" : "WhatsApp"}
              </Button>
            </div>
          )}
          <MensagensSugeridasDialog
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            estado={s.estado_derivado}
            nomeCliente={s.nome ?? null}
            whatsappDigits={digits}
            vendedorNome={vendedorNome}
            qtdItens={s.qtd_itens ?? 0}
            valor={Number(s.valor_wishlist ?? 0)}
          />
        </td>
      </tr>
      {aberto && temHistorico && (
        <tr className="border-t border-border bg-surface-2/40">
          <td colSpan={9} className="px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary mb-2">
              Histórico de acessos ({grupo.acessos})
            </div>
            <ul className="space-y-1.5">
              {grupo.historico.map((h) => (
                <li key={h.id} className="flex items-center gap-3 text-xs">
                  <Clock className="h-3 w-3 text-text-muted shrink-0" />
                  <span className="text-text-secondary w-32 shrink-0">
                    {h.ultimo_evento ? new Date(h.ultimo_evento).toLocaleString("pt-BR") : "—"}
                  </span>
                  <EstadoPill estado={h.estado_derivado} />
                  <span className="text-text-muted">
                    {h.qtd_itens ?? 0} {(h.qtd_itens ?? 0) === 1 ? "item" : "itens"}
                    {Number(h.valor_wishlist ?? 0) > 0 && ` · ${formatBRL(Number(h.valor_wishlist))}`}
                  </span>
                  {!h.identificado_gate && (
                    <span className="text-[10px] text-text-muted italic">anônimo</span>
                  )}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}


function EstadoPill({ estado }: { estado: EstadoSessao }) {
  const cls: Record<EstadoSessao, string> = {
    acessou: "bg-muted text-text-muted border-border",
    montando: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    montagem_abandonada: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    formulario_aberto: "bg-purple-500/15 text-purple-500 border-purple-500/30",
    formulario_abandonado: "bg-red-500/15 text-red-500 border-red-500/30",
    enviada: "bg-green-500/15 text-green-600 border-green-500/30",
    em_contato: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    convertida: "bg-green-500/15 text-green-600 border-green-500/30",
    expirada: "bg-muted text-text-muted border-border",
    descartada: "bg-muted text-text-muted border-border",
  };
  return (
    <span className={cn("inline-flex px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full border", cls[estado])}>
      {ESTADO_SESSAO_LABEL[estado]}
    </span>
  );
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  return `há ${dias} d`;
}

function StatusPill({ status }: { status: StatusPreSelecao }) {
  const cls: Record<StatusPreSelecao, string> = {
    nova: "bg-red-500/15 text-red-500 border-red-500/30",
    visualizada: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    em_contato: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    convertida: "bg-green-500/15 text-green-600 border-green-500/30",
    expirada: "bg-muted text-text-muted border-border",
    descartada: "bg-muted text-text-muted border-border",
  };
  return (
    <span className={cn("inline-flex px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full border", cls[status])}>
      {STATUS_PRE_LABEL[status]}
    </span>
  );
}

function PreSelecaoDetail({ pre, onClose }: { pre: PreSelecao; onClose: () => void }) {
  const marcarVisualizada = usePreSelecao((s) => s.marcarVisualizada);
  const atualizarStatus = usePreSelecao((s) => s.atualizarStatus);
  const vincularCotacao = usePreSelecao((s) => s.vincularCotacao);
  const descartar = usePreSelecao((s) => s.descartar);
  const catalogProducts = useCatalog((s) => s.products);
  const criarCotacao = useCotacao((s) => s.criarCotacao);
  const profile = useAuth((s) => s.profile);
  const [convertendo, setConvertendo] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (pre.status === "nova") marcarVisualizada(pre.id);
  }, [pre.id, pre.status, marcarVisualizada]);


  function whatsappLink() {
    const num = pre.contatoWhatsapp.replace(/\D/g, "");
    const msg = `Olá ${pre.contatoNome}! Recebemos sua pré-seleção #${pre.id} com ${pre.totalItens} produtos. Vamos conversar?`;
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  }

  function copiarLista() {
    const linhas = pre.itens.map((i) =>
      i.temInteresseSemQtd
        ? `♡ ${i.nomeComercial} (${i.corNome}) — interesse sem qtd`
        : `• ${i.quantidade} un · ${i.nomeComercial} (${i.corNome}) — ${formatBRL(i.subtotalVarejo)}`,
    );
    const texto = `Pré-seleção #${pre.id}\n${pre.nomeFantasia}\n\n${linhas.join("\n")}\n\nRef. varejo: ${formatBRL(pre.totalVarejoRef)}`;
    navigator.clipboard.writeText(texto);
    toast.success("Lista copiada");
  }

  async function converterEmCotacao() {
    if (convertendo) return;
    const itensComQtd = pre.itens.filter((i) => !i.temInteresseSemQtd && i.quantidade > 0);
    const itensInteresse = pre.itens.filter((i) => i.temInteresseSemQtd || i.quantidade <= 0);
    if (itensComQtd.length === 0 && itensInteresse.length === 0) {
      toast.error("Pré-seleção sem itens para converter");
      return;
    }
    const cartItems: CartItem[] = [];
    const naoEncontrados: string[] = [];
    const interesseIncluidos: string[] = [];
    for (const it of itensComQtd) {
      const product = catalogProducts.find((p) => p.sku === it.sku);
      if (!product) {
        naoEncontrados.push(it.sku);
        continue;
      }
      cartItems.push({ sku: product.sku, product, quantity: it.quantidade });
    }
    // Itens de interesse (sem qtd): entram como 1 un p/ validar com o cliente
    for (const it of itensInteresse) {
      const product = catalogProducts.find((p) => p.sku === it.sku);
      if (!product) {
        naoEncontrados.push(it.sku);
        continue;
      }
      cartItems.push({
        sku: product.sku,
        product,
        quantity: 1,
        justificativaNegociacao: "Item marcado como interesse (sem qtd) na pré-seleção — validar quantidade com o cliente.",
      });
      interesseIncluidos.push(`${product.sku} · ${it.nomeComercial} (${it.corNome})`);
    }
    if (cartItems.length === 0) {
      toast.error("Nenhum SKU da pré-seleção foi encontrado no catálogo atual");
      return;
    }
    const total = cartItems.reduce((s, i) => s + i.product.precoAtacado * i.quantity, 0);
    const blocoInteresse = interesseIncluidos.length > 0
      ? `\n\n⚠ Itens de INTERESSE (entraram como 1 un — confirmar quantidade com o cliente):\n- ${interesseIncluidos.join("\n- ")}`
      : "";
    const meta: OrderMeta = {
      cliente: pre.razaoSocial || pre.nomeFantasia,
      cnpj: pre.cnpj,
      condicaoPagamento: "",
      observacoes: `Origem: Pré-seleção #${pre.id} (${pre.contatoNome})${pre.observacao ? ` · ${pre.observacao}` : ""}${blocoInteresse}`,
      vendedor: profile?.nome_completo ?? profile?.email ?? "—",
      nomeFantasia: pre.nomeFantasia,
      email: pre.contatoEmail,
      telefone: pre.contatoWhatsapp,
      municipio: pre.cidadeEstado,
      pedidoOrigem: "direto",
    };
    setConvertendo(true);
    try {
      const cot = await criarCotacao({ items: cartItems, meta, total });
      vincularCotacao(pre.id, cot.id);
      const partes: string[] = [`Cotação ${cot.id} criada`];
      if (interesseIncluidos.length > 0) partes.push(`${interesseIncluidos.length} item(ns) de interesse como 1 un`);
      if (naoEncontrados.length > 0) partes.push(`${naoEncontrados.length} SKU(s) fora do catálogo ignorados`);
      if (interesseIncluidos.length > 0 || naoEncontrados.length > 0) {
        toast.warning(partes.join(" · "));
      } else {
        toast.success(partes[0]);
      }
      onClose();
      navigate({ to: "/cotacoes" });
    } catch (e) {
      console.error("[reunioes] converter em cotação falhou", e);
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a cotação");
    } finally {
      setConvertendo(false);
    }
  }



  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div>
          <div className="text-xs text-text-secondary">#{pre.id}</div>
          <h2 className="font-display text-xl">{pre.nomeFantasia}</h2>
          <div className="text-xs text-text-secondary">{pre.razaoSocial}</div>
        </div>
        <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <h3 className="text-xs uppercase tracking-wider text-gold-muted mb-2">Empresa</h3>
          <dl className="text-sm space-y-1">
            <Row k="CNPJ" v={pre.cnpj} />
            <Row k="Segmento" v={SEGMENTO_LABEL[pre.segmento]} />
            <Row k="Cidade" v={pre.cidadeEstado} />
            <Row k="Contato" v={`${pre.contatoNome}${pre.contatoCargo ? ` (${pre.contatoCargo})` : ""}`} />
            <Row k="WhatsApp" v={pre.contatoWhatsapp} />
            <Row k="E-mail" v={pre.contatoEmail} />
            <Row k="Vendedor" v={pre.vendedorNome || pre.vendedorId || "— (link sem vendedor)"} />
            <Row k="Atribuído a" v={pre.atribuidoParaVendedorId ? "vendedor logado (travado)" : "— (livre no pool)"} />
            <Row k="Expira" v={tempoRestante(pre)} />
          </dl>
          {pre.observacao && (
            <div className="mt-3 p-3 bg-surface-2 rounded-md text-sm italic text-text-secondary">
              "{pre.observacao}"
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xs uppercase tracking-wider text-gold-muted mb-2">
            Lista de interesse ({pre.totalItens} itens · {pre.totalUnidades} un)
          </h3>
          <ul className="divide-y divide-border rounded-md border border-border">
            {pre.itens.map((i, idx) => (
              <li key={idx} className="px-3 py-2 text-sm flex gap-2">
                <div className="w-8 text-center text-xs text-gold-muted uppercase tracking-wider">
                  {i.temInteresseSemQtd ? "♡" : i.colecao.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{i.nomeComercial}</div>
                  <div className="text-xs text-text-secondary">
                    {i.corNome}{i.tamanhoNumero && ` · ${i.tamanhoNumero}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    {i.temInteresseSemQtd ? <span className="text-gold text-xs">sem qtd</span> : `${i.quantidade} un`}
                  </div>
                  {!i.temInteresseSemQtd && (
                    <div className="text-xs text-text-secondary">{formatBRL(i.subtotalVarejo)}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {(() => {
            let atacado = 0;
            let unidades = 0;
            let semCatalogo = 0;
            for (const i of pre.itens) {
              const p = catalogProducts.find((cp) => cp.sku === i.sku);
              if (!p) { semCatalogo += 1; continue; }
              const qtd = i.temInteresseSemQtd || i.quantidade <= 0 ? 1 : i.quantidade;
              atacado += p.precoAtacado * qtd;
              unidades += qtd;
            }
            return (
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total ref. varejo (wishlist)</span>
                  <span className="text-text-secondary">{formatBRL(pre.totalVarejoRef)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Total atacado (cotação)</span>
                  <span className="font-semibold text-gold">{formatBRL(atacado)}</span>
                </div>
                <div className="text-xs text-text-secondary">
                  {unidades} un · itens de interesse contam como 1 un
                  {semCatalogo > 0 && ` · ${semCatalogo} SKU(s) fora do catálogo`}
                </div>
              </div>
            );
          })()}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-gold-muted">Ações</h3>
          <Button
            className="w-full bg-gold hover:bg-gold-light text-background justify-start"
            onClick={converterEmCotacao}
            disabled={convertendo}
          >
            <ArrowRight className="h-4 w-4" />
            {convertendo ? "Criando cotação…" : "Converter em Cotação"}
          </Button>
          <Button variant="outline" className="w-full justify-start" asChild>
            <a href={whatsappLink()} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> Enviar WhatsApp
            </a>
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={copiarLista}>
            <Copy className="h-4 w-4" /> Copiar lista de interesse
          </Button>
          {pre.status !== "em_contato" && pre.status !== "convertida" && (
            <Button variant="outline" className="w-full justify-start" onClick={() => atualizarStatus(pre.id, "em_contato")}>
              <CheckCircle2 className="h-4 w-4" /> Marcar "Em contato"
            </Button>
          )}
          <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-500" onClick={() => { descartar(pre.id); onClose(); }}>
            <Trash2 className="h-4 w-4" /> Descartar
          </Button>
        </section>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 text-text-secondary">{k}:</dt>
      <dd className="flex-1 min-w-0 truncate">{v}</dd>
    </div>
  );
}

function GerarLinkModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const profile = useAuth((s) => s.profile);
  const login = profile?.login_amigavel || profile?.codigo_vendedor || "";
  const [qr, setQr] = useState<string>("");

  const link = useMemo(() => {
    return login ? `${PUBLIC_SITE_URL}/pre-selecao?v=${login}` : `${PUBLIC_SITE_URL}/pre-selecao`;
  }, [login]);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(link, { width: 240, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [open, link]);

  const waMsg = `Olá! Aqui é ${profile?.nome_completo ?? "da Fetély"} 🌟\n\nAntes da nossa reunião, preparei nosso catálogo interativo para você.\n\nNavegue pelos nossos produtos, marque os que têm interesse e nos envie sua lista — assim chegamos na nossa conversa já sabendo o que faz sentido para a sua loja.\n\n👉 ${link}\n\nQualquer dúvida, é só chamar!`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seu link de pré-seleção</DialogTitle>
          <DialogDescription>Compartilhe com clientes antes da reunião.</DialogDescription>
        </DialogHeader>
        <div className="p-3 bg-surface-2 rounded-md text-sm break-all font-mono">{link}</div>
        {qr && (
          <div className="flex justify-center py-2">
            <img src={qr} alt="QR Code" className="rounded-md bg-white p-2" />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}>
            <Copy className="h-4 w-4" /> Copiar
          </Button>
          <Button variant="outline" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={qr} download={`fetely-preselecao-${login || "link"}.png`}>
              <QrCode className="h-4 w-4" /> Baixar QR
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Mensagens sugeridas por etapa do lead
// ============================================================

interface TemplateMsg {
  titulo: string;
  texto: string;
}

function buildTemplates(params: {
  estado: EstadoSessao;
  nomeCliente: string | null;
  vendedorNome: string;
  qtdItens: number;
  valor: number;
}): TemplateMsg[] {
  const { estado, nomeCliente, vendedorNome, qtdItens, valor } = params;
  const saudacao = nomeCliente ? `Olá, ${nomeCliente}!` : "Olá!";
  const assin = vendedorNome ? `\n\n— ${vendedorNome} · Fetély` : "\n\n— Fetély";
  const catalogoUrl = PUBLIC_SITE_URL;
  const resumoLista = qtdItens > 0
    ? `Vi que você já montou uma lista com ${qtdItens} ${qtdItens === 1 ? "item" : "itens"} (${formatBRL(valor)} no atacado).`
    : "";

  switch (estado) {
    case "acessou":
    case "montagem_abandonada":
      return [
        {
          titulo: "Boas-vindas — apresentar coleções",
          texto: `${saudacao} Que bom te ver no nosso catálogo Fetély. Estou à disposição para te apresentar as coleções e tirar qualquer dúvida sobre os produtos. Posso te sugerir alguma linha específica?${assin}`,
        },
        {
          titulo: "Convite para explorar com apoio",
          texto: `${saudacao} Notei sua visita ao catálogo Fetély. Se quiser, posso te enviar as coleções destaque do momento ou te ajudar a montar uma seleção personalizada para o seu público. É só me dizer o segmento da sua loja.${assin}`,
        },
        {
          titulo: "Curiosidade genuína",
          texto: `${saudacao} Aqui é da Fetély. Vi que você deu uma olhada no nosso catálogo — posso te ajudar em algo? Se quiser, te mando também o link direto: ${catalogoUrl}${assin}`,
        },
      ];

    case "montando":
      return [
        {
          titulo: "Oferecer ajuda com a lista",
          texto: `${saudacao} ${resumoLista} Se precisar, posso te ajudar a finalizar a seleção, sugerir combinações ou tirar dúvidas sobre disponibilidade e prazo.${assin}`,
        },
        {
          titulo: "Sugestão de combinação",
          texto: `${saudacao} Vi que você está montando sua lista de desejos. Posso te sugerir peças que combinam com o que você já selecionou e costumam ter ótima saída no varejo — quer que eu envie?${assin}`,
        },
        {
          titulo: "Fechar a lista com condição especial",
          texto: `${saudacao} ${resumoLista} Quando fechar a seleção, me avisa por aqui que já preparo sua cotação com as melhores condições comerciais.${assin}`,
        },
      ];

    case "formulario_aberto":
      return [
        {
          titulo: "Ajuda para preencher dados",
          texto: `${saudacao} Vi que você chegou no formulário de envio da sua lista. Precisa de algum apoio para preencher os dados da sua empresa? Estou por aqui.${assin}`,
        },
        {
          titulo: "Segurança dos dados",
          texto: `${saudacao} Só reforçando: seus dados são usados apenas para gerar sua cotação — nada de spam. Qualquer dúvida, é só me chamar.${assin}`,
        },
        {
          titulo: "Confirmação rápida",
          texto: `${saudacao} Quando finalizar o envio da lista, me avisa que já dou continuidade por aqui e te retorno com sua cotação personalizada.${assin}`,
        },
      ];

    case "formulario_abandonado":
      return [
        {
          titulo: "Recuperar formulário abandonado",
          texto: `${saudacao} Vi que você começou a enviar sua lista de desejos mas talvez algo tenha acontecido. Posso te ajudar a finalizar por aqui mesmo? ${resumoLista}${assin}`,
        },
        {
          titulo: "Tirar dúvida específica",
          texto: `${saudacao} Notei que você parou no meio do formulário — ficou alguma dúvida sobre CNPJ, condição de pagamento ou prazo? Me conta que resolvemos rapidinho.${assin}`,
        },
        {
          titulo: "Reabrir com link direto",
          texto: `${saudacao} Deixei sua seleção salva. Se quiser retomar de onde parou, é só reabrir o catálogo: ${catalogoUrl}. Qualquer coisa, estou por aqui.${assin}`,
        },
      ];

    case "enviada":
      return [
        {
          titulo: "Confirmação de recebimento",
          texto: `${saudacao} Recebemos sua lista aqui na Fetély. Já estou preparando sua cotação personalizada e te retorno em breve com condições e prazo.${assin}`,
        },
        {
          titulo: "Prévia de próximos passos",
          texto: `${saudacao} Obrigado pelo envio da lista! Em até 1 dia útil te mando a cotação com preço final, prazo de produção e opções de pagamento.${assin}`,
        },
      ];

    default:
      return [
        {
          titulo: "Mensagem genérica",
          texto: `${saudacao} Como posso te ajudar hoje?${assin}`,
        },
      ];
  }
}

function MensagensSugeridasDialog({
  open,
  onOpenChange,
  estado,
  nomeCliente,
  whatsappDigits,
  vendedorNome,
  qtdItens,
  valor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  estado: EstadoSessao;
  nomeCliente: string | null;
  whatsappDigits: string;
  vendedorNome: string;
  qtdItens: number;
  valor: number;
}) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const templates = useMemo(
    () => buildTemplates({ estado, nomeCliente, vendedorNome, qtdItens, valor }),
    [estado, nomeCliente, vendedorNome, qtdItens, valor],
  );

  async function copiar(idx: number, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiedIdx(idx);
      toast.success("Mensagem copiada");
      setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 1800);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  function enviar(texto: string) {
    if (!whatsappDigits) {
      toast.error("Sessão sem WhatsApp");
      return;
    }
    const url = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank", "noreferrer");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-gold" />
            Mensagens sugeridas
          </DialogTitle>
          <DialogDescription>
            Sugestões prontas para a etapa <b>{ESTADO_SESSAO_LABEL[estado]}</b>. Escolha uma,
            copie e envie pelo WhatsApp — ou dispare direto daqui.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {templates.map((t, idx) => (
            <div key={idx} className="rounded-lg border border-border bg-surface-2/40 p-3">
              <div className="text-[11px] uppercase tracking-wider text-gold mb-1.5">
                {t.titulo}
              </div>
              <div className="whitespace-pre-wrap text-sm text-text-primary leading-relaxed">
                {t.texto}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copiar(idx, t.texto)}
                >
                  {copiedIdx === idx ? (
                    <><Check className="h-3.5 w-3.5" /> Copiado</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" /> Copiar</>
                  )}
                </Button>
                {whatsappDigits && (
                  <Button size="sm" onClick={() => enviar(t.texto)}>
                    <MessageCircle className="h-3.5 w-3.5" /> Enviar no WhatsApp
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
