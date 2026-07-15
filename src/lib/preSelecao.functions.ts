import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const statusSchema = z.enum([
  "nova",
  "visualizada",
  "em_contato",
  "convertida",
  "expirada",
  "descartada",
]);

const segmentoSchema = z.enum([
  "boutique_decoracao",
  "papelaria_atelie",
  "festa_premium",
  "ecommerce",
  "varejo_premium",
  "buffet_eventos",
  "floricultura",
  "outro",
]);

const itemSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  nomeComercial: z.string().trim().min(1).max(180),
  colecao: z.string().trim().max(120),
  grupo: z.string().trim().max(120),
  corNome: z.string().trim().max(120),
  tamanhoNumero: z.string().trim().max(40),
  quantidade: z.number().int().min(0).max(9999),
  precoVarejoUnit: z.number().min(0).max(999999),
  subtotalVarejo: z.number().min(0).max(99999999),
  temInteresseSemQtd: z.boolean(),
});

const preSelecaoSchema = z.object({
  id: z.string().trim().min(3).max(32),
  criadoEm: z.string().datetime(),
  expiraEm: z.string().datetime(),
  vendedorId: z.string().trim().max(120).nullable(),
  vendedorNome: z.string().trim().max(180).nullable(),
  cnpj: z.string().trim().min(14).max(20),
  razaoSocial: z.string().trim().min(2).max(220),
  nomeFantasia: z.string().trim().min(2).max(220),
  contatoNome: z.string().trim().min(2).max(160),
  contatoCargo: z.string().trim().max(120).optional(),
  contatoEmail: z.string().trim().email().max(220),
  contatoWhatsapp: z.string().trim().min(8).max(40),
  cidadeEstado: z.string().trim().max(120),
  segmento: segmentoSchema,
  observacao: z.string().trim().max(2000).optional(),
  aceitaNewsletter: z.boolean(),
  itens: z.array(itemSchema).min(1).max(500),
  totalItens: z.number().int().min(1).max(500),
  totalUnidades: z.number().int().min(0).max(999999),
  totalVarejoRef: z.number().min(0).max(99999999),
  status: statusSchema,
  clienteB2bId: z.string().uuid().optional(),
  cotacaoGeradaId: z.string().max(80).optional(),
  pedidoGeradoId: z.string().max(80).optional(),
  atribuidoParaVendedorId: z.string().uuid().optional(),
  visualizadoEm: z.string().datetime().optional(),
  sessaoId: z.string().uuid().optional(),
});

export const enviarPreSelecaoPublica = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => preSelecaoSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("pre_selecoes").insert({
      id: data.id,
      criado_em: data.criadoEm,
      expira_em: data.expiraEm,
      vendedor_login: data.vendedorId,
      vendedor_nome: data.vendedorNome,
      atribuido_para_vendedor_id: data.atribuidoParaVendedorId ?? null,
      cnpj: data.cnpj,
      razao_social: data.razaoSocial,
      nome_fantasia: data.nomeFantasia,
      contato_nome: data.contatoNome,
      contato_cargo: data.contatoCargo ?? null,
      contato_email: data.contatoEmail,
      contato_whatsapp: data.contatoWhatsapp,
      cidade_estado: data.cidadeEstado,
      segmento: data.segmento,
      observacao: data.observacao ?? null,
      aceita_newsletter: data.aceitaNewsletter,
      itens: data.itens as unknown as import("@/integrations/supabase/types").Json,
      total_itens: data.totalItens,
      total_unidades: data.totalUnidades,
      total_varejo_ref: data.totalVarejoRef,
      status: data.status,
      cliente_b2b_id: data.clienteB2bId ?? null,
      cotacao_gerada_id: data.cotacaoGeradaId ?? null,
      pedido_gerado_id: data.pedidoGeradoId ?? null,
      visualizado_em: data.visualizadoEm ?? null,
    });

    if (error) throw new Error(error.message);
    return { id: data.id };
  });