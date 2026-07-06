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
