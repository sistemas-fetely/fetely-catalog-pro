// Rastreamento leve da jornada do catálogo público.
// - session_id persistido em cookie + localStorage
// - link_instance resolvido via RPC ensure_link_instance_for_login
// - 4 marcos + autosave gravados como eventos discretos
//
// Todas as operações são "best-effort": falhas nunca quebram a UX.

import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/safeStorage";

const COOKIE_NAME = "fetely_session_id";
const LS_SESSION = "fetely_session_id";
const DEVICE_COOKIE = "fetely_device_id";
const LS_DEVICE = "fetely_device_id";
const LS_GATE = "fetely_gate_identidade"; // { nome, whatsapp } — reidentificação
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano


export type EventoTipo =
  | "portal_acessado"
  | "montagem_iniciada"
  | "formulario_aberto"
  | "pre_selecao_enviada"
  | "formulario_autosave";

export interface GateIdentidade {
  nome: string;
  whatsapp: string;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(name + "="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback simples
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return uuid();
  let id = readCookie(COOKIE_NAME);
  if (!id) id = localStorage.getItem(LS_SESSION);
  if (!id) {
    id = uuid();
    safeLocalStorage.setItem(LS_SESSION, id);
  }
  writeCookie(COOKIE_NAME, id);
  return id;
}

/** ID persistente do dispositivo — sobrevive a novas sessões (troca de aba, novo link, etc.). */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return uuid();
  let id = readCookie(DEVICE_COOKIE);
  if (!id) id = localStorage.getItem(LS_DEVICE);
  if (!id) {
    id = uuid();
    safeLocalStorage.setItem(LS_DEVICE, id);
  }
  writeCookie(DEVICE_COOKIE, id);
  return id;
}


export function loadGateIdentidade(): GateIdentidade | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_GATE);
    return raw ? (JSON.parse(raw) as GateIdentidade) : null;
  } catch {
    return null;
  }
}

export function saveGateIdentidade(g: GateIdentidade): void {
  if (typeof window === "undefined") return;
  safeLocalStorage.setItem(LS_GATE, JSON.stringify(g));
}

// --- Carrinho (wishlist) persistido por identidade -----------------------
const LS_WISHLIST = "fetely_wishlist"; // { [chave]: { [sku]: qty } }

/** Chave da wishlist: whatsapp (dígitos) quando identificado, senão o device. */
export function wishlistKey(g?: GateIdentidade | null): string {
  const digits = (g?.whatsapp ?? "").replace(/\D/g, "");
  if (digits.length >= 8) return `w:${digits}`;
  return `d:${getOrCreateDeviceId()}`;
}

type WishlistStore = Record<string, Record<string, number>>;

function readWishlistStore(): WishlistStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_WISHLIST);
    return raw ? (JSON.parse(raw) as WishlistStore) : {};
  } catch {
    return {};
  }
}

export function loadWishlist(key: string): Record<string, number> {
  return readWishlistStore()[key] ?? {};
}

export function saveWishlist(key: string, cart: Record<string, number>): void {
  if (typeof window === "undefined") return;
  const store = readWishlistStore();
  if (Object.keys(cart).length === 0) delete store[key];
  else store[key] = cart;
  safeLocalStorage.setItem(LS_WISHLIST, JSON.stringify(store));
}

/** Move o carrinho anônimo (device) para a chave da identidade recém-informada. */
export function migrateWishlist(fromKey: string, toKey: string): Record<string, number> {
  if (fromKey === toKey) return loadWishlist(toKey);
  const store = readWishlistStore();
  const from = store[fromKey] ?? {};
  const to = store[toKey] ?? {};
  const merged = { ...from, ...to };
  delete store[fromKey];
  if (Object.keys(merged).length > 0) store[toKey] = merged;
  safeLocalStorage.setItem(LS_WISHLIST, JSON.stringify(store));
  return merged;
}

// --- Carrinho no servidor (retomada em qualquer dispositivo) --------------

