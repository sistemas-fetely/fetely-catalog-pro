// CRM Parte 4 — peças compartilhadas pelo card guiado, pela rodada, pelas tarefas e pelo kanban.
import { useState } from "react";
import { toast } from "sonner";
import { Copy, CheckSquare, Square, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hojeISO, fmtData, type CrmActivity, type CrmComercial, type CrmLead, type CrmRep, type CrmRound, type CrmStage, type CrmTask, type CrmAtividadeTipo } from "@/lib/crm";
import {
  FASES, SEG_ALIMENTAR, SEG_ESPECIALIZADO, SEG_COM_REDE, CATEGORIAS, EM_QUE_PE, MOTIVOS, TASK_TIPOS, ESFORCO,
  calcClasse, calcNivel, temperatura, prioridadeDia, alertasLead, preencherFrase,
  type Fase, type Classe, type Nivel, type Temperatura, type Prioridade, type Sugestao, type TaskResp, type TaskTipo,
} from "@/lib/crmFases";

export const BORDO = "#7B1523";

export interface Ctx {
  stages: CrmStage[]; leads: CrmLead[]; atividades: CrmActivity[]; representantes: CrmRep[]; comercial: CrmComercial;
  tarefas: CrmTask[]; rodadas: CrmRound[];
  stageMap: Map<string, CrmStage>; repMap: Map<string, CrmRep>;
  gestao: boolean; conflitos: Set<string>; userId: string;
  abrirLead: (l: CrmLead) => void;
  abrirAtividade: (a: CrmActivity) => void;
  moverEstagio: (l: CrmLead, stageId: string, motivo?: string) => Promise<void>;
  recarregar: () => Promise<void>;
}

export const nomeRep = (ctx: Pick<Ctx, "repMap">, id: string | null) => (id && ctx.repMap.get(id)?.nome) || "Gestão";
export const faseDe = (ctx: Pick<Ctx, "stageMap">, l: CrmLead): Fase | null => (ctx.stageMap.get(l.stage_id)?.fase as Fase) ?? null;
export const stageDaFase = (ctx: Pick<Ctx, "stages">, f: Fase) => ctx.stages.find((s) => s.fase === f);
export const tarefaAberta = (ctx: Pick<Ctx, "tarefas">, leadId: string) => ctx.tarefas.find((t) => t.lead_id === leadId && t.status === "Aberta") ?? null;
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface InfoLead { fase: Fase | null; classe: Classe; nivel: Nivel | null; temp: Temperatura; prio: Prioridade; alertas: string[]; tarefa: CrmTask | null }
export function infoLead(ctx: Pick<Ctx, "stageMap" | "tarefas">, l: CrmLead, hoje = hojeISO()): InfoLead {
  const fase = faseDe(ctx, l);
  const classe = calcClasse(l.numero_lojas, l.faturamento_esperado_mes, l.cnpj);
  const nivel = calcNivel(fase, l);
  const temp = temperatura(l.ultimo_toque_em, hoje);
  const tarefa = tarefaAberta(ctx, l.id);
  return { fase, classe, nivel, temp, prio: prioridadeDia(nivel, l, temp), alertas: alertasLead(fase, l, tarefa?.vence_em ?? null, hoje), tarefa };
}

