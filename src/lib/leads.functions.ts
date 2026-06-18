import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calcularScoreLead } from "./leadScore";
import type {
  LeadFrequencia,
  LeadOrigem,
  LeadQualificado,
  LeadSegmento,
  LeadStatusCrm,
  LeadVolumeEstimado,
  LeadHistoricoItem,
} from "@/types/lead";

const segmentoSchema = z.enum([
  "lojista",
  "decoradora",
  "cerimonialista",
  "atacadista",
  "buffet",
  "influencer",
  "consumidor",
  "outro",
]);
const origemSchema = z.enum([
  "instagram",
  "whatsapp",
  "feira",
  "indicacao",
  "site",
  "google",
  "outro",
]);
const frequenciaSchema = z
  .enum(["pontual", "mensal", "trimestral", "semestral", "anual"])
  .nullable();
const volumeSchema = z
  .enum(["ate_500", "500_1500", "1500_3000", "ate_2500", "2500_10k", "10k_50k", "acima_50k", "nao_sei"])
  .nullable();
const statusSchema = z.enum([
  "novo",
  "em_contato",
  "qualificado",
  "proposta_enviada",
  "agendamento_enviado",
  "agendado",
  "reuniao_realizada",
  "pedido_fechado",
  "convertido",
  "sac",
  "descartado",
]);

const novoLeadSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().min(8).max(30),
  instagram: z.string().trim().max(80).optional().nullable(),
  email: z.string().trim().email().max(180).optional().nullable().or(z.literal("")),
  cidade: z.string().trim().max(80).optional().nullable(),
  uf: z.string().trim().max(2).optional().nullable(),
  segmento: segmentoSchema,
  frequencia: frequenciaSchema,
  volumeEstimado: volumeSchema,
  urgencia: z.number().int().min(1).max(5).nullable(),
  produtosInteresse: z.array(z.string().max(80)).max(30),
  origem: origemSchema,
  observacoes: z.string().max(2000).optional().nullable(),
});

type DbRow = {
  id: string;
  criado_em: string;
  atualizado_em: string;
  nome: string;
  whatsapp: string;
  instagram: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  segmento: LeadSegmento;
  frequencia: LeadFrequencia | null;
  volume_estimado: LeadVolumeEstimado | null;
  urgencia: number | null;
  produtos_interesse: string[];
  origem: LeadOrigem;
  observacoes: string | null;
  score: number;
  potencial: "alto" | "medio" | "em_desenvolvimento";
  status_crm: LeadStatusCrm;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  tags: string[];
  notas_internas: string | null;
  cliente_b2b_id: string | null;
  cotacao_origem_id: string | null;
  catalogo_liberado: boolean;
};

function rowToLead(r: DbRow): LeadQualificado {
  return {
    id: r.id,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    nome: r.nome,
    whatsapp: r.whatsapp,
    instagram: r.instagram,
    email: r.email,
    cidade: r.cidade,
    uf: r.uf,
    segmento: r.segmento,
    frequencia: r.frequencia,
    volumeEstimado: r.volume_estimado,
    urgencia: r.urgencia,
    produtosInteresse: r.produtos_interesse ?? [],
    origem: r.origem,
    observacoes: r.observacoes,
    score: r.score,
    potencial: r.potencial,
    statusCrm: r.status_crm,
    responsavelId: r.responsavel_id,
    responsavelNome: r.responsavel_nome,
    tags: r.tags ?? [],
    notasInternas: r.notas_internas,
    clienteB2bId: r.cliente_b2b_id,
    cotacaoOrigemId: r.cotacao_origem_id,
    catalogoLiberado: r.catalogo_liberado ?? false,
  };
}

// ============= PÚBLICO: criar lead =============
export const criarLeadPublico = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => novoLeadSchema.parse(d))
  .handler(async ({ data }) => {
    const { score, potencial } = calcularScoreLead({
      segmento: data.segmento,
      frequencia: data.frequencia,
      volumeEstimado: data.volumeEstimado,
      urgencia: data.urgencia,
    });

    const { data: row, error } = await supabaseAdmin
      .from("leads_qualificados")
      .insert({
        nome: data.nome,
        whatsapp: data.whatsapp,
        instagram: data.instagram || null,
        email: data.email || null,
        cidade: data.cidade || null,
        uf: data.uf?.toUpperCase() || null,
        segmento: data.segmento,
        frequencia: data.frequencia,
        volume_estimado: data.volumeEstimado,
        urgencia: data.urgencia,
        produtos_interesse: data.produtosInteresse,
        origem: data.origem,
        observacoes: data.observacoes || null,
        score,
        potencial,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await supabaseAdmin.from("lead_historico").insert({
      lead_id: row.id,
      usuario_nome: "Formulário público",
      descricao: "Lead criado via formulário de qualificação",
    });

    return { id: row.id as string };
  });

// ============= ADMIN: listar =============
export const listarLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("leads_qualificados")
      .select("*")
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as DbRow[]).map(rowToLead);
  });

