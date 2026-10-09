import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClienteFormModal } from "@/components/clientes/ClienteFormModal";
import type { Cliente } from "@/types/cliente";
import { formatCNPJ, onlyDigits } from "@/lib/cnpj";
import { toast } from "sonner";
import { Plus, AlertTriangle, Trash2, MapPin, RefreshCw, Repeat, ChevronRight } from "lucide-react";
import {
  carregarMapaAtuacao, vincularRepresentanteMapa,
  type MapaAtuacao, type MapaRep,
} from "@/lib/mapaAtuacao.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  carregarCrm, conflitosGestao, motivosRegua, hojeISO, diasEntre, fmtData,
  carregarComercial, resumoComercial, COTACAO_ABERTA, type CrmComercial,
  GRUPOS, REGIOES, TIPOS_ATIVIDADE, STAGE_AGENDA, STAGE_APRESENTADO, STAGE_PERDIDO,
  type CrmStage, type CrmLead, type CrmActivity, type CrmRep, type CrmHist, type CrmGrupo, type CrmRegiao, type CrmAtividadeTipo,
  type CrmTask, type CrmRound,
} from "@/lib/crm";
import { FASES, TRILHA, SEG_ALIMENTAR, SEG_ESPECIALIZADO, fichaCompleta, sugerirTarefa, type Fase } from "@/lib/crmFases";
import { type Ctx, BORDO, nomeRep, infoLead, faseDe, Selo, TempDot, brl } from "@/components/crm/shared";
import { CardGuiado } from "@/components/crm/CardGuiado";
import { Rodada, type PresetRodada } from "@/components/crm/Rodada";
import { TarefasGestao } from "@/components/crm/Tarefas";