/* ---------- pequenos visuais ---------- */
export function Chip({ ativo, onClick, children, className }: { ativo?: boolean; onClick?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("min-h-9 rounded-full border px-3 py-1.5 text-xs transition-colors",
        ativo ? "border-gold bg-gold/15 text-text-primary font-medium" : "border-border text-text-secondary hover:border-gold/60", className)}>
      {children}
    </button>
  );
}
export function Marca({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-sm text-text-primary min-h-9 text-left">
      {checked ? <CheckSquare className="h-5 w-5 text-gold shrink-0" /> : <Square className="h-5 w-5 text-text-secondary shrink-0" />}
      <span>{children}</span>
    </button>
  );
}
const TEMP_COR: Record<Temperatura, string> = { Quente: "bg-red-500", Morno: "bg-amber-400", Frio: "bg-sky-400" };
export function TempDot({ t, label }: { t: Temperatura; label?: boolean }) {
  return <span className="inline-flex items-center gap-1 text-xs text-text-secondary"><span className={cn("h-2.5 w-2.5 rounded-full", TEMP_COR[t])} />{label && t}</span>;
}
export function Selo({ children, tom = "neutro" }: { children: React.ReactNode; tom?: "neutro" | "gold" | "alerta" | "bordo" }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold border whitespace-nowrap",
      tom === "gold" && "border-gold/50 text-gold", tom === "alerta" && "bg-destructive/15 text-destructive border-transparent",
      tom === "neutro" && "border-border text-text-secondary")}
      style={tom === "bordo" ? { borderColor: BORDO, color: BORDO } : undefined}>{children}</span>
  );
}
export function FaseChip({ fase }: { fase: Fase | null }) {
  if (!fase) return null;
  return <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-primary whitespace-nowrap">{fase === "X" ? "X" : fase} · {FASES[fase].nome}</span>;
}
export const textoTarefa = (t: CrmTask | null) => (t ? `${t.tipo}${t.descricao ? ` — ${t.descricao}` : ""} · ${fmtData(t.vence_em)} · ${t.responsavel}` : "sem próxima atividade");

export function FraseBox({ texto }: { texto: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-text-secondary">Frase pronta</div>
      <p className="text-sm text-text-primary">{texto}</p>
      <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(texto); toast.success("Frase copiada"); }}><Copy className="h-4 w-4" /> Copiar</Button>
    </div>
  );
}
export function fraseDaFase(ctx: Ctx, l: CrmLead, fase: Fase): string | null {
  const f = FASES[fase].frase;
  if (!f) return null;
  const dia = l.visita_em ? new Date(l.visita_em).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }) : undefined;
  return preencherFrase(f, {
    nome: l.nome_conta, rep: nomeRep(ctx, l.representante_id), dia, segmento: l.segmento ?? undefined,
    valor: l.valor_estimado ? l.valor_estimado.toLocaleString("pt-BR") : undefined,
    data: new Date(Date.now() + 10 * 86400000).toLocaleDateString("pt-BR"),
  });
}