/** Salva o carrinho no banco para a chave informada. */
export async function saveWishlistRemote(
  key: string,
  cart: Record<string, number>,
  g?: GateIdentidade | null,
): Promise<void> {
  if (!key) return;
  try {
    const { error } = await supabase.rpc("public_save_wishlist" as never, {
      p_chave: key,
      p_itens: cart,
      p_nome: g?.nome ?? null,
      p_whatsapp: g?.whatsapp ?? null,
      p_device_id: getOrCreateDeviceId(),
    } as never);
    if (error) throw error;
  } catch (e) {
    console.warn("[tracking] saveWishlistRemote falhou", e);
  }
}

/** Recupera o carrinho salvo no banco para a chave informada. */
export async function loadWishlistRemote(key: string): Promise<Record<string, number>> {
  if (!key) return {};
  try {
    const { data, error } = await supabase.rpc("public_get_wishlist" as never, {
      p_chave: key,
    } as never);
    if (error) throw error;
    const obj = (data ?? {}) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [sku, qty] of Object.entries(obj)) {
      const n = Number(qty);
      if (Number.isFinite(n) && n > 0) out[sku] = n;
    }
    return out;
  } catch (e) {
    console.warn("[tracking] loadWishlistRemote falhou", e);
    return {};
  }
}




interface EnsureLinkResult {
  id: string | null;
  origem_tipo: string | null;
  origem_id: string | null;
}

const linkCache = new Map<string, EnsureLinkResult>();

export async function ensureLinkInstance(login: string | undefined): Promise<EnsureLinkResult> {
  const clean = (login || "").trim().toLowerCase();
  if (!clean) return { id: null, origem_tipo: "generico", origem_id: null };
  if (linkCache.has(clean)) return linkCache.get(clean)!;
  try {
    const { data, error } = await supabase.rpc("ensure_link_instance_for_login", {
      p_login: clean,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const result: EnsureLinkResult = row
      ? { id: row.id, origem_tipo: row.origem_tipo, origem_id: row.origem_id }
      : { id: null, origem_tipo: "generico", origem_id: null };
    linkCache.set(clean, result);
    return result;
  } catch (e) {
    console.warn("[tracking] ensure_link_instance falhou", e);
    return { id: null, origem_tipo: "generico", origem_id: null };
  }
}

export interface SessaoPatch {
  link_instance_id?: string | null;
  nome?: string | null;
  whatsapp?: string | null;
  identificado_gate?: boolean;
  cnpj?: string | null;
  razao_social?: string | null;
  segmento?: string | null;
  valor_wishlist?: number;
  qtd_itens?: number;
  estado_atual?: string;
  ultimo_form_open?: string | null;
  campos_preenchidos?: Record<string, unknown> | null;
  user_agent?: string | null;
  device_id?: string | null;
}

/** Cria ou atualiza a sessão (upsert por id). Injeta device_id automaticamente. */
export async function upsertSessao(sessionId: string, patch: SessaoPatch): Promise<void> {
  try {
    const row = {
      ultimo_evento: new Date().toISOString(),
      device_id: patch.device_id ?? getOrCreateDeviceId(),
      ...patch,
    };
    const { error } = await supabase.rpc("public_upsert_sessao_catalogo" as never, {
      p_id: sessionId,
      p_patch: row,
    } as never);
    if (error) throw error;
  } catch (e) {
    console.warn("[tracking] upsertSessao falhou", e);
  }
}


export interface EventoSnapshot {
  valor_parcial?: number;
  itens_parcial?: number;
  campos_preenchidos?: Record<string, unknown> | null;
}

export async function emitEvento(
  sessionId: string,
  tipo: EventoTipo,
  snap: EventoSnapshot = {},
): Promise<void> {
  try {
    const { error } = await supabase.rpc("public_emit_evento_catalogo" as never, {
      p_sessao_id: sessionId,
      p_tipo: tipo,
      p_valor_parcial: snap.valor_parcial ?? null,
      p_itens_parcial: snap.itens_parcial ?? null,
      p_campos_preenchidos: snap.campos_preenchidos ?? null,
    } as never);
    if (error) throw error;
  } catch (e) {
    console.warn("[tracking] emitEvento falhou", e);
  }
}
