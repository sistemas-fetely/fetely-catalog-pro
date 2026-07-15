// Rastreamento leve da jornada do catálogo público.
// - session_id persistido em cookie + localStorage
// - link_instance resolvido via RPC ensure_link_instance_for_login
// - 4 marcos + autosave gravados como eventos discretos
//
// Todas as operações são "best-effort": falhas nunca quebram a UX.

import { supabase } from "@/integrations/supabase/client";

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
    localStorage.setItem(LS_SESSION, id);
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
    localStorage.setItem(LS_DEVICE, id);
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
  localStorage.setItem(LS_GATE, JSON.stringify(g));
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