// ============= ADMIN: atualizar CRM =============
const updateCrmSchema = z.object({
  id: z.string().uuid(),
  statusCrm: statusSchema.optional(),
  responsavelId: z.string().uuid().nullable().optional(),
  responsavelNome: z.string().max(120).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  notasInternas: z.string().max(4000).nullable().optional(),
});

export const atualizarLeadCrm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateCrmSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      status_crm?: LeadStatusCrm;
      responsavel_id?: string | null;
      responsavel_nome?: string | null;
      tags?: string[];
      notas_internas?: string | null;
    } = {};
    if (data.statusCrm !== undefined) patch.status_crm = data.statusCrm;
    if (data.responsavelId !== undefined) patch.responsavel_id = data.responsavelId;
    if (data.responsavelNome !== undefined) patch.responsavel_nome = data.responsavelNome;
    if (data.tags !== undefined) patch.tags = data.tags;
    if (data.notasInternas !== undefined) patch.notas_internas = data.notasInternas;

    const { error } = await supabase
      .from("leads_qualificados")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // histórico genérico
    const descricoes: string[] = [];
    if (data.statusCrm) descricoes.push(`Status alterado para: ${data.statusCrm}`);
    if (data.responsavelNome !== undefined)
      descricoes.push(
        data.responsavelNome
          ? `Responsável atribuído: ${data.responsavelNome}`
          : "Responsável removido",
      );
    if (data.tags !== undefined) descricoes.push(`Tags atualizadas`);
    if (data.notasInternas !== undefined) descricoes.push(`Notas internas atualizadas`);

    if (descricoes.length > 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome_completo, email")
        .eq("id", userId)
        .maybeSingle();
      const nome = (profile?.nome_completo as string) || (profile?.email as string) || "Admin";
      await supabase.from("lead_historico").insert(
        descricoes.map((d) => ({
          lead_id: data.id,
          usuario_id: userId,
          usuario_nome: nome,
          descricao: d,
        })),
      );
    }
    return { ok: true };
  });

// ============= ADMIN: histórico =============
export const listarHistoricoLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("lead_historico")
      .select("id, criado_em, usuario_nome, descricao")
      .eq("lead_id", data.leadId)
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows as Array<{
      id: string;
      criado_em: string;
      usuario_nome: string;
      descricao: string;
    }>).map<LeadHistoricoItem>((r) => ({
      id: r.id,
      criadoEm: r.criado_em,
      usuarioNome: r.usuario_nome,
      descricao: r.descricao,
    }));
  });

// ============= ADMIN: criar lead manual =============
export const criarLeadManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => novoLeadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { score, potencial } = calcularScoreLead({
      segmento: data.segmento,
      frequencia: data.frequencia,
      volumeEstimado: data.volumeEstimado,
      urgencia: data.urgencia,
    });
    const { data: row, error } = await supabase
      .from("leads_qualificados")
      .insert({
        nome: data.nome,
        whatsapp: data.whatsapp,
        instagram: data.instagram || null,
        email: data.email || null,
        cidade: data.cidade || null,
        uf: data.uf?.toUpperCase() || null,
        segmento: data.segmento,
        frequencia: data.frequencia,
        volume_estimado: data.volumeEstimado,
        urgencia: data.urgencia,
        produtos_interesse: data.produtosInteresse,
        origem: data.origem,
        observacoes: data.observacoes || null,
        score,
        potencial,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { data: profile } = await supabase
      .from("profiles")
      .select("nome_completo, email")
      .eq("id", userId)
      .maybeSingle();
    const nome = (profile?.nome_completo as string) || (profile?.email as string) || "Admin";
    await supabase.from("lead_historico").insert({
      lead_id: row.id,
      usuario_id: userId,
      usuario_nome: nome,
      descricao: "Lead cadastrado manualmente no painel",
    });

    return { id: row.id as string };
  });

// ============= ADMIN: excluir =============
export const excluirLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("leads_qualificados")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= ADMIN: liberar catálogo =============
export const liberarCatalogoLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), liberar: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("leads_qualificados")
      .update({ catalogo_liberado: data.liberar })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { data: profile } = await supabase
      .from("profiles")
      .select("nome_completo, email")
      .eq("id", userId)
      .maybeSingle();
    const nome = (profile?.nome_completo as string) || (profile?.email as string) || "Admin";
    await supabase.from("lead_historico").insert({
      lead_id: data.id,
      usuario_id: userId,
      usuario_nome: nome,
      descricao: data.liberar ? "Acesso ao catálogo liberado" : "Acesso ao catálogo revogado",
    });

    return { ok: true };
  });
