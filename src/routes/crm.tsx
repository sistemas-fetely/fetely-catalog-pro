import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, AlertTriangle, Trash2 } from "lucide-react";
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
  GRUPOS, REGIOES, TIPOS_ATIVIDADE, STAGE_AGENDA, STAGE_APRESENTADO, STAGE_PERDIDO, STAGE_FECHADO,
  type CrmStage, type CrmLead, type CrmActivity, type CrmRep, type CrmHist, type CrmGrupo, type CrmRegiao, type CrmAtividadeTipo,
} from "@/lib/crm";

export const Route = createFileRoute("/crm")({
  head: () => ({
    meta: [
      { title: "CRM de Representantes — Fetély B2B" },
      { name: "description", content: "Funil, agenda e atividades dos representantes Fetély." },
      { property: "og:title", content: "CRM de Representantes — Fetély B2B" },
      { property: "og:description", content: "Funil, agenda e atividades dos representantes Fetély." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CrmPage,
});

const BORDO = "#7B1523";
const TODOS = "__todos";

type Dados = { stages: CrmStage[]; leads: CrmLead[]; atividades: CrmActivity[]; representantes: CrmRep[] };

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
  const [leadAberto, setLeadAberto] = useState<CrmLead | "novo" | null>(null);
  const [ativAberta, setAtivAberta] = useState<CrmActivity | "nova" | null>(null);
  const [perdaPend, setPerdaPend] = useState<{ lead: CrmLead; stageId: string } | null>(null);

  const recarregar = useCallback(async () => {
    try {
      setDados(await carregarCrm());
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
  const filtrar = <T extends { representante_id: string }>(xs: T[]) =>
    gestao && repFiltro !== TODOS ? xs.filter((x) => x.representante_id === repFiltro) : xs;

  async function moverEstagio(lead: CrmLead, stageId: string, motivo?: string) {
    if (lead.stage_id === stageId) return;
    const destino = stageMap.get(stageId);
    if (destino?.nome === STAGE_PERDIDO && !motivo) {
      setPerdaPend({ lead, stageId });
      return;
    }
    const patch: Partial<CrmLead> = { stage_id: stageId };
    if (motivo) patch.motivo_perda = motivo;
    const { error } = await supabase.from("crm_leads").update(patch).eq("id", lead.id);
    if (error) return toast.error(`Não foi possível mudar o estágio: ${error.message}`);
    toast.success(`Movido para ${destino?.nome}`);
    await recarregar();
  }

  const ctx: Ctx = {
    ...dados, stageMap, repMap, gestao, conflitos, userId: user?.id ?? "",
    abrirLead: (l) => setLeadAberto(l), abrirAtividade: (a) => setAtivAberta(a), moverEstagio,
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

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-text-primary">CRM de Representantes</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setLeadAberto("novo")}><Plus className="h-4 w-4" /> Lead</Button>
          <Button size="sm" variant="outline" onClick={() => setAtivAberta("nova")}><Plus className="h-4 w-4" /> Atividade</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-3 px-3">
          <TabsList>
            <TabsTrigger value="geral">Visão geral</TabsTrigger>
            <TabsTrigger value="funil">Funil</TabsTrigger>
            <TabsTrigger value="rep">Por representante</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="ativ">Atividades</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="geral">
          <VisaoGeral ctx={ctx} onRep={(id) => { setRepFiltro(id); setTab("rep"); }} />
        </TabsContent>
        <TabsContent value="funil" className="space-y-3">
          {seletorRep}
          <Funil ctx={ctx} leads={filtrar(dados.leads)} />
        </TabsContent>
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
      </Tabs>

      {leadAberto && (
        <LeadDialog ctx={ctx} lead={leadAberto === "novo" ? null : leadAberto}
          repPadrao={gestao ? (repFiltro !== TODOS ? repFiltro : dados.representantes[0]?.id ?? "") : user?.id ?? ""}
          onClose={() => setLeadAberto(null)} onSalvo={recarregar} />
      )}
      {ativAberta && (
        <AtividadeDialog ctx={ctx} atividade={ativAberta === "nova" ? null : ativAberta}
          onClose={() => setAtivAberta(null)} onSalvo={recarregar} />
      )}
      {perdaPend && (
        <MotivoPerdaDialog onCancel={() => setPerdaPend(null)}
          onConfirm={async (m) => { const p = perdaPend; setPerdaPend(null); await moverEstagio(p.lead, p.stageId, m); }} />
      )}
    </div>
  );
}

interface Ctx extends Dados {
  stageMap: Map<string, CrmStage>;
  repMap: Map<string, CrmRep>;
  gestao: boolean;
  conflitos: Set<string>;
  userId: string;
  abrirLead: (l: CrmLead) => void;
  abrirAtividade: (a: CrmActivity) => void;
  moverEstagio: (l: CrmLead, stageId: string, motivo?: string) => Promise<void>;
}

const nomeRep = (ctx: Ctx, id: string | null) => (id && ctx.repMap.get(id)?.nome) || "Gestão";
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

function Kpi({ label, valor, alerta }: { label: string; valor: number; alerta?: boolean }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className={cn("text-2xl font-display mt-1", alerta && valor > 0 ? "text-destructive" : "text-text-primary")}>{valor}</div>
    </CardContent></Card>
  );
}

/* ---------------- 1. VISÃO GERAL ---------------- */
function VisaoGeral({ ctx, onRep }: { ctx: Ctx; onRep: (id: string) => void }) {
  const hoje = hojeISO();
  const [agrupar, setAgrupar] = useState<"grupo" | "regiao">("grupo");
  const abertos = ctx.leads.filter((l) => aberto(ctx, l));
  const fora = abertos.filter((l) => motivosRegua(l, ctx.stageMap.get(l.stage_id), hoje).length > 0);
  const reunioes7 = abertos.filter((l) => {
    if (ctx.stageMap.get(l.stage_id)?.nome !== STAGE_AGENDA || !l.proxima_acao_data) return false;
    const d = diasEntre(hoje, l.proxima_acao_data);
    return d >= 0 && d <= 7;
  });
  const fechadoId = ctx.stages.find((s) => s.nome === STAGE_FECHADO)?.id;
  const lojas = (ls: CrmLead[]) => ls.reduce((a, l) => a + (l.numero_lojas ?? 0), 0);

  const linhas = ctx.representantes.map((r) => {
    const meus = ctx.leads.filter((l) => l.representante_id === r.id);
    const meusAbertos = meus.filter((l) => aberto(ctx, l));
    const prox = meusAbertos.filter((l) => l.proxima_acao_data).sort((a, b) => a.proxima_acao_data!.localeCompare(b.proxima_acao_data!))[0];
    return {
      rep: r, contas: meus.length, lojas: lojas(meus), negociacao: meusAbertos.length,
      fechados: meus.filter((l) => l.stage_id === fechadoId).length,
      fora: meusAbertos.filter((l) => motivosRegua(l, ctx.stageMap.get(l.stage_id), hoje).length).length,
      prox,
    };
  });
  const grupos = agrupar === "grupo" ? GRUPOS : REGIOES;

  const proximas = abertos.filter((l) => l.proxima_acao || l.proxima_acao_data)
    .sort((a, b) => (a.proxima_acao_data ?? "9999").localeCompare(b.proxima_acao_data ?? "9999"));

  return (
    <div className="space-y-6 pt-2">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {ctx.gestao && <Kpi label="Representantes com funil ativo" valor={new Set(abertos.map((l) => l.representante_id)).size} />}
        {ctx.gestao && <Kpi label="Representantes com pedido fechado" valor={new Set(ctx.leads.filter((l) => l.stage_id === fechadoId).map((l) => l.representante_id)).size} />}
        <Kpi label="Contas em negociação" valor={abertos.length} />
        <Kpi label="Lojas nessas contas" valor={lojas(abertos)} />
        <Kpi label="Reuniões nos próximos 7 dias" valor={reunioes7.length} />
        <Kpi label="Contas fora da régua" valor={fora.length} alerta />
      </div>

      <Card><CardContent className="p-4 space-y-2">
        <div className="text-sm font-medium text-text-primary">Funil</div>
        {ctx.stages.map((s) => {
          const ls = ctx.leads.filter((l) => l.stage_id === s.id);
          const max = Math.max(1, ...ctx.stages.map((x) => ctx.leads.filter((l) => l.stage_id === x.id).length));
          return (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <div className="w-32 sm:w-40 shrink-0 text-text-secondary truncate">{s.nome}</div>
              <div className="flex-1 h-5 bg-muted rounded">
                <div className="h-5 rounded" style={{ width: `${(ls.length / max) * 100}%`, background: s.cor, minWidth: ls.length ? 6 : 0 }} />
              </div>
              <div className="w-28 text-right text-text-primary whitespace-nowrap">{ls.length} contas · {lojas(ls)} lojas</div>
            </div>
          );
        })}
      </CardContent></Card>

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
            <table className="w-full text-sm min-w-[720px]">
              <thead><tr className="text-left text-xs text-text-secondary border-b border-border">
                <th className="py-2">Representante</th><th>Contas</th><th>Lojas</th><th>Em negociação</th><th>Pedidos fechados</th><th>Fora da régua</th><th>Próxima ação</th>
              </tr></thead>
              <tbody>
                {grupos.map((g) => {
                  const ls = linhas.filter((x) => (agrupar === "grupo" ? x.rep.grupo : x.rep.regiao) === g);
                  if (!ls.length) return null;
                  return [
                    <tr key={g}><td colSpan={7} className="pt-3 pb-1 text-xs uppercase tracking-wide text-gold">{g}</td></tr>,
                    ...ls.map((x) => (
                      <tr key={x.rep.id} className="border-b border-border hover:bg-surface-hover cursor-pointer" onClick={() => onRep(x.rep.id)}>
                        <td className="py-2 text-text-primary">{x.rep.nome}</td><td>{x.contas}</td><td>{x.lojas}</td><td>{x.negociacao}</td><td>{x.fechados}</td>
                        <td className={x.fora ? "text-destructive font-medium" : ""}>{x.fora}</td>
                        <td className="text-xs">{x.prox ? `${fmtData(x.prox.proxima_acao_data)} · ${x.prox.proxima_acao ?? x.prox.nome_conta}` : "—"}</td>
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
          <div className="text-sm font-medium text-text-primary">Minhas próximas ações</div>
          {proximas.length === 0 ? <Vazio texto="Nenhuma próxima ação registrada." /> : proximas.map((l) => (
            <button key={l.id} onClick={() => ctx.abrirLead(l)} className="w-full text-left flex items-center justify-between gap-2 py-2 border-b border-border text-sm">
              <span><span className="text-text-primary">{l.nome_conta}</span> <span className="text-text-secondary">— {l.proxima_acao ?? "—"}</span></span>
              <span className="text-xs whitespace-nowrap">{fmtData(l.proxima_acao_data)}</span>
            </button>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}

/* ---------------- 2. FUNIL ---------------- */
function Funil({ ctx, leads }: { ctx: Ctx; leads: CrmLead[] }) {
  const hoje = hojeISO();
  const [sobre, setSobre] = useState<string | null>(null);
  if (!ctx.leads.length) return <Vazio texto="Nenhum lead ainda." />;
  return (
    <div className="overflow-x-auto pb-2 -mx-3 px-3">
      <div className="flex gap-3 min-w-max">
        {ctx.stages.map((s) => {
          const ls = leads.filter((l) => l.stage_id === s.id);
          return (
            <div key={s.id}
              onDragOver={(e) => { e.preventDefault(); setSobre(s.id); }}
              onDragLeave={() => setSobre(null)}
              onDrop={(e) => {
                e.preventDefault(); setSobre(null);
                const lead = ctx.leads.find((l) => l.id === e.dataTransfer.getData("text/plain"));
                if (lead) void ctx.moverEstagio(lead, s.id);
              }}
              className={cn("w-64 shrink-0 rounded-lg border border-border bg-surface flex flex-col", sobre === s.id && "ring-2 ring-gold")}>
              <div className="px-3 py-2 border-b border-border flex items-center gap-2" style={{ borderTop: `4px solid ${s.cor}` }}>
                <span className="text-sm font-medium text-text-primary flex-1">{s.nome}</span>
                <span className="text-xs text-text-secondary">{ls.length}</span>
              </div>
              <div className="p-2 space-y-2 flex-1 min-h-24">
                {ls.map((l) => {
                  const m = motivosRegua(l, s, hoje);
                  return (
                    <div key={l.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                      onClick={() => ctx.abrirLead(l)}
                      className="rounded-md border bg-background p-2.5 text-xs space-y-1 cursor-pointer active:opacity-70"
                      style={{ borderColor: l.tier_a ? BORDO : undefined, borderWidth: l.tier_a ? 2 : 1 }}>
                      <div className="flex items-start gap-1 flex-wrap">
                        <span className="text-sm font-medium text-text-primary flex-1">{l.nome_conta}</span>
                        {l.tier_a && <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold border" style={{ borderColor: BORDO, color: BORDO }}>Tier A</span>}
                        {ctx.gestao && ctx.conflitos.has(l.id) && <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-destructive/15 text-destructive">Conflito</span>}
                      </div>
                      {ctx.gestao && <div className="text-text-secondary">{nomeRep(ctx, l.representante_id)}</div>}
                      <div className="text-text-secondary">{l.numero_lojas ?? 0} lojas</div>
                      {(l.proxima_acao || l.proxima_acao_data) && <div className="text-text-primary">{fmtData(l.proxima_acao_data)} · {l.proxima_acao ?? ""}</div>}
                      {m.length > 0 && <div className="text-destructive font-medium">{m.join(", ")}</div>}
                    </div>
                  );
                })}
              </div>
              {s.prazo_max_dias != null && <div className="px-3 py-1.5 border-t border-border text-[11px] text-text-secondary">Régua: até {s.prazo_max_dias} dias</div>}
            </div>
          );
        })}
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
  const perdido = ctx.stageMap.get(f.stage_id)?.nome === STAGE_PERDIDO;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (!lead) return;
    void supabase.from("crm_stage_history").select("*").eq("lead_id", lead.id).order("alterado_em", { ascending: false })
      .then(({ data }) => setHist((data ?? []) as CrmHist[]));
  }, [lead]);

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
      : await supabase.from("crm_leads").insert(payload as typeof payload & { representante_id: string });
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
            <TabsTrigger value="comercial" disabled>Comercial</TabsTrigger>
          </TabsList>
          <TabsContent value="dados" className="space-y-3 pt-2">
            <div><Label>Conta *</Label><Input value={f.nome_conta} onChange={set("nome_conta")} /></div>
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
                        <td className="py-1.5">{transf ? nomeRep(ctx, h.representante_anterior_id) : ctx.stageMap.get(h.stage_anterior_id ?? "")?.nome ?? "—"}</td>
                        <td>{transf ? `${nomeRep(ctx, h.representante_novo_id)} (transferência)` : ctx.stageMap.get(h.stage_novo_id ?? "")?.nome ?? "—"}</td>
                        <td>{new Date(h.alterado_em).toLocaleDateString("pt-BR")}</td><td>{nomeRep(ctx, h.alterado_por)}</td>
                      </tr>
                    );
                  })}</tbody></table>
              )}
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
