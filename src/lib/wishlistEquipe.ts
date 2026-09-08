// Leitura interna (equipe) dos carrinhos que o cliente está montando no catálogo público.
// Fonte: public.wishlist_carrinho (chave = "w:<whatsapp digits>" ou "d:<device_id>").

import { supabase } from "@/integrations/supabase/client";

export interface WishlistCarrinhoRow {
  chave: string;
  itens: Record<string, number>;
  nome: string | null;
  whatsapp: string | null;
  device_id: string | null;
  atualizado_em: string;
}

/** Chaves possíveis para uma pessoa: pelo WhatsApp e por cada dispositivo conhecido. */
export function chavesWishlist(whatsapp?: string | null, deviceIds: (string | null)[] = []): string[] {
  const out = new Set<string>();
  const digits = (whatsapp ?? "").replace(/\D/g, "");
  if (digits.length >= 8) out.add(`w:${digits}`);
  for (const d of deviceIds) {
    const clean = (d ?? "").trim();
    if (clean) out.add(`d:${clean}`);
  }
  return [...out];
}

function parseItens(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [sku, qty] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(qty);
    if (Number.isFinite(n) && n >= 0) out[sku] = n;
  }
  return out;
}

/** Busca os carrinhos salvos para as chaves informadas. */
export async function fetchWishlistCarrinhos(chaves: string[]): Promise<WishlistCarrinhoRow[]> {
  if (chaves.length === 0) return [];
  const { data, error } = await supabase
    .from("wishlist_carrinho")
    .select("chave, itens, nome, whatsapp, device_id, atualizado_em")
    .in("chave", chaves)
    .order("atualizado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    chave: String(r.chave),
    itens: parseItens(r.itens),
    nome: r.nome ?? null,
    whatsapp: r.whatsapp ?? null,
    device_id: r.device_id ?? null,
    atualizado_em: String(r.atualizado_em),
  }));
}

/** Une os carrinhos de várias chaves (maior quantidade por SKU vence). */
export function mesclarItens(rows: WishlistCarrinhoRow[]): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const r of rows) {
    for (const [sku, q] of Object.entries(r.itens)) {
      merged[sku] = Math.max(merged[sku] ?? 0, q);
    }
  }
  return merged;
}