export const Route = createFileRoute("/crm")({
  head: () => ({
    meta: [
      { title: "CRM de Representantes — Fetély B2B" },
      { name: "description", content: "Funil, rodadas, tarefas e agenda dos representantes Fetély." },
      { property: "og:title", content: "CRM de Representantes — Fetély B2B" },
      { property: "og:description", content: "Funil, rodadas, tarefas e agenda dos representantes Fetély." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CrmPage,
});

const TODOS = "__todos";

type Dados = { stages: CrmStage[]; leads: CrmLead[]; atividades: CrmActivity[]; representantes: CrmRep[]; comercial: CrmComercial; tarefas: CrmTask[]; rodadas: CrmRound[] };

function CrmPage() {
  const roles = useAuth((s) => s.roles) as string[];
  const profile = useAuth((s) => s.profile);
  const user = useAuth((s) => s.user);
  const authLoading = useAuth((s) => s.loading);
  const gestao = roles.includes("admin") || roles.includes("master") || roles.includes("gestao_representantes");
  const representante = !gestao && profile?.tipo_vendedor === "representante";

  const [dados, setDados] = useState<Dados | null>(null);
  const [conflitos, setConflitos] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [tab, setTab] = useState("geral");
  const [repFiltro, setRepFiltro] = useState<string>(TODOS);
  const [leadAberto, setLeadAberto] = useState<CrmLead | null>(null);
  const [editar, setEditar] = useState<CrmLead | "novo" | null>(null);
  const [vincular, setVincular] = useState<CrmLead | null>(null);
  const [ativAberta, setAtivAberta] = useState<CrmActivity | "nova" | null>(null);
  const [perdaPend, setPerdaPend] = useState<{ lead: CrmLead; stageId: string } | null>(null);
  const [rodada, setRodada] = useState<{ preset: PresetRodada } | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const base = await carregarCrm(gestao);
      const comercial = await carregarComercial(base.leads.map((l) => l.cliente_id ?? ""));
      setDados({ ...base, comercial });
      if (gestao) setConflitos(await conflitosGestao());
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [gestao]);

  useEffect(() => {
    if (!authLoading && (gestao || representante)) void recarregar();
  }, [authLoading, gestao, representante, recarregar]);

  if (authLoading) return <div className="p-8 text-text-secondary">Carregando…</div>;
  if (!gestao && !representante)
    return <div className="p-8 text-text-secondary">O CRM é exclusivo para representantes e para a gestão comercial.</div>;
  if (erro) return <div className="p-8 text-destructive">Erro ao carregar o CRM: {erro}</div>;
  if (!dados) return <div className="p-8 text-text-secondary">Carregando CRM…</div>;

  const stageMap = new Map(dados.stages.map((s) => [s.id, s]));
  const repMap = new Map(dados.representantes.map((r) => [r.id, r]));
  const filtrar = <T extends { representante_id: string | null }>(xs: T[]) =>
    gestao && repFiltro !== TODOS ? xs.filter((x) => x.representante_id === repFiltro) : xs;

  async function moverEstagio(lead: CrmLead, stageId: string, motivo?: string) {
    if (lead.stage_id === stageId) return;
    const destino = stageMap.get(stageId);
    const { error } = await supabase.from("crm_leads").update({ stage_id: stageId, ...(motivo ? { motivo_perda: motivo } : {}) }).eq("id", lead.id);
    if (error) { toast.error(`Não foi possível mudar a fase: ${error.message}`); return; }
    toast.success(`Movido para ${destino?.nome}`);
    await recarregar();
  }

  const ctx: Ctx = {
    ...dados, stageMap, repMap, gestao, conflitos, userId: user?.id ?? "",
    abrirLead: (l) => setLeadAberto(l), abrirAtividade: (a) => setAtivAberta(a), moverEstagio, recarregar,
  };

  const seletorRep = gestao && (
    <Select value={repFiltro} onValueChange={setRepFiltro}>
      <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Representante" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>Todos os representantes</SelectItem>
        {dados.representantes.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  const leadVivo = leadAberto ? dados.leads.find((l) => l.id === leadAberto.id) ?? leadAberto : null;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-text-primary">CRM de Representantes</h1>
        <div className="flex gap-2">
          {gestao && <Button size="sm" onClick={() => setRodada({ preset: null })}><Repeat className="h-4 w-4" /> Iniciar rodada</Button>}
          <Button size="sm" variant={gestao ? "outline" : "default"} onClick={() => setEditar("novo")}><Plus className="h-4 w-4" /> Lead</Button>
          <Button size="sm" variant="outline" onClick={() => setAtivAberta("nova")}><Plus className="h-4 w-4" /> Atividade</Button>
        </div>
      </div>

      {gestao && <Lembretes ctx={ctx} onRodada={(p) => setRodada({ preset: p })} />}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-3 px-3">
          <TabsList>
            <TabsTrigger value="geral">Visão geral</TabsTrigger>
            <TabsTrigger value="funil">Funil</TabsTrigger>
            {gestao && <TabsTrigger value="tarefas">Tarefas</TabsTrigger>}
            <TabsTrigger value="rep">Por representante</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="ativ">Atividades</TabsTrigger>
            <TabsTrigger value="mapa">Mapa</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="geral">
          <VisaoGeral ctx={ctx} onRep={(id) => { setRepFiltro(id); setTab("rep"); }} />
        </TabsContent>
        <TabsContent value="funil" className="space-y-3">
          {seletorRep}
          <Funil ctx={ctx} leads={filtrar(dados.leads)} />
        </TabsContent>
        {gestao && <TabsContent value="tarefas" className="space-y-3"><TarefasGestao ctx={ctx} /></TabsContent>}
        <TabsContent value="rep">
          <PorRepresentante ctx={ctx} repId={gestao ? (repFiltro === TODOS ? dados.representantes[0]?.id : repFiltro) : user?.id}
            seletor={gestao && (
              <Select value={repFiltro === TODOS ? dados.representantes[0]?.id ?? "" : repFiltro} onValueChange={setRepFiltro}>
                <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Representante" /></SelectTrigger>
                <SelectContent>{dados.representantes.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
              </Select>
            )}
            onSalvo={recarregar}
          />
        </TabsContent>
        <TabsContent value="agenda" className="space-y-3">
          {seletorRep}
          <Agenda ctx={ctx} leads={filtrar(dados.leads)} />
        </TabsContent>
        <TabsContent value="ativ" className="space-y-3">
          {seletorRep}
          <Atividades ctx={ctx} atividades={filtrar(dados.atividades)} />
        </TabsContent>
        <TabsContent value="mapa" className="space-y-3">
          <MapaAtuacaoTab ctx={ctx} />
        </TabsContent>
      </Tabs>

      {leadVivo && !editar && !vincular && (
        <CardGuiado key={leadVivo.id} ctx={ctx} lead={leadVivo} onClose={() => setLeadAberto(null)}
          onEditar={() => setEditar(leadVivo)} onVincular={() => setVincular(leadVivo)}
          comercial={leadVivo.cliente_id ? <AbaComercial ctx={ctx} clienteId={leadVivo.cliente_id} /> : null} />
      )}
      {vincular && <VincularClienteDialog ctx={ctx} lead={vincular} onClose={() => setVincular(null)} onSalvo={recarregar} />}
      {editar && (
        <LeadDialog key={editar === "novo" ? "novo" : editar.id} ctx={ctx} lead={editar === "novo" ? null : (dados.leads.find((l) => l.id === editar.id) ?? editar)}
          repPadrao={gestao ? (repFiltro !== TODOS ? repFiltro : dados.representantes[0]?.id ?? "") : user?.id ?? ""}
          onClose={() => setEditar(null)} onSalvo={recarregar} />
      )}
      {ativAberta && (
        <AtividadeDialog ctx={ctx} atividade={ativAberta === "nova" ? null : ativAberta}
          onClose={() => setAtivAberta(null)} onSalvo={recarregar} />
      )}
      {perdaPend && (
        <MotivoPerdaDialog onCancel={() => setPerdaPend(null)}
          onConfirm={async (m) => { const p = perdaPend; setPerdaPend(null); await moverEstagio(p.lead, p.stageId, m); }} />
      )}
      {rodada && <Rodada ctx={ctx} preset={rodada.preset} onClose={() => { setRodada(null); void recarregar(); }} />}
    </div>
  );
}

const aberto = (ctx: Ctx, l: CrmLead) => !ctx.stageMap.get(l.stage_id)?.encerrado;

function StageChip({ stage }: { stage?: CrmStage }) {
  if (!stage) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-text-primary whitespace-nowrap">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.cor }} />{stage.nome}
    </span>
  );
}

function Regua({ m }: { m: string[] }) {
  if (!m.length) return <span className="text-text-secondary text-xs">ok</span>;
  return <span className="text-destructive text-xs font-medium">{m.join(", ")}</span>;
}

function Vazio({ texto, onCriar, rotulo }: { texto: string; onCriar?: () => void; rotulo?: string }) {
  return (
    <div className="py-10 text-center text-text-secondary text-sm space-y-3">
      <p>{texto}</p>
      {onCriar && <Button size="sm" onClick={onCriar}><Plus className="h-4 w-4" /> {rotulo}</Button>}
    </div>
  );
}

function Kpi({ label, valor, alerta, rotulo, sub }: { label: string; valor: number; alerta?: boolean; rotulo?: string; sub?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className={cn("text-2xl font-display mt-1", alerta && valor > 0 ? "text-destructive" : "text-text-primary", rotulo && "text-lg")}>{rotulo ?? valor}</div>
      {sub && <div className="text-[11px] text-text-secondary mt-0.5">{sub}</div>}
    </CardContent></Card>
  );
}

/* ---------------- LEMBRETES DA GESTÃO ---------------- */
function Lembretes({ ctx, onRodada }: { ctx: Ctx; onRodada: (p: PresetRodada) => void }) {
  const dow = new Date().getDay();
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const vespera = ctx.leads.filter((l) => faseDe(ctx, l) === "1" && l.visita_em?.slice(0, 10) === amanha && !l.visita_confirmada);
  const itens: React.ReactNode[] = [];
  if (dow === 1) itens.push(<button key="seg" className="flex items-center gap-1 text-left" onClick={() => onRodada("segunda")}>Segunda: <b>Montar a rota com os reps</b> <ChevronRight className="h-4 w-4" /></button>);
  if (dow === 5) itens.push(<button key="sex" className="flex items-center gap-1 text-left" onClick={() => onRodada("sexta")}>Sexta: <b>Fechar as devolutivas</b> <ChevronRight className="h-4 w-4" /></button>);
  if (vespera.length) itens.push(<span key="v">Confirmar visitas de amanhã: {vespera.map((l) => <button key={l.id} className="underline mr-2" onClick={() => ctx.abrirLead(l)}>{l.nome_conta}</button>)}</span>);
  if (!itens.length) return null;
  return <div className="rounded-md border border-gold/50 bg-gold/5 px-3 py-2 text-sm text-text-primary flex flex-wrap gap-x-6 gap-y-1">{itens}</div>;
}

/* ---------------- 1. VISÃO GERAL ---------------- */
function VisaoGeral({ ctx, onRep }: { ctx: Ctx; onRep: (id: string) => void }) {
  const hoje = hojeISO();
  const [agrupar, setAgrupar] = useState<"grupo" | "regiao">("grupo");
  // Visita sem ficha não conta nos indicadores até a ficha ser registrada.
  const conta = (l: CrmLead) => !(faseDe(ctx, l) === "2" && !fichaCompleta(l));
  const leads = ctx.leads.filter(conta);
  const inf = new Map(ctx.leads.map((l) => [l.id, infoLead(ctx, l, hoje)]));
  const desde7 = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const visitas = ctx.atividades.filter((a) => a.tipo === "Visita" && a.data >= desde7);
  const visitasFicha = new Set(visitas.filter((a) => { const l = ctx.leads.find((x) => x.id === a.lead_id); return l && fichaCompleta(l); }).map((a) => a.lead_id)).size;
  const f3 = leads.filter((l) => faseDe(ctx, l) === "3");
  const f4 = leads.filter((l) => faseDe(ctx, l) === "4");
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const semVoltar = leads.filter((l) => {
    if (!l.cliente_id) return false;
    const r = resumoComercial(ctx.comercial, l.cliente_id);
    return !!r.ultimoPedido && diasEntre(r.ultimoPedido.slice(0, 10), hoje) > 60;
  });
  const porFase = (f: Fase) => leads.filter((l) => faseDe(ctx, l) === f);
  const max = Math.max(1, ...TRILHA.map((f) => porFase(f).length));

  const linhas = ctx.representantes.map((r) => {
    const meus = ctx.leads.filter((l) => l.representante_id === r.id);
    const meusAbertos = meus.filter((l) => aberto(ctx, l));
    const ult = ctx.rodadas.filter((x) => x.representante_id === r.id || (!x.representante_id && x.lead_ids.some((id) => meus.some((m) => m.id === id))))
      .map((x) => x.iniciada_em).sort().pop();
    return {
      rep: r, contas: meus.length, abertas: meusAbertos.length,
      fechados: meus.filter((l) => ["5", "6"].includes(faseDe(ctx, l) ?? "")).length,
      alerta: meusAbertos.filter((l) => inf.get(l.id)!.alertas.length).length,
      vencidas: ctx.tarefas.filter((t) => t.status === "Aberta" && t.representante_id === r.id && t.vence_em < hoje).length,
      ultimaRodada: ult ?? null,
      valorPedidos: meus.reduce((a, l) => a + resumoComercial(ctx.comercial, l.cliente_id).totalPedidos, 0),
    };
  });
  const grupos = agrupar === "grupo" ? GRUPOS : REGIOES;
  const classes = (["A", "B", "C"] as const).map((c) => ({ c, n: leads.filter((l) => aberto(ctx, l) && inf.get(l.id)!.classe === c).length }));
  const seg = (lista: string[]) => lista.map((s) => ({ s, n: leads.filter((l) => l.segmento === s).length })).filter((x) => x.n);
  const redes = ctx.gestao ? [...new Set(ctx.leads.map((l) => l.rede_grupo).filter(Boolean))] as string[] : [];

  return (
    <div className="space-y-6 pt-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Visitas da semana" valor={visitas.length} sub={`${visitasFicha} viraram ficha`} />
        <Kpi label="Devolutivas em 48h" valor={0} rotulo={pct(f3.filter((l) => l.toque_d2_feito).length, f3.length)} sub={`${f3.length} em Catálogo e condições`} />
        <Kpi label="Oportunidades com valor no card" valor={0} rotulo={pct(f4.filter((l) => l.valor_estimado).length, f4.length)} sub={`${f4.length} em negociação`} />
        <Kpi label="Compraram e não voltaram (60d+)" valor={semVoltar.length} alerta />
      </div>

      <Card><CardContent className="p-4 space-y-2">
        <div className="text-sm font-medium text-text-primary">Funil</div>
        {[...TRILHA, "X" as Fase].map((f) => {
          const ls = porFase(f);
          const s = ctx.stages.find((x) => x.fase === f);
          return (
            <div key={f} className="flex items-center gap-2 text-xs">
              <div className="w-36 sm:w-44 shrink-0 text-text-secondary truncate">{f} · {FASES[f].nome}</div>
              <div className="flex-1 h-5 bg-muted rounded">
                <div className="h-5 rounded" style={{ width: `${(ls.length / max) * 100}%`, background: s?.cor, minWidth: ls.length ? 6 : 0 }} />
              </div>
              <div className="w-20 text-right text-text-primary whitespace-nowrap">{ls.length} contas</div>
            </div>
          );
        })}
      </CardContent></Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card><CardContent className="p-4 space-y-2">
          <div className="text-sm font-medium text-text-primary">Por classe (abertas)</div>
          <div className="flex gap-3">{classes.map((x) => <div key={x.c} className="flex-1 rounded-md border border-border p-2 text-center"><div className="text-xs text-text-secondary">Classe {x.c}</div><div className="text-xl font-display">{x.n}</div></div>)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-1 text-xs">
          <div className="text-sm font-medium text-text-primary">Por segmento</div>
          <div className="text-gold">Varejo alimentar</div>
          {seg(SEG_ALIMENTAR).map((x) => <div key={x.s} className="flex justify-between"><span>{x.s}</span><span>{x.n}</span></div>)}
          <div className="text-gold pt-1">Varejo especializado</div>
          {seg([...SEG_ESPECIALIZADO, "Outro"]).map((x) => <div key={x.s} className="flex justify-between"><span>{x.s}</span><span>{x.n}</span></div>)}
          <div className="flex justify-between text-text-secondary pt-1"><span>Sem segmento</span><span>{leads.filter((l) => !l.segmento).length}</span></div>
        </CardContent></Card>
      </div>

      {ctx.gestao && redes.length > 0 && (
        <Card><CardContent className="p-4 space-y-2">
          <div className="text-sm font-medium text-text-primary">Redes (uma negociação só)</div>
          {redes.map((r) => (
            <div key={r} className="text-xs"><b>{r}:</b> {ctx.leads.filter((l) => l.rede_grupo === r).map((l) => <button key={l.id} className="underline mr-2" onClick={() => ctx.abrirLead(l)}>{l.nome_conta} ({nomeRep(ctx, l.representante_id)})</button>)}</div>
          ))}
        </CardContent></Card>
      )}

      {ctx.gestao ? (
        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-text-primary">Por representante</div>
            <Select value={agrupar} onValueChange={(v) => setAgrupar(v as "grupo" | "regiao")}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="grupo">Agrupar por grupo</SelectItem><SelectItem value="regiao">Agrupar por região</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead><tr className="text-left text-xs text-text-secondary border-b border-border">
                <th className="py-2">Representante</th><th>Contas</th><th>Abertas</th><th>Pedido/pós-venda</th><th>Com alerta</th><th>Tarefas vencidas</th><th>Valor em pedidos</th><th>Última rodada</th>
              </tr></thead>
              <tbody>
                {grupos.map((g) => {
                  const ls = linhas.filter((x) => (agrupar === "grupo" ? x.rep.grupo : x.rep.regiao) === g);
                  if (!ls.length) return null;
                  return [
                    <tr key={g}><td colSpan={8} className="pt-3 pb-1 text-xs uppercase tracking-wide text-gold">{g}</td></tr>,
                    ...ls.map((x) => (
                      <tr key={x.rep.id} className="border-b border-border hover:bg-surface-hover cursor-pointer" onClick={() => onRep(x.rep.id)}>
                        <td className="py-2 text-text-primary">{x.rep.nome}</td><td>{x.contas}</td><td>{x.abertas}</td><td>{x.fechados}</td>
                        <td className={x.alerta ? "text-destructive font-medium" : ""}>{x.alerta}</td>
                        <td className={x.vencidas ? "text-destructive font-medium" : ""}>{x.vencidas}</td>
                        <td className="whitespace-nowrap">{brl(x.valorPedidos)}</td>
                        <td className="text-xs">{x.ultimaRodada ? new Date(x.ultimaRodada).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}</td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-4 space-y-2">
          <div className="text-sm font-medium text-text-primary">Minhas próximas atividades</div>
          {(() => {
            const minhas = ctx.tarefas.filter((t) => t.status === "Aberta").sort((a, b) => a.vence_em.localeCompare(b.vence_em));
            if (!minhas.length) return <Vazio texto="Nenhuma próxima atividade." />;
            return minhas.map((t) => {
              const l = ctx.leads.find((x) => x.id === t.lead_id);
              if (!l) return null;
              return (
                <button key={t.id} onClick={() => ctx.abrirLead(l)} className="w-full text-left flex items-center justify-between gap-2 py-2 border-b border-border text-sm">
                  <span><span className="text-text-primary">{l.nome_conta}</span> <span className="text-text-secondary">— {t.tipo} ({t.responsavel})</span></span>
                  <span className={cn("text-xs whitespace-nowrap", t.vence_em < hoje && "text-destructive")}>{fmtData(t.vence_em)}</span>
                </button>
              );
            });
          })()}
        </CardContent></Card>
      )}
    </div>
  );
}

/* ---------------- 2. FUNIL (kanban das 7 fases) ---------------- */
function Funil({ ctx, leads }: { ctx: Ctx; leads: CrmLead[] }) {
  const hoje = hojeISO();
  const [verX, setVerX] = useState(false);
  if (!ctx.leads.length) return <Vazio texto="Nenhum lead ainda." />;
  const xs = leads.filter((l) => faseDe(ctx, l) === "X");
  const card = (l: CrmLead) => {
    const i = infoLead(ctx, l, hoje);
    return (
      <button type="button" key={l.id} onClick={() => ctx.abrirLead(l)}
        className={cn("w-full text-left rounded-md bg-background p-2.5 text-xs space-y-1 active:opacity-70", i.alertas.length ? "border-destructive" : "border-border")}
        style={{ borderColor: l.tier_a ? BORDO : undefined, borderWidth: l.tier_a || i.alertas.length ? 2 : 1, borderStyle: "solid" }}>
        <div className="flex items-start gap-1">
          <span className="text-sm font-medium text-text-primary flex-1">{l.nome_conta}</span>
          <Selo tom="gold">{i.classe}</Selo>
        </div>
        <div className="text-text-secondary">{[l.segmento, l.numero_lojas == null ? "lojas?" : l.numero_lojas > 0 ? `${l.numero_lojas} ${l.numero_lojas === 1 ? "loja" : "lojas"}` : null].filter(Boolean).join(" · ") || "lojas?"}</div>
        <div className={cn("text-text-primary", i.tarefa && i.tarefa.vence_em < hoje && "text-destructive")}>{i.tarefa ? `${i.tarefa.tipo} · ${fmtData(i.tarefa.vence_em)}` : "sem próxima atividade"}</div>
        {i.alertas.length > 0 && <div className="text-destructive font-medium">{i.alertas.join(", ")}</div>}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <TempDot t={i.temp} />
          {i.prio && <Selo tom="gold">{i.prio}</Selo>}
          {l.valor_estimado ? <span className="text-text-primary">{brl(l.valor_estimado)}</span> : null}
          {ctx.gestao && ctx.conflitos.has(l.id) && <Selo tom="alerta">Conflito</Selo>}
          {ctx.gestao && <span className="text-text-secondary ml-auto">{nomeRep(ctx, l.representante_id)}</span>}
        </div>
      </button>
    );
  };
  return (
    <div className="overflow-x-auto pb-2 -mx-3 px-3">
      <div className="flex gap-3 min-w-max">
        {TRILHA.map((f) => {
          const s = ctx.stages.find((x) => x.fase === f);
          const ls = leads.filter((l) => faseDe(ctx, l) === f);
          return (
            <div key={f} className="w-64 shrink-0 rounded-lg border border-border bg-surface flex flex-col">
              <div className="px-3 py-2 border-b border-border flex items-center gap-2" style={{ borderTop: `4px solid ${s?.cor}` }}>
                <span className="text-sm font-medium text-text-primary flex-1">{f} · {FASES[f].nome}</span>
                <span className="text-xs text-text-secondary">{ls.length}</span>
              </div>
              <div className="p-2 space-y-2 flex-1 min-h-24">{ls.map(card)}</div>
              {FASES[f].prazo != null && <div className="px-3 py-1.5 border-t border-border text-[11px] text-text-secondary">Régua: até {FASES[f].prazo} {FASES[f].prazo === 1 ? "dia" : "dias"}</div>}
            </div>
          );
        })}
        <div className={cn("shrink-0 rounded-lg border border-border bg-surface flex flex-col", verX ? "w-64" : "w-14")}>
          <button type="button" onClick={() => setVerX(!verX)} className="px-2 py-2 border-b border-border text-sm font-medium text-text-primary text-left">
            {verX ? `X · Não vai agora (${xs.length})` : <span className="block text-center">X<br /><span className="text-xs text-text-secondary">{xs.length}</span></span>}
          </button>
          {verX && <div className="p-2 space-y-2">{xs.map(card)}</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 3. POR REPRESENTANTE ---------------- */
function PorRepresentante({ ctx, repId, seletor, onSalvo }: { ctx: Ctx; repId?: string; seletor: React.ReactNode; onSalvo: () => Promise<void> }) {
  const rep = repId ? ctx.repMap.get(repId) : undefined;
  const hoje = hojeISO();
  const [form, setForm] = useState<{ grupo: CrmGrupo; regiao: CrmRegiao; observacao: string } | null>(null);
  useEffect(() => { if (rep) setForm({ grupo: rep.grupo, regiao: rep.regiao, observacao: rep.observacao ?? "" }); }, [rep?.id, rep?.grupo, rep?.regiao, rep?.observacao]);
  if (!rep) return <div className="pt-2 space-y-3">{seletor}<Vazio texto="Nenhum representante encontrado." /></div>;
  const leads = ctx.leads.filter((l) => l.representante_id === rep.id);
  const ativs = ctx.atividades.filter((a) => a.representante_id === rep.id);
  const leadMap = new Map(ctx.leads.map((l) => [l.id, l]));

  async function salvarRep() {
    if (!form || !rep) return;
    const { error } = await supabase.from("crm_rep_settings").upsert({ representante_id: rep.id, grupo: form.grupo, regiao: form.regiao, observacao: form.observacao || null });
    if (error) return toast.error(`Não foi possível salvar: ${error.message}`);
    toast.success("Representante atualizado");
    await onSalvo();
  }

  return (
    <div className="space-y-4 pt-2">
      {seletor}
      <Card><CardContent className="p-4 space-y-3">
        <div className="font-display text-xl text-text-primary">{rep.nome}</div>
        {ctx.gestao && form ? (
          <div className="grid sm:grid-cols-3 gap-3">
            <div><Label>Grupo</Label>
              <Select value={form.grupo} onValueChange={(v) => setForm({ ...form, grupo: v as CrmGrupo })}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{GRUPOS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Região</Label>
              <Select value={form.regiao} onValueChange={(v) => setForm({ ...form, regiao: v as CrmRegiao })}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REGIOES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Observação</Label><Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div>
            <div className="sm:col-span-3"><Button size="sm" onClick={salvarRep}>Salvar</Button></div>
          </div>
        ) : (
          <div className="text-sm text-text-secondary">{rep.grupo} · {rep.regiao}{rep.observacao ? ` · ${rep.observacao}` : ""}</div>
        )}
      </CardContent></Card>

      <div className="flex flex-wrap gap-2">
        {ctx.stages.map((s) => (
          <div key={s.id} className="rounded-md border border-border px-2.5 py-1.5 text-xs flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.cor }} />{s.nome}
            <span className="font-semibold text-text-primary">{leads.filter((l) => l.stage_id === s.id).length}</span>
          </div>
        ))}
      </div>

      <Card><CardContent className="p-4">
        <div className="text-sm font-medium text-text-primary mb-2">Leads</div>
        {leads.length === 0 ? <Vazio texto="Nenhum lead ainda." /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[720px]">
            <thead><tr className="text-left text-xs text-text-secondary border-b border-border">
              <th className="py-2">Conta</th><th>Lojas</th><th>Estágio</th><th>Última ação</th><th>Próxima ação</th><th>Data</th><th>Régua</th>
            </tr></thead>
            <tbody>{leads.map((l) => (
              <tr key={l.id} className="border-b border-border hover:bg-surface-hover cursor-pointer" onClick={() => ctx.abrirLead(l)}>
                <td className="py-2 text-text-primary">{l.nome_conta}</td><td>{l.numero_lojas ?? 0}</td><td><StageChip stage={ctx.stageMap.get(l.stage_id)} /></td>
                <td className="text-xs">{l.ultima_acao ?? "—"}</td><td className="text-xs">{l.proxima_acao ?? "—"}</td><td className="text-xs">{fmtData(l.proxima_acao_data)}</td>
                <td><Regua m={motivosRegua(l, ctx.stageMap.get(l.stage_id), hoje)} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-1">
        <div className="text-sm font-medium text-text-primary mb-2">Atividades</div>
        {ativs.length === 0 ? <Vazio texto="Nenhuma atividade registrada." /> : ativs.map((a) => (
          <button key={a.id} onClick={() => ctx.abrirAtividade(a)} className="w-full text-left py-2 border-b border-border text-sm flex flex-wrap gap-x-3">
            <span className="text-xs text-text-secondary w-12">{fmtData(a.data)}</span>
            <span className="text-text-primary">{leadMap.get(a.lead_id)?.nome_conta}</span>
            <span className="text-text-secondary">{a.tipo}</span>
            <span className={a.resultado ? "" : "text-destructive font-medium"}>{a.resultado ?? "A registrar"}</span>
          </button>
        ))}
      </CardContent></Card>
    </div>
  );
}

/* ---------------- 4. AGENDA ---------------- */
function Agenda({ ctx, leads }: { ctx: Ctx; leads: CrmLead[] }) {
  const hoje = hojeISO();
  const abertos = leads.filter((l) => aberto(ctx, l))
    .map((l) => ({ l, m: motivosRegua(l, ctx.stageMap.get(l.stage_id), hoje) }))
    .sort((a, b) => (a.l.proxima_acao_data ?? "9999").localeCompare(b.l.proxima_acao_data ?? "9999"));
  const secoes: { titulo: string; itens: typeof abertos; alerta?: boolean }[] = [
    { titulo: "Fora da régua ou atrasado", itens: abertos.filter((x) => x.m.length), alerta: true },
    { titulo: "Hoje", itens: abertos.filter((x) => !x.m.length && x.l.proxima_acao_data === hoje) },
    { titulo: "Próximos 7 dias", itens: abertos.filter((x) => { if (x.m.length || !x.l.proxima_acao_data) return false; const d = diasEntre(hoje, x.l.proxima_acao_data); return d >= 1 && d <= 7; }) },
    { titulo: "Depois", itens: abertos.filter((x) => !x.m.length && !!x.l.proxima_acao_data && diasEntre(hoje, x.l.proxima_acao_data) > 7) },
    { titulo: "Sem data de próxima ação", itens: abertos.filter((x) => !x.m.length && !x.l.proxima_acao_data) },
  ];
  if (!abertos.length) return <Vazio texto="Nenhum lead em andamento." />;
  return (
    <div className="space-y-4">
      {secoes.map((s) => (
        <Card key={s.titulo}><CardContent className="p-4">
          <div className={cn("text-sm font-medium mb-2", s.alerta ? "text-destructive" : "text-text-primary")}>{s.titulo} ({s.itens.length})</div>
          {s.itens.length === 0 ? <div className="text-xs text-text-secondary">Nada aqui.</div> : (
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
              <thead><tr className="text-left text-xs text-text-secondary border-b border-border">
                <th className="py-2">Data</th>{ctx.gestao && <th>Representante</th>}<th>Conta</th><th>Estágio</th><th>Próxima ação</th><th>Alerta</th>
              </tr></thead>
              <tbody>{s.itens.map(({ l, m }) => (
                <tr key={l.id} className="border-b border-border hover:bg-surface-hover cursor-pointer" onClick={() => ctx.abrirLead(l)}>
                  <td className="py-2 text-xs">{fmtData(l.proxima_acao_data)}</td>{ctx.gestao && <td className="text-xs">{nomeRep(ctx, l.representante_id)}</td>}
                  <td className="text-text-primary">{l.nome_conta}</td><td><StageChip stage={ctx.stageMap.get(l.stage_id)} /></td>
                  <td className="text-xs">{l.proxima_acao ?? "—"}</td><td><Regua m={m} /></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </CardContent></Card>
      ))}
    </div>
  );
}

/* ---------------- 5. ATIVIDADES ---------------- */
function Atividades({ ctx, atividades }: { ctx: Ctx; atividades: CrmActivity[] }) {
  const leadMap = new Map(ctx.leads.map((l) => [l.id, l]));
  const pend = atividades.filter((a) => !a.resultado).length;
  if (!atividades.length) return <Vazio texto="Nenhuma atividade registrada ainda." />;
  return (
    <div className="space-y-3">
      {pend > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {pend} {pend === 1 ? "atividade sem resultado registrado" : "atividades sem resultado registrado"}
        </div>
      )}
      <Card><CardContent className="p-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-left text-xs text-text-secondary border-b border-border">
            <th className="py-2">Data</th>{ctx.gestao && <th>Representante</th>}<th>Conta</th><th>Tipo</th><th>Resultado</th><th>Próximo passo</th>
          </tr></thead>
          <tbody>{atividades.map((a) => (
            <tr key={a.id} className="border-b border-border hover:bg-surface-hover cursor-pointer" onClick={() => ctx.abrirAtividade(a)}>
              <td className="py-2 text-xs">{fmtData(a.data)}</td>{ctx.gestao && <td className="text-xs">{nomeRep(ctx, a.representante_id)}</td>}
              <td className="text-text-primary">{leadMap.get(a.lead_id)?.nome_conta ?? "—"}</td><td className="text-xs">{a.tipo}</td>
              <td className={cn("text-xs", !a.resultado && "text-destructive font-medium")}>{a.resultado ?? "A registrar"}</td>
              <td className="text-xs">{a.proximo_passo ?? "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

/* ---------------- FORMULÁRIO DE LEAD ---------------- */
function LeadDialog({ ctx, lead, repPadrao, onClose, onSalvo }: { ctx: Ctx; lead: CrmLead | null; repPadrao: string; onClose: () => void; onSalvo: () => Promise<void> }) {
  const [f, setF] = useState(() => ({
    nome_conta: lead?.nome_conta ?? "", cnpj: lead?.cnpj ?? "", cidade: lead?.cidade ?? "", uf: lead?.uf ?? "",
    numero_lojas: lead?.numero_lojas?.toString() ?? "", tier_a: lead?.tier_a ?? false,
    representante_id: lead?.representante_id ?? repPadrao, stage_id: lead?.stage_id ?? ctx.stages[0]?.id ?? "",
    ultima_acao: lead?.ultima_acao ?? "", proxima_acao: lead?.proxima_acao ?? "", proxima_acao_data: lead?.proxima_acao_data ?? "",
    motivo_perda: lead?.motivo_perda ?? "",
  }));
  const [salvando, setSalvando] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const [hist, setHist] = useState<CrmHist[] | null>(null);
  const [vincularAberto, setVincularAberto] = useState(false);
  const [clienteNome, setClienteNome] = useState<string | null>(null);
  const perdido = ctx.stageMap.get(f.stage_id)?.nome === STAGE_PERDIDO;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (!lead) return;
    void supabase.from("crm_stage_history").select("*").eq("lead_id", lead.id).order("alterado_em", { ascending: false })
      .then(({ data }) => setHist((data ?? []) as CrmHist[]));
    if (lead.cliente_id) void supabase.from("clientes").select("razao_social").eq("id", lead.cliente_id).maybeSingle()
      .then(({ data }) => setClienteNome(data?.razao_social ?? null));
    else setClienteNome(null);
  }, [lead]);

  async function desvincular() {
    if (!lead) return;
    const { error } = await supabase.from("crm_leads").update({ cliente_id: null }).eq("id", lead.id);
    if (error) return toast.error(`Não foi possível desfazer o vínculo: ${error.message}`);
    toast.success("Vínculo desfeito");
    await onSalvo();
  }

  async function salvar() {
    if (!f.nome_conta.trim()) return toast.error("Informe o nome da conta.");
    if (perdido && !f.motivo_perda.trim()) return toast.error("Informe o motivo da perda.");
    if (f.numero_lojas && !/^\d+$/.test(f.numero_lojas)) return toast.error("Número de lojas deve ser um número inteiro.");
    setSalvando(true);
    const payload = {
      nome_conta: f.nome_conta.trim(), cnpj: f.cnpj.trim() || null, cidade: f.cidade.trim() || null, uf: f.uf.trim().toUpperCase() || null,
      numero_lojas: f.numero_lojas ? Number(f.numero_lojas) : null, tier_a: f.tier_a, stage_id: f.stage_id,
      ultima_acao: f.ultima_acao.trim() || null, proxima_acao: f.proxima_acao.trim() || null, proxima_acao_data: f.proxima_acao_data || null,
      motivo_perda: perdido ? f.motivo_perda.trim() : lead?.motivo_perda ?? null,
      ...(ctx.gestao || !lead ? { representante_id: f.representante_id || ctx.userId } : {}),
    };
    const { error } = lead
      ? await supabase.from("crm_leads").update(payload).eq("id", lead.id)
      : await supabase.from("crm_leads").insert(payload as typeof payload & { representante_id: string }).select("id").single().then(async (r) => {
          if (!r.error && r.data) {
            const s = sugerirTarefa((ctx.stageMap.get(payload.stage_id)?.fase as Fase) ?? "0", { visita_em: null, amostra: false, cadastro_fornecedor: false, pago_em: null }, hojeISO());
            await supabase.from("crm_tasks").insert({ lead_id: r.data.id, tipo: s.tipo, vence_em: s.vence_em, responsavel: s.responsavel, created_by: ctx.userId });
          }
          return r;
        });
    setSalvando(false);
    if (error) return toast.error(`Não foi possível salvar: ${error.message}`);
    toast.success(lead ? "Lead atualizado" : "Lead criado");
    await onSalvo();
    onClose();
  }

  async function excluir() {
    if (!lead) return;
    const { error } = await supabase.from("crm_leads").delete().eq("id", lead.id);
    if (error) return toast.error(`Não foi possível excluir: ${error.message}`);
    toast.success("Lead excluído");
    await onSalvo();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? lead.nome_conta : "Novo lead"}</DialogTitle>
          {lead && <DialogDescription>No estágio desde {fmtData(lead.stage_desde)}. Mudar o estágio reinicia a contagem da régua.</DialogDescription>}
        </DialogHeader>
        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            {lead && <TabsTrigger value="hist">Histórico</TabsTrigger>}
            {lead?.cliente_id && <TabsTrigger value="comercial">Comercial</TabsTrigger>}
          </TabsList>
          <TabsContent value="dados" className="space-y-3 pt-2">
            <div><Label>Conta *</Label><Input value={f.nome_conta} onChange={set("nome_conta")} /></div>
            {lead && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
                <span className="flex-1 text-text-secondary">Cliente: <span className="text-text-primary">{lead.cliente_id ? (clienteNome ?? "vinculado") : "não vinculado"}</span></span>
                {(!lead.cliente_id || ctx.gestao) && <Button size="sm" variant="outline" onClick={() => setVincularAberto(true)}>{lead.cliente_id ? "Trocar cliente" : "Vincular cliente"}</Button>}
                {lead.cliente_id && ctx.gestao && <Button size="sm" variant="outline" className="text-destructive" onClick={desvincular}>Desfazer vínculo</Button>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CNPJ</Label><Input value={f.cnpj} onChange={set("cnpj")} inputMode="numeric" /></div>
              <div><Label>Nº de lojas</Label><Input value={f.numero_lojas} onChange={set("numero_lojas")} inputMode="numeric" /></div>
              <div><Label>Cidade</Label><Input value={f.cidade} onChange={set("cidade")} /></div>
              <div><Label>UF</Label><Input value={f.uf} onChange={set("uf")} maxLength={2} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={f.tier_a} onCheckedChange={(v) => setF({ ...f, tier_a: v })} /><Label>Tier A</Label></div>
            <div><Label>Representante</Label>
              {ctx.gestao ? (
                <Select value={f.representante_id} onValueChange={(v) => setF({ ...f, representante_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>{ctx.representantes.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
                </Select>
              ) : <Input value={nomeRep(ctx, f.representante_id)} disabled />}
            </div>
            <div><Label>Estágio</Label>
              <Select value={f.stage_id} onValueChange={(v) => setF({ ...f, stage_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ctx.stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
              {lead && f.stage_id !== lead.stage_id && <p className="text-xs text-gold mt-1">Mudar o estágio reinicia a contagem da régua.</p>}
            </div>
            {perdido && <div><Label>Motivo da perda *</Label><Textarea value={f.motivo_perda} onChange={set("motivo_perda")} /></div>}
            <div><Label>Última ação</Label><Input value={f.ultima_acao} onChange={set("ultima_acao")} /></div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div><Label>Próxima ação</Label><Input value={f.proxima_acao} onChange={set("proxima_acao")} /></div>
              <div><Label>Data</Label><Input type="date" value={f.proxima_acao_data} onChange={set("proxima_acao_data")} /></div>
            </div>
          </TabsContent>
          {lead && (
            <TabsContent value="hist" className="pt-2">
              {!hist ? <div className="text-sm text-text-secondary">Carregando…</div> : hist.length === 0 ? <div className="text-sm text-text-secondary">Sem histórico.</div> : (
                <table className="w-full text-xs"><thead><tr className="text-left text-text-secondary border-b border-border"><th className="py-1">De</th><th>Para</th><th>Data</th><th>Quem</th></tr></thead>
                  <tbody>{hist.map((h) => {
                    const transf = h.representante_anterior_id && h.representante_novo_id && h.representante_anterior_id !== h.representante_novo_id;
                    return (
                      <tr key={h.id} className="border-b border-border">
                        <td className="py-1.5">{h.evento && h.stage_anterior_id === h.stage_novo_id ? <span className="text-gold">{h.evento}</span> : transf ? nomeRep(ctx, h.representante_anterior_id) : ctx.stageMap.get(h.stage_anterior_id ?? "")?.nome ?? "—"}</td>
                        <td>{h.evento && h.stage_anterior_id === h.stage_novo_id ? "—" : h.evento ? `${ctx.stageMap.get(h.stage_novo_id ?? "")?.nome ?? "—"} (${h.evento})` : transf ? `${nomeRep(ctx, h.representante_novo_id)} (transferência)` : ctx.stageMap.get(h.stage_novo_id ?? "")?.nome ?? "—"}</td>
                        <td>{new Date(h.alterado_em).toLocaleDateString("pt-BR")}</td><td>{nomeRep(ctx, h.alterado_por)}</td>
                      </tr>
                    );
                  })}</tbody></table>
              )}
            </TabsContent>
          )}
          {lead?.cliente_id && (
            <TabsContent value="comercial" className="pt-2">
              <AbaComercial ctx={ctx} clienteId={lead.cliente_id} />
            </TabsContent>
          )}
        </Tabs>
        <DialogFooter className="gap-2 sm:justify-between">
          {lead && ctx.gestao ? <Button variant="outline" className="text-destructive" onClick={() => setConfirmarExcluir(true)}><Trash2 className="h-4 w-4" /> Excluir</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
          </div>
        </DialogFooter>
        {lead && vincularAberto && <VincularClienteDialog ctx={ctx} lead={lead} onClose={() => setVincularAberto(false)} onSalvo={onSalvo} />}
        <Confirmar aberto={confirmarExcluir} titulo="Excluir este lead?" texto="O lead, o histórico e as atividades dele serão apagados." onCancel={() => setConfirmarExcluir(false)} onOk={excluir} />
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- FORMULÁRIO DE ATIVIDADE ---------------- */
function AtividadeDialog({ ctx, atividade, onClose, onSalvo }: { ctx: Ctx; atividade: CrmActivity | null; onClose: () => void; onSalvo: () => Promise<void> }) {
  const [f, setF] = useState({
    data: atividade?.data ?? hojeISO(), tipo: (atividade?.tipo ?? "Reunião") as CrmAtividadeTipo, lead_id: atividade?.lead_id ?? "",
    resultado: atividade?.resultado ?? "", proximo_passo: atividade?.proximo_passo ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [perguntaMover, setPerguntaMover] = useState<CrmLead | null>(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const podeExcluir = !!atividade && (ctx.gestao || atividade.created_by === ctx.userId);
  const leadsOrd = useMemo(() => [...ctx.leads].sort((a, b) => a.nome_conta.localeCompare(b.nome_conta)), [ctx.leads]);

  async function salvar() {
    if (!f.lead_id) return toast.error("Escolha o lead.");
    const lead = ctx.leads.find((l) => l.id === f.lead_id);
    setSalvando(true);
    const payload = { data: f.data, tipo: f.tipo, lead_id: f.lead_id, resultado: f.resultado.trim() || null, proximo_passo: f.proximo_passo.trim() || null, representante_id: lead!.representante_id };
    const { error } = atividade
      ? await supabase.from("crm_activities").update(payload).eq("id", atividade.id)
      : await supabase.from("crm_activities").insert({ ...payload, created_by: ctx.userId });
    setSalvando(false);
    if (error) return toast.error(`Não foi possível salvar: ${error.message}`);
    toast.success(atividade ? "Atividade atualizada" : "Atividade registrada");
    await onSalvo();
    if ((f.tipo === "Reunião" || f.tipo === "Visita") && lead && ctx.stageMap.get(lead.stage_id)?.nome === STAGE_AGENDA) setPerguntaMover(lead);
    else onClose();
  }

  async function excluir() {
    if (!atividade) return;
    const { error } = await supabase.from("crm_activities").delete().eq("id", atividade.id);
    if (error) return toast.error(`Não foi possível excluir: ${error.message}`);
    toast.success("Atividade excluída");
    await onSalvo();
    onClose();
  }

  const apresentado = ctx.stages.find((s) => s.nome === STAGE_APRESENTADO);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{atividade ? "Atividade" : "Nova atividade"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data</Label><Input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></div>
            <div><Label>Tipo</Label>
              <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v as CrmAtividadeTipo })}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPOS_ATIVIDADE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <div><Label>Lead</Label>
            <Select value={f.lead_id} onValueChange={(v) => setF({ ...f, lead_id: v })}>
              <SelectTrigger><SelectValue placeholder={leadsOrd.length ? "Escolha o lead" : "Nenhum lead ainda"} /></SelectTrigger>
              <SelectContent>{leadsOrd.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome_conta}{ctx.gestao ? ` — ${nomeRep(ctx, l.representante_id)}` : ""}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Resultado</Label><Textarea value={f.resultado} onChange={(e) => setF({ ...f, resultado: e.target.value })} placeholder="O que aconteceu" /></div>
          <div><Label>Próximo passo</Label><Input value={f.proximo_passo} onChange={(e) => setF({ ...f, proximo_passo: e.target.value })} /></div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {podeExcluir ? <Button variant="outline" className="text-destructive" onClick={() => setConfirmarExcluir(true)}><Trash2 className="h-4 w-4" /> Excluir</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
          </div>
        </DialogFooter>
        <Confirmar aberto={confirmarExcluir} titulo="Excluir esta atividade?" texto="Essa ação não pode ser desfeita." onCancel={() => setConfirmarExcluir(false)} onOk={excluir} />
        <AlertDialog open={!!perguntaMover}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Mover este lead para Apresentado?</AlertDialogTitle>
              <AlertDialogDescription>{perguntaMover?.nome_conta} está em Agenda marcada.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setPerguntaMover(null); onClose(); }}>Não</AlertDialogCancel>
              <AlertDialogAction onClick={async () => { const l = perguntaMover!; setPerguntaMover(null); if (apresentado) await ctx.moverEstagio(l, apresentado.id); onClose(); }}>Sim</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

function MotivoPerdaDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (m: string) => void }) {
  const [m, setM] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Motivo da perda</DialogTitle><DialogDescription>Obrigatório para mover para Perdido.</DialogDescription></DialogHeader>
        <Textarea value={m} onChange={(e) => setM(e.target.value)} autoFocus />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button disabled={!m.trim()} onClick={() => onConfirm(m.trim())}>Mover para Perdido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Confirmar({ aberto, titulo, texto, onCancel, onOk }: { aberto: boolean; titulo: string; texto: string; onCancel: () => void; onOk: () => void }) {
  return (
    <AlertDialog open={aberto}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{titulo}</AlertDialogTitle><AlertDialogDescription>{texto}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => { onCancel(); onOk(); }}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ---------------- PARTE 3: COMERCIAL ---------------- */
function AbaComercial({ ctx, clienteId }: { ctx: Ctx; clienteId: string }) {
  const r = resumoComercial(ctx.comercial, clienteId);
  const dt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Total em pedidos" valor={0} rotulo={brl(r.totalPedidos)} />
        <Kpi label="Pedidos" valor={r.pedidos.length} />
        <Kpi label="Último pedido" valor={0} rotulo={r.ultimoPedido ? dt(r.ultimoPedido) : "—"} />
        <Kpi label="Cotações abertas" valor={r.cotacoesAbertas} />
      </div>
      <div>
        <div className="text-sm font-medium text-text-primary mb-1">Pedidos</div>
        {r.pedidos.length === 0 ? <div className="text-xs text-text-secondary">Nenhum pedido.</div> : (
          <table className="w-full text-xs"><thead><tr className="text-left text-text-secondary border-b border-border"><th className="py-1">Número</th><th>Data</th><th>Status</th><th className="text-right">Valor</th></tr></thead>
            <tbody>{r.pedidos.map((p) => (
              <tr key={p.id} className="border-b border-border">
                <td className="py-1.5"><Link to="/confirmation" search={{ id: p.id }} className="text-gold underline">{p.id}</Link></td>
                <td>{dt(p.data)}</td><td>{p.status ?? "—"}</td><td className="text-right">{brl(p.total)}</td>
              </tr>
            ))}</tbody></table>
        )}
      </div>
      <div>
        <div className="text-sm font-medium text-text-primary mb-1">Cotações</div>
        {r.cotacoes.length === 0 ? <div className="text-xs text-text-secondary">Nenhuma cotação.</div> : (
          <table className="w-full text-xs"><thead><tr className="text-left text-text-secondary border-b border-border"><th className="py-1">Número</th><th>Data</th><th>Status</th><th className="text-right">Valor</th></tr></thead>
            <tbody>{r.cotacoes.map((c) => (
              <tr key={c.id} className="border-b border-border">
                <td className="py-1.5"><Link to="/cotacoes" search={{ id: c.id }} className="text-gold underline">{c.id}</Link></td>
                <td>{dt(c.data)}</td><td className={COTACAO_ABERTA.includes(c.status) ? "text-gold" : ""}>{c.status}</td><td className="text-right">{brl(c.total)}</td>
              </tr>
            ))}</tbody></table>
        )}
      </div>
    </div>
  );
}

function VincularClienteDialog({ ctx, lead, onClose, onSalvo }: { ctx: Ctx; lead: CrmLead; onClose: () => void; onSalvo: () => Promise<void> }) {
  const [busca, setBusca] = useState(lead.cnpj ?? lead.nome_conta);
  const [res, setRes] = useState<{ id: string; razao_social: string | null; cnpj: string | null; cidade: string | null; estado: string | null }[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [cadastrar, setCadastrar] = useState(false);

  async function vincular(clienteId: string) {
    const { error } = await supabase.from("crm_leads").update({ cliente_id: clienteId }).eq("id", lead.id);
    if (error) {
      if (error.message.includes("outra carteira")) setBloqueado(true);
      return toast.error(error.message);
    }
    toast.success("Cliente vinculado");
    await onSalvo();
    onClose();
  }

  async function buscar() {
    const termo = busca.trim();
    if (!termo) return;
    setBuscando(true); setBloqueado(false);
    const dig = onlyDigits(termo);
    // Busca sob o RLS atual de clientes: só aparece o que o usuário já pode ver hoje.
    const q = supabase.from("clientes").select("id, razao_social, cnpj, cidade, estado").limit(20);
    const { data, error } = dig.length >= 11
      ? await q.or(`cnpj.eq.${dig},cnpj.eq.${formatCNPJ(dig)}`)
      : await q.or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%`);
    const lista = data ?? [];
    if (!error && dig.length >= 11 && !lista.length && !ctx.gestao) {
      const { data: outra } = await supabase.rpc("crm_reportar_conflito_cnpj", { p_lead_id: lead.id, p_cnpj: dig });
      if (outra) { setBloqueado(true); setRes([]); setBuscando(false); return; }
    }
    setBuscando(false);
    if (error) return toast.error(error.message);
    setRes(lista);
  }

  const rep = ctx.repMap.get(lead.representante_id);
  const inicial = useMemo<Cliente | null>(() => {
    if (!cadastrar) return null;
    const now = new Date().toISOString();
    const dig = onlyDigits(lead.cnpj ?? "");
    return {
      id: crypto.randomUUID(), criadoEm: now, atualizadoEm: now,
      cadastradoPorVendedorId: lead.representante_id, cadastradoPorVendedorNome: rep?.nome ?? "",
      tipoPessoa: "PJ", cpf: "", cpfFormatado: "", nomeCompletoPF: "", dataNascimento: "", pontoReferencia: "",
      tipoEndereco: "casa", observacaoEntrega: "", socialHandle: "",
      cnpj: dig, cnpjFormatado: lead.cnpj ?? "", razaoSocial: lead.nome_conta, nomeFantasia: "",
      inscricaoEstadual: "", isentoIE: false, situacaoCadastral: "desconhecida",
      logradouro: "", numero: "", complemento: "", bairro: "", cidade: lead.cidade ?? "", estado: (lead.uf ?? "").toUpperCase(), cep: "",
      enderecoEntregaIgual: true, contatoNome: "", contatoEmail: "", contatoTelefone: "", contatoWhatsapp: "",
      telefonesInternacionais: false, financeiroNome: "", financeiroEmail: "", financeiroTelefone: "",
      segmento: "boutique_decoracao", canal: "indicacao", regiaoAtuacao: "", observacoes: "", tags: [], ativo: true,
      isInternacional: false, pais: "", documentoTipo: "Passport", documentoNumero: "",
    } as Cliente;
  }, [cadastrar, lead, rep]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular cliente</DialogTitle>
          <DialogDescription>Busque por CNPJ (prioridade) ou pelo nome, entre os clientes que você já pode ver.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void buscar()} placeholder="CNPJ ou nome" />
          <Button onClick={buscar} disabled={buscando}>{buscando ? "Buscando…" : "Buscar"}</Button>
        </div>
        {bloqueado && <div className="rounded-md bg-destructive/10 text-destructive text-sm p-2 flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> Este CNPJ já está em outra carteira. A gestão foi avisada.</div>}
        {res && !bloqueado && (res.length === 0 ? (
          <div className="space-y-2 text-sm">
            <div className="text-text-secondary">Nenhum cliente encontrado.</div>
            <Button variant="outline" onClick={() => setCadastrar(true)}><Plus className="h-4 w-4" /> Cadastrar cliente com os dados do lead</Button>
          </div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {res.map((c) => (
              <button key={c.id} onClick={() => void vincular(c.id)} className="w-full text-left rounded-md border border-border p-2 text-sm hover:bg-surface-hover">
                <div className="text-text-primary">{c.razao_social ?? "—"}</div>
                <div className="text-xs text-text-secondary">{c.cnpj ?? "sem CNPJ"} · {c.cidade ?? "—"}/{c.estado ?? "—"}</div>
              </button>
            ))}
          </div>
        ))}
        {cadastrar && inicial && (
          <ClienteFormModal open onOpenChange={(o) => !o && setCadastrar(false)} initial={inicial}
            onSaved={(c) => { setCadastrar(false); void vincular(c.id); }} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- 6. MAPA DE ATUAÇÃO (Fetély Connect) ---------------- */
const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];
const SEM_VINCULO = "__nenhum";

type ClienteUf = { id: string; razao_social: string | null; nome_fantasia: string | null; cidade: string | null };

function MapaAtuacaoTab({ ctx }: { ctx: Ctx }) {
  const [mapa, setMapa] = useState<MapaAtuacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ufSel, setUfSel] = useState<string | null>(null);
  const [clientesUf, setClientesUf] = useState<ClienteUf[] | null>(null);
  const [vinculo, setVinculo] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const m = await carregarMapaAtuacao();
      setMapa(m);
      setVinculo(Object.fromEntries(m.representantes.map((r) => [r.id, r.orderProUserId ?? SEM_VINCULO])));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    if (!ufSel || !ctx.gestao) { setClientesUf(null); return; }
    let vivo = true;
    void (async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, razao_social, nome_fantasia, cidade")
        .eq("estado", ufSel)
        .order("nome_fantasia", { ascending: true });
      if (vivo) setClientesUf(error ? [] : ((data ?? []) as ClienteUf[]));
    })();
    return () => { vivo = false; };
  }, [ufSel, ctx.gestao]);

  async function salvarVinculo(rep: MapaRep) {
    const escolhido = vinculo[rep.id] ?? SEM_VINCULO;
    setSalvando(rep.id);
    try {
      await vincularRepresentanteMapa({
        data: { representanteId: rep.id, orderProUserId: escolhido === SEM_VINCULO ? null : escolhido },
      });
      toast.success(escolhido === SEM_VINCULO ? `Vínculo de ${rep.nome} removido` : `${rep.nome} vinculado`);
      await carregar();
    } catch (e) {
      toast.error(`Não foi possível vincular: ${(e as Error).message}`);
    } finally {
      setSalvando(null);
    }
  }

  if (erro)
    return (
      <div className="py-10 text-center space-y-3">
        <p className="text-destructive text-sm">Não foi possível carregar o mapa de atuação: {erro}</p>
        <Button size="sm" variant="outline" onClick={() => void carregar()}><RefreshCw className="h-4 w-4" /> Tentar de novo</Button>
      </div>
    );
  if (!mapa) return <div className="py-10 text-center text-text-secondary text-sm">Carregando mapa de atuação…</div>;

  const repsPorUf = new Map<string, MapaRep[]>();
  for (const uf of UFS) repsPorUf.set(uf, []);
  for (const r of mapa.representantes) for (const uf of r.ufs) repsPorUf.get(uf)?.push(r);
  const nacionais = mapa.representantes.filter((r) => r.nacional);
  const meuRep = mapa.representantes.find((r) => r.orderProUserId === ctx.userId);
  const minhasUfs = new Set(meuRep?.ufs ?? []);
  const candidatos = new Set(mapa.ufsCandidatos);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">
          Dados do Fetély Connect · atualizado em {new Date(mapa.geradoEm).toLocaleString("pt-BR")}
        </p>
        <Button size="sm" variant="outline" onClick={() => void carregar()}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
      </div>

      {meuRep && (
        <Card className="border-primary">
          <CardContent className="p-4 space-y-1">
            <div className="text-sm font-medium text-text-primary flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Sua área de atuação
            </div>
            <div className="text-sm text-text-secondary">
              {meuRep.nacional ? "Atendimento nacional" : (meuRep.ufs.length ? meuRep.ufs.join(", ") : "Nenhum estado definido")}
              {meuRep.linhas.length > 0 && ` · Linhas: ${meuRep.linhas.join(", ")}`}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-2">
        {UFS.map((uf) => {
          const reps = repsPorUf.get(uf) ?? [];
          const minha = minhasUfs.has(uf);
          const selecionada = ufSel === uf;
          return (
            <button
              key={uf}
              type="button"
              disabled={!ctx.gestao}
              onClick={() => setUfSel(selecionada ? null : uf)}
              className={cn(
                "rounded-lg border p-2 text-left transition-colors",
                selecionada ? "border-primary bg-primary/10" : minha ? "border-primary/60 bg-primary/5" : "border-border bg-card",
                ctx.gestao && "hover:border-primary/60 cursor-pointer",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-semibold text-text-primary">{uf}</span>
                {mapa.ufPrioritaria === uf && <span className="text-[10px] text-primary font-medium">prioritária</span>}
              </div>
              <div className="mt-1 space-y-0.5">
                {reps.length === 0 && <span className="block text-[11px] text-text-secondary">sem representante</span>}
                {reps.map((r) => (
                  <span key={r.id} className={cn("block text-[11px] truncate", r.orderProUserId === ctx.userId ? "text-primary font-medium" : "text-text-secondary")}>
                    {r.nome}
                  </span>
                ))}
                {candidatos.has(uf) && <span className="block text-[10px] text-amber-600">candidato em prospecção</span>}
              </div>
            </button>
          );
        })}
      </div>

      {nacionais.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="text-sm font-medium text-text-primary">Atendimento nacional</div>
            {nacionais.map((r) => (
              <div key={r.id} className="text-sm text-text-secondary">
                {r.nome}{r.linhas.length > 0 && ` · ${r.linhas.join(", ")}`}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {ctx.gestao && ufSel && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-sm font-medium text-text-primary">Estado: {ufSel}</div>
            <div className="text-sm text-text-secondary">
              Quem atende: {(repsPorUf.get(ufSel) ?? []).map((r) => r.nome).join(", ") || "ninguém"}
              {nacionais.length > 0 && ` · Nacional: ${nacionais.map((r) => r.nome).join(", ")}`}
            </div>
            <div className="text-sm font-medium text-text-primary pt-2">Clientes em {ufSel}</div>
            {clientesUf === null && <p className="text-sm text-text-secondary">Carregando…</p>}
            {clientesUf?.length === 0 && <p className="text-sm text-text-secondary">Nenhum cliente cadastrado neste estado.</p>}
            {clientesUf && clientesUf.length > 0 && (
              <ul className="text-sm text-text-secondary space-y-0.5 max-h-64 overflow-y-auto">
                {clientesUf.map((c) => (
                  <li key={c.id}>{c.nome_fantasia || c.razao_social}{c.cidade ? ` — ${c.cidade}` : ""}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {ctx.gestao && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium text-text-primary">Vínculo com usuários do Order Pro</div>
            <p className="text-xs text-text-secondary">
              Vincule cada representante da rede ao usuário dele aqui no Order Pro. O vínculo destaca a área dele no mapa.
            </p>
            <div className="space-y-2">
              {mapa.representantes.map((r) => {
                const atual = r.orderProUserId ?? SEM_VINCULO;
                const escolhido = vinculo[r.id] ?? SEM_VINCULO;
                return (
                  <div key={r.id} className="flex flex-wrap items-center gap-2">
                    <div className="min-w-48">
                      <div className="text-sm text-text-primary">{r.nome}</div>
                      <div className="text-[11px] text-text-secondary">
                        {r.nacional ? "Nacional" : r.ufs.join(", ") || "—"}{r.linhas.length > 0 && ` · ${r.linhas.join(", ")}`}
                      </div>
                    </div>
                    <Select value={escolhido} onValueChange={(v) => setVinculo((s) => ({ ...s, [r.id]: v }))}>
                      <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Usuário do Order Pro" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM_VINCULO}>Sem vínculo</SelectItem>
                        {ctx.representantes.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" disabled={salvando === r.id || escolhido === atual} onClick={() => void salvarVinculo(r)}>
                      {salvando === r.id ? "Salvando…" : "Salvar"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
