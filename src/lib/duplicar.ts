import type { CartItem, SavedOrder } from "@/types";
import type { Product } from "@/types";
import type { ModeloPedido } from "@/types/modelo";
import { useCatalog } from "@/store/catalogStore";

export interface RecalculoResultado {
  itens: CartItem[];
  itensRemovidos: { sku: string; nome: string; motivo: string }[];
  itensComPrecoAlterado: { sku: string; nome: string; precoAntigo: number; precoNovo: number }[];
}

/** Recalcula itens com preço/estoque atual do catálogo. Remove inativos. */
export function recalcularItens(base: CartItem[]): RecalculoResultado {
  const produtos = useCatalog.getState().products;
  const map = new Map<string, Product>();
  produtos.forEach((p) => map.set(p.sku, p));

  const itens: CartItem[] = [];
  const removidos: RecalculoResultado["itensRemovidos"] = [];
  const alterados: RecalculoResultado["itensComPrecoAlterado"] = [];

  for (const it of base) {
    const atual = map.get(it.sku);
    if (!atual) {
      removidos.push({ sku: it.sku, nome: it.product.nomeComercial, motivo: "Não consta no catálogo" });
      continue;
    }
    if (atual.ativo === false) {
      removidos.push({ sku: it.sku, nome: atual.nomeComercial, motivo: "Produto inativo" });
      continue;
    }
    const precoAntigo = it.product.precoAtacado;
    const precoNovo = atual.precoAtacado;
    if (Math.abs(precoAntigo - precoNovo) > 0.0001) {
      alterados.push({ sku: it.sku, nome: atual.nomeComercial, precoAntigo, precoNovo });
    }
    itens.push({ sku: atual.sku, product: atual, quantity: it.quantity });
  }
  return { itens, itensRemovidos: removidos, itensComPrecoAlterado: alterados };
}

export function itensDePedido(p: SavedOrder): CartItem[] {
  return p.items.map((i) => ({ sku: i.sku, product: i.product, quantity: i.quantity }));
}

export function itensDeModelo(m: ModeloPedido): CartItem[] {
  // Resolve catalog para preencher product completo.
  const produtos = useCatalog.getState().products;
  const map = new Map<string, Product>();
  produtos.forEach((p) => map.set(p.sku, p));
  const out: CartItem[] = [];
  for (const it of m.itens) {
    const p = map.get(it.sku);
    if (!p) continue;
    out.push({ sku: p.sku, product: p, quantity: it.quantidade });
  }
  return out;
}