/* ---------- próxima atividade ---------- */
export function ProximaAtividade({ valor, onChange, titulo = "Próxima atividade" }: { valor: Sugestao; onChange: (s: Sugestao) => void; titulo?: string }) {
  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-text-secondary">{titulo}</div>
      <div className="flex flex-wrap gap-1.5">
        {TASK_TIPOS.map((t) => <Chip key={t} ativo={valor.tipo === t} onClick={() => onChange({ ...valor, tipo: t as TaskTipo })}>{t}</Chip>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" className="w-40" value={valor.vence_em} onChange={(e) => onChange({ ...valor, vence_em: e.target.value })} />
        {(["Representante", "Gestão"] as TaskResp[]).map((r) => <Chip key={r} ativo={valor.responsavel === r} onClick={() => onChange({ ...valor, responsavel: r })}>{r}</Chip>)}
      </div>
      <Input placeholder="Detalhe (opcional)" value={valor.descricao ?? ""} onChange={(e) => onChange({ ...valor, descricao: e.target.value })} />
    </div>
  );
}

/* ---------- campos da fase ("Você marca") ---------- */
export type Patch = Partial<CrmLead>;
const ATALHOS_FAT = [{ r: "até 1,5 mil", v: 1000 }, { r: "1,5 a 5 mil", v: 3000 }, { r: "acima de 5 mil", v: 6000 }];
const FORMAS = ["PIX", "Boleto", "Cartão"];

export function CamposFase({ ctx, lead, fase, set, onVincular, numeroPedido }: {
  ctx: Ctx; lead: CrmLead; fase: Fase; set: (p: Patch) => void; onVincular?: () => void; numeroPedido?: string | null;
}) {
  const hoje = hojeISO();
  const [redeAberta, setRedeAberta] = useState(!!lead.rede_grupo || (!!lead.segmento && SEG_COM_REDE.includes(lead.segmento)));
  const [enviando, setEnviando] = useState(false);
  const num = (v: string) => (v === "" ? null : Number(v.replace(",", ".")));

  async function enviarFoto(file: File) {
    setEnviando(true);
    const path = `${lead.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("crm-gondola").upload(path, file);
    setEnviando(false);
    if (error) return toast.error(`Não foi possível enviar a foto: ${error.message}`);
    set({ foto_gondola: path, sell_out_em: hoje });
    toast.success("Foto anexada");
  }

  switch (fase) {
    case "0":
      return (
        <div><Label>Data e hora da visita *</Label>
          <Input type="datetime-local" value={lead.visita_em ? lead.visita_em.slice(0, 16) : ""}
            onChange={(e) => set({ visita_em: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
      );
    case "1":
      return (
        <div className="space-y-1">
          <div className="text-sm text-text-secondary">Visita: <span className="text-text-primary">{lead.visita_em ? new Date(lead.visita_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}</span></div>
          <Marca checked={lead.visita_confirmada} onChange={(v) => set({ visita_confirmada: v })}>Confirmado na véspera</Marca>
        </div>
      );
    case "2": {
      const classe = calcClasse(lead.numero_lojas, lead.faturamento_esperado_mes, lead.cnpj);
      return (
        <div className="space-y-3">
          <div className="text-sm text-text-secondary">1. Loja: <span className="text-text-primary">{lead.nome_conta}</span> · {lead.cidade ?? "—"}/{lead.uf ?? "—"}</div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>2. CNPJ (opcional)</Label><Input inputMode="numeric" value={lead.cnpj ?? ""} onChange={(e) => set({ cnpj: e.target.value || null })} /></div>
            <div><Label>3. Quantas lojas *</Label><Input inputMode="numeric" value={lead.numero_lojas ?? ""} onChange={(e) => set({ numero_lojas: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value.replace(/\D/g, "") || "0")) })} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>4. Segmento *</Label>
            <div className="text-[11px] text-text-secondary">Varejo alimentar</div>
            <div className="flex flex-wrap gap-1.5">{SEG_ALIMENTAR.map((s) => <Chip key={s} ativo={lead.segmento === s} onClick={() => { set({ segmento: s }); if (SEG_COM_REDE.includes(s)) setRedeAberta(true); }}>{s}</Chip>)}</div>
            <div className="text-[11px] text-text-secondary">Varejo especializado</div>
            <div className="flex flex-wrap gap-1.5">{[...SEG_ESPECIALIZADO, "Outro" as const].map((s) => <Chip key={s} ativo={lead.segmento === s} onClick={() => { set({ segmento: s }); if (SEG_COM_REDE.includes(s)) setRedeAberta(true); }}>{s}</Chip>)}</div>
            <div className="text-[11px] text-text-secondary pt-1">Categorias de atuação</div>
            <div className="flex flex-wrap gap-1.5">{CATEGORIAS.map((c) => {
              const on = lead.categorias.includes(c);
              return <Chip key={c} ativo={on} onClick={() => set({ categorias: on ? lead.categorias.filter((x) => x !== c) : [...lead.categorias, c] })}>{c}</Chip>;
            })}</div>
          </div>
          <div className="space-y-1.5">
            <Label>5. Quanto espera faturar com a Fetély por mês (R$) *</Label>
            <Input inputMode="decimal" value={lead.faturamento_esperado_mes ?? ""} onChange={(e) => set({ faturamento_esperado_mes: num(e.target.value) })} />
            <div className="flex flex-wrap gap-1.5">{ATALHOS_FAT.map((a) => <Chip key={a.r} ativo={lead.faturamento_esperado_mes === a.v} onClick={() => set({ faturamento_esperado_mes: a.v })}>{a.r}</Chip>)}</div>
          </div>
          <div className="space-y-1.5"><Label>6. Em que pé ficou *</Label>
            <div className="flex flex-wrap gap-1.5">{EM_QUE_PE.map((e) => <Chip key={e} ativo={lead.em_que_pe_ficou === e} onClick={() => set({ em_que_pe_ficou: e })}>{e}</Chip>)}</div>
          </div>
          <div className="space-y-1.5">
            <Marca checked={redeAberta} onChange={(v) => { setRedeAberta(v); if (!v) set({ rede_grupo: null }); }}>Faz parte de rede?</Marca>
            {redeAberta && <Input placeholder="Grupo / central de compras (ex.: Plurix)" value={lead.rede_grupo ?? ""} onChange={(e) => set({ rede_grupo: e.target.value || null })} />}
          </div>
          <div className="rounded-md bg-muted/50 p-2 text-xs"><span className="font-semibold text-text-primary">Classe {classe}</span> · {ESFORCO[classe]}</div>
        </div>
      );
    }
    case "3":
      return (
        <div className="space-y-1">
          <Marca checked={!!lead.catalogo_enviado_em} onChange={(v) => set({ catalogo_enviado_em: v ? hoje : null })}>
            Catálogo enviado{lead.catalogo_enviado_em ? ` em ${fmtData(lead.catalogo_enviado_em)}` : ""}
          </Marca>
          <Marca checked={lead.toque_d2_feito} onChange={(v) => set({ toque_d2_feito: v })}>Toque D+2</Marca>
          <Marca checked={lead.toque_d5_feito} onChange={(v) => set({ toque_d5_feito: v })}>Toque D+5</Marca>
        </div>
      );
    case "4":
      return (
        <div className="space-y-2">
          <div><Label>Valor estimado (R$) *</Label><Input inputMode="decimal" value={lead.valor_estimado ?? ""} onChange={(e) => set({ valor_estimado: num(e.target.value) })} /></div>
          <Marca checked={lead.amostra} onChange={(v) => set({ amostra: v })}>Amostra</Marca>
          <Marca checked={lead.cadastro_fornecedor} onChange={(v) => set({ cadastro_fornecedor: v })}>Cadastro de fornecedor</Marca>
          <Marca checked={lead.comite} onChange={(v) => set({ comite: v })}>Comitê</Marca>
          {lead.tier_a && <Marca checked={lead.comissao_registrada} onChange={(v) => set({ comissao_registrada: v })}>Regra de comissão registrada *</Marca>}
          {onVincular && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-secondary">Cliente: {lead.cliente_id ? "vinculado" : "não vinculado"}</span>
              {(!lead.cliente_id || ctx.gestao) && <Button size="sm" variant="outline" onClick={onVincular}>{lead.cliente_id ? "Trocar cliente" : "Vincular cliente"}</Button>}
            </div>
          )}
        </div>
      );
    case "5":
      return (
        <div className="space-y-2">
          <div className="text-sm text-text-secondary">Nº do pedido: <span className="text-text-primary">{numeroPedido ?? "—"}</span></div>
          <div className="flex flex-wrap gap-1.5">{FORMAS.map((f) => <Chip key={f} ativo={lead.forma_pagamento === f} onClick={() => set({ forma_pagamento: f })}>{f}</Chip>)}</div>
          <Marca checked={!!lead.pago_em} onChange={(v) => set({ pago_em: v ? hoje : null })}>Pago{lead.pago_em ? ` em ${fmtData(lead.pago_em)}` : ""}</Marca>
        </div>
      );
    case "6":
      return (
        <div className="space-y-2">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer rounded-md border border-border px-3 py-2">
            <Upload className="h-4 w-4" /> {enviando ? "Enviando…" : lead.foto_gondola ? "Trocar foto da gôndola" : "Foto da gôndola"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void enviarFoto(e.target.files[0])} />
          </label>
          <Marca checked={!!lead.sell_out_em} onChange={(v) => set({ sell_out_em: v ? hoje : null })}>Relato de venda (sell-out){lead.sell_out_em ? ` em ${fmtData(lead.sell_out_em)}` : ""}</Marca>
        </div>
      );
    default:
      return null;
  }
}

export function NaoVaiAgora({ lead, set }: { lead: CrmLead; set: (p: Patch) => void }) {
  return (
    <div className="space-y-2">
      <Label>Motivo *</Label>
      <div className="flex flex-wrap gap-1.5">{MOTIVOS.map((m) => <Chip key={m} ativo={lead.motivo_nao_agora === m} onClick={() => set({ motivo_nao_agora: m })}>{m}</Chip>)}</div>
      <div><Label>Data para retomar *</Label><Input type="date" className="w-44" value={lead.retomar_em ?? ""} onChange={(e) => set({ retomar_em: e.target.value || null })} /></div>
    </div>
  );
}

/* ---------- gravação comum (card, rodada, tarefas) ---------- */
export interface Atualizacao {
  patch?: Patch;
  novaFase?: Fase | null;
  /** O que fazer com a tarefa aberta atual. */
  tarefaAtual?: "Feita" | "Cancelada" | { remarcar: string };
  proxima?: Sugestao | null;
  atividade?: { tipo: CrmAtividadeTipo; resultado: string; round_id?: string | null };
}

export async function aplicarAtualizacao(ctx: Ctx, lead: CrmLead, a: Atualizacao) {
  const hoje = hojeISO();
  const destino = a.novaFase ? stageDaFase(ctx, a.novaFase) : null;
  if (a.novaFase && !destino) throw new Error("Fase não encontrada");
  const faseFinal = a.novaFase ?? faseDe(ctx, lead);
  const precisaTarefa = faseFinal !== "X";
  const atual = tarefaAberta(ctx, lead.id);
  if (precisaTarefa && !a.proxima && !(a.tarefaAtual && typeof a.tarefaAtual === "object") && !atual)
    throw new Error("Defina a próxima atividade com data.");
  if (a.proxima && !a.proxima.vence_em) throw new Error("A próxima atividade precisa de data.");

  const upd: Patch = { ...(a.patch ?? {}), ultimo_toque_em: hoje };
  if (destino) upd.stage_id = destino.id;
  const { error } = await supabase.from("crm_leads").update(upd as never).eq("id", lead.id);
  if (error) throw error;

  if (atual) {
    if (a.tarefaAtual && typeof a.tarefaAtual === "object") {
      const r = await supabase.from("crm_tasks").update({ vence_em: a.tarefaAtual.remarcar }).eq("id", atual.id);
      if (r.error) throw r.error;
    } else if (a.proxima || faseFinal === "X") {
      const st = faseFinal === "X" && !a.tarefaAtual ? "Cancelada" : (a.tarefaAtual ?? "Feita");
      const r = await supabase.from("crm_tasks").update({ status: st, feita_em: st === "Feita" ? new Date().toISOString() : null }).eq("id", atual.id);
      if (r.error) throw r.error;
    }
  }
  if (a.proxima && faseFinal !== "X") {
    const r = await supabase.from("crm_tasks").insert({
      lead_id: lead.id, tipo: a.proxima.tipo, vence_em: a.proxima.vence_em, responsavel: a.proxima.responsavel,
      descricao: a.proxima.descricao?.trim() || null, created_by: ctx.userId,
    });
    if (r.error) throw r.error;
  }
  if (a.atividade) {
    const r = await supabase.from("crm_activities").insert({
      lead_id: lead.id, representante_id: lead.representante_id, tipo: a.atividade.tipo, data: hoje,
      resultado: a.atividade.resultado, round_id: a.atividade.round_id ?? null, created_by: ctx.userId,
    });
    if (r.error) throw r.error;
  }
}

export function resumoFicha(l: CrmLead): string {
  return [
    `Ficha: ${l.numero_lojas ?? "?"} loja(s)`, l.segmento, l.categorias.length ? l.categorias.join(", ") : null,
    l.faturamento_esperado_mes != null ? `espera ${brl(l.faturamento_esperado_mes)}/mês` : null,
    l.em_que_pe_ficou, l.rede_grupo ? `rede ${l.rede_grupo}` : null,
    `classe ${calcClasse(l.numero_lojas, l.faturamento_esperado_mes, l.cnpj)}`,
  ].filter(Boolean).join(" · ");
}
