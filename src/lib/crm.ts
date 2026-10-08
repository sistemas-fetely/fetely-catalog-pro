// CRM de representantes — tipos, régua (calculada na tela) e acesso a dados.
// O RLS da Parte 1 decide o que chega: aqui nada é filtrado só no front.
import { supabase } from "@/integrations/supabase/client";

export type CrmGrupo = "Produtivo" | "Ativação" | "Ultimato" | "Trilha separada";
export type CrmRegiao = "Sul" | "Sudeste" | "Centro-Oeste" | "Nordeste" | "Norte" | "A definir";
export type CrmAtividadeTipo = "Reunião" | "Visita" | "Ligação" | "E-mail ou WhatsApp";

export const GRUPOS: CrmGrupo[] = ["Produtivo", "Ativação", "Ultimato", "Trilha separada"];
export const REGIOES: CrmRegiao[] = ["Sul", "Sudeste", "Centro-Oeste", "Nordeste", "Norte", "A definir"];
export const TIPOS_ATIVIDADE: CrmAtividadeTipo[] = ["Reunião", "Visita", "Ligação", "E-mail ou WhatsApp"];

export const STAGE_AGENDA = "Agenda marcada";
export const STAGE_APRESENTADO = "Apresentado";
export const STAGE_PERDIDO = "Perdido";
export const STAGE_FECHADO = "Pedido fechado";

export interface CrmStage { id: string; nome: string; ordem: number; prazo_max_dias: number | null; encerrado: boolean; cor: string }
export interface CrmLead {
  id: string; representante_id: string; nome_conta: string; cnpj: string | null; cidade: string | null; uf: string | null;
  numero_lojas: number | null; tier_a: boolean; stage_id: string; stage_desde: string; ultima_acao: string | null;
  proxima_acao: string | null; proxima_acao_data: string | null; motivo_perda: string | null; created_by: string | null;
}
export interface CrmActivity {
  id: string; lead_id: string; representante_id: string; data: string; tipo: CrmAtividadeTipo;
  resultado: string | null; proximo_passo: string | null; created_by: string | null; created_at: string;
}
export interface CrmRep { id: string; nome: string; grupo: CrmGrupo; regiao: CrmRegiao; observacao: string | null }
export interface CrmHist { id: string; lead_id: string; stage_anterior_id: string | null; stage_novo_id: string | null; representante_anterior_id: string | null; representante_novo_id: string | null; alterado_em: string; alterado_por: string | null }

/** Data local de hoje em YYYY-MM-DD. */
export function hojeISO(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export function diasEntre(deISO: string, ateISO: string): number {
  const a = Date.UTC(+deISO.slice(0, 4), +deISO.slice(5, 7) - 1, +deISO.slice(8, 10));
  const b = Date.UTC(+ateISO.slice(0, 4), +ateISO.slice(5, 7) - 1, +ateISO.slice(8, 10));
  return Math.round((b - a) / 86400000);
}
export function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Motivos de "fora da régua". Vazio = dentro da régua (ou estágio encerrado). */
export function motivosRegua(lead: Pick<CrmLead, "proxima_acao_data" | "stage_desde">, stage: CrmStage | undefined, hoje = hojeISO()): string[] {
  if (!stage || stage.encerrado) return [];
  const m: string[] = [];
  const atrasada = !!lead.proxima_acao_data && lead.proxima_acao_data < hoje;
  if (stage.nome === STAGE_AGENDA) {
    if (atrasada) m.push("registrar resultado");
  } else if (atrasada) m.push("ação vencida");
  if (stage.prazo_max_dias != null) {
    const d = diasEntre(lead.stage_desde, hoje);
    if (d > stage.prazo_max_dias) m.push(`${d}d no estágio`);
  }
  return m;
}

export async function carregarCrm() {
  const [st, ld, at, reps, sets] = await Promise.all([
    supabase.from("crm_stages").select("*").order("ordem"),
    supabase.from("crm_leads").select("*").order("nome_conta"),
    supabase.from("crm_activities").select("*").order("data", { ascending: false }).order("created_at", { ascending: false }),
    supabase.rpc("crm_representantes_lista"),
    supabase.from("crm_rep_settings").select("*"),
  ]);
  const err = st.error || ld.error || at.error || reps.error || sets.error;
  if (err) throw err;
  const setMap = new Map((sets.data ?? []).map((s) => [s.representante_id, s]));
  const representantes: CrmRep[] = (reps.data ?? []).map((r) => {
    const s = setMap.get(r.id);
    return { id: r.id, nome: r.nome ?? "—", grupo: (s?.grupo ?? "Ativação") as CrmGrupo, regiao: (s?.regiao ?? "A definir") as CrmRegiao, observacao: s?.observacao ?? null };
  });
  return {
    stages: (st.data ?? []) as CrmStage[],
    leads: (ld.data ?? []) as CrmLead[],
    atividades: (at.data ?? []) as CrmActivity[],
    representantes,
  };
}

export async function conflitosGestao(): Promise<Set<string>> {
  const { data } = await supabase.from("crm_lead_conflitos").select("lead_id").eq("resolvido", false);
  return new Set((data ?? []).map((c) => c.lead_id));
}
