import type { PreSelecao, ItemPreSelecao, SegmentoCliente, StatusPreSelecao } from "@/types/preSelecao";
import { EXPIRACAO_PADRAO_HORAS } from "@/types/preSelecao";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "fetely_pre_selecoes";
const COUNTER_KEY = "fetely_pre_selecao_counter";

/**
 * URL pública oficial do catálogo — usada em todos os links compartilhados
 * (pré-seleção, QR code, WhatsApp). Não usar `window.location.origin`
 * porque isso gera links do preview (`id-preview--...lovable.app`) que
 * não funcionam publicamente.
 */
export const PUBLIC_SITE_URL = "https://fetely-catalog-pro.lovable.app";

export function loadPreSelecoes(): PreSelecao[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as PreSelecao[];
  } catch {
    return [];
  }
}

export function savePreSelecoes(list: PreSelecao[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function nextPreSelecaoId(): string {
  if (typeof window === "undefined") return "PS0001";
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || "0", 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return `PS${String(n).padStart(4, "0")}`;
}

export function buildPreSelecao(input: Omit<PreSelecao, "id" | "criadoEm" | "expiraEm" | "status" | "totalItens" | "totalUnidades" | "totalVarejoRef">): PreSelecao {
  const now = new Date();
  const expira = new Date(now.getTime() + EXPIRACAO_PADRAO_HORAS * 3600 * 1000);
  const totalItens = input.itens.length;
  const totalUnidades = input.itens.reduce((s, i) => s + i.quantidade, 0);
  const totalVarejoRef = input.itens.reduce((s, i) => s + i.subtotalVarejo, 0);
  return {
    ...input,
    id: nextPreSelecaoId(),
    criadoEm: now.toISOString(),
    expiraEm: expira.toISOString(),
    status: "nova",
    totalItens,
    totalUnidades,
    totalVarejoRef,
  };
}

// ---- base64 sync (URL-safe) ----
export function encodePreSelecao(pre: PreSelecao): string {
  const json = JSON.stringify(pre);
  const b64 = typeof window !== "undefined"
    ? window.btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, "utf-8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePreSelecao(str: string): PreSelecao | null {
  try {
    const norm = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = norm + "===".slice((norm.length + 3) % 4);
    const json = typeof window !== "undefined"
      ? decodeURIComponent(escape(window.atob(pad)))
      : Buffer.from(pad, "base64").toString("utf-8");
    return JSON.parse(json) as PreSelecao;
  } catch {
    return null;
  }
}

export function itemFromProductQty(
  p: {
    sku: string;
    nomeComercial: string;
    colecao: string;
    grupo: string;
    corNome: string;
    tamanhoNumero: string;
    precoVarejo: number;
  },
  qty: number,
): ItemPreSelecao {
  const isInterest = qty <= 0;
  const quantidade = isInterest ? 0 : qty;
  return {
    sku: p.sku,
    nomeComercial: p.nomeComercial,
    colecao: p.colecao,
    grupo: p.grupo,
    corNome: p.corNome,
    tamanhoNumero: p.tamanhoNumero,
    quantidade,
    precoVarejoUnit: p.precoVarejo,
    subtotalVarejo: quantidade * p.precoVarejo,
    temInteresseSemQtd: isInterest,
  };
}

export function isExpired(pre: PreSelecao): boolean {
  return new Date(pre.expiraEm).getTime() < Date.now();
}

export function tempoRestante(pre: PreSelecao): string {
  const ms = new Date(pre.expiraEm).getTime() - Date.now();
  if (ms <= 0) return "Expirada";
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// ---- Supabase sync ----

type DbRow = {
  id: string;
  criado_em: string;
  expira_em: string;
  vendedor_login: string | null;
  vendedor_nome: string | null;
  atribuido_para_vendedor_id: string | null;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  contato_nome: string;
  contato_cargo: string | null;
  contato_email: string;
  contato_whatsapp: string;
  cidade_estado: string;
  segmento: string;
  observacao: string | null;
  aceita_newsletter: boolean;
  itens: unknown;
  total_itens: number;
  total_unidades: number;
  total_varejo_ref: number | string;
  status: string;
  cliente_b2b_id: string | null;
  cotacao_gerada_id: string | null;
  pedido_gerado_id: string | null;
  visualizado_em: string | null;
};

export function toDbRow(pre: PreSelecao) {
  return {
    id: pre.id,
    criado_em: pre.criadoEm,
    expira_em: pre.expiraEm,
    vendedor_login: pre.vendedorId,
    vendedor_nome: pre.vendedorNome,
    atribuido_para_vendedor_id: pre.atribuidoParaVendedorId ?? null,
    cnpj: pre.cnpj,
    razao_social: pre.razaoSocial,
    nome_fantasia: pre.nomeFantasia,
    contato_nome: pre.contatoNome,
    contato_cargo: pre.contatoCargo ?? null,
    contato_email: pre.contatoEmail,
    contato_whatsapp: pre.contatoWhatsapp,
    cidade_estado: pre.cidadeEstado,
    segmento: pre.segmento,
    observacao: pre.observacao ?? null,
    aceita_newsletter: pre.aceitaNewsletter,
    itens: pre.itens as unknown as import("@/integrations/supabase/types").Json,
    total_itens: pre.totalItens,
    total_unidades: pre.totalUnidades,
    total_varejo_ref: pre.totalVarejoRef,
    status: pre.status,
    cliente_b2b_id: pre.clienteB2bId ?? null,
    cotacao_gerada_id: pre.cotacaoGeradaId ?? null,
    pedido_gerado_id: pre.pedidoGeradoId ?? null,
    visualizado_em: pre.visualizadoEm ?? null,
  };
}

export function fromDbRow(r: DbRow): PreSelecao {
  return {
    id: r.id,
    criadoEm: r.criado_em,
    expiraEm: r.expira_em,
    vendedorId: r.vendedor_login,
    vendedorNome: r.vendedor_nome,
    atribuidoParaVendedorId: r.atribuido_para_vendedor_id ?? undefined,
    cnpj: r.cnpj,
    razaoSocial: r.razao_social,
    nomeFantasia: r.nome_fantasia,
    contatoNome: r.contato_nome,
    contatoCargo: r.contato_cargo ?? undefined,
    contatoEmail: r.contato_email,
    contatoWhatsapp: r.contato_whatsapp,
    cidadeEstado: r.cidade_estado,
    segmento: r.segmento as SegmentoCliente,
    observacao: r.observacao ?? undefined,
    aceitaNewsletter: r.aceita_newsletter,
    itens: (Array.isArray(r.itens) ? r.itens : []) as ItemPreSelecao[],
    totalItens: r.total_itens,
    totalUnidades: r.total_unidades,
    totalVarejoRef: Number(r.total_varejo_ref) || 0,
    status: r.status as StatusPreSelecao,
    clienteB2bId: r.cliente_b2b_id ?? undefined,
    cotacaoGeradaId: r.cotacao_gerada_id ?? undefined,
    pedidoGeradoId: r.pedido_gerado_id ?? undefined,
    visualizadoEm: r.visualizado_em ?? undefined,
  };
}

/** Insere a pré-seleção no backend. Usado pelo catálogo público (anon). */
export async function submitPreSelecaoRemote(pre: PreSelecao): Promise<void> {
  const { error } = await supabase.from("pre_selecoes").insert(toDbRow(pre));
  if (error) throw error;
}

/** Busca pré-seleções do backend (RLS filtra por vendedor/admin). */
export async function fetchPreSelecoesRemote(): Promise<PreSelecao[]> {
  const { data, error } = await supabase
    .from("pre_selecoes")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data as DbRow[]).map(fromDbRow);
}

/** Atualiza status + campos derivados no backend. */
export async function updatePreSelecaoRemote(
  id: string,
  patch: Partial<PreSelecao>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.visualizadoEm !== undefined) dbPatch.visualizado_em = patch.visualizadoEm;
  if (patch.cotacaoGeradaId !== undefined) dbPatch.cotacao_gerada_id = patch.cotacaoGeradaId;
  if (patch.pedidoGeradoId !== undefined) dbPatch.pedido_gerado_id = patch.pedidoGeradoId;
  if (patch.clienteB2bId !== undefined) dbPatch.cliente_b2b_id = patch.clienteB2bId;
  if (Object.keys(dbPatch).length === 0) return;
  const { error } = await supabase.from("pre_selecoes").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deletePreSelecaoRemote(id: string): Promise<void> {
  const { error } = await supabase.from("pre_selecoes").delete().eq("id", id);
  if (error) throw error;
}
