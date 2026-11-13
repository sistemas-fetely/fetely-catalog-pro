import type { BalcaoProduto, Item } from "../components/balcao/types";

export type ItemInicialB2c = { sku: string; quantidade: number };
export const ITENS_CARRINHO_B2C_KEY = "fop:b2c:itens_do_carrinho";

declare module "@tanstack/react-router" {
  interface HistoryState {
    itensDoCarrinho?: ItemInicialB2c[];
  }
}

// Read-only projection: no B2B prices, stock routing or commercial conditions.
export function itensIniciaisDoCarrinho(
  items: readonly { sku: string; quantity: number }[],
): ItemInicialB2c[] {
  return items
    .filter((i) => Number.isFinite(i.quantity) && i.quantity > 0)
    .map((i) => ({ sku: i.sku, quantidade: i.quantity }));
}

export function validarItensIniciais(valor: unknown): ItemInicialB2c[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((i) =>
    i &&
    typeof i.sku === "string" &&
    i.sku.length > 0 &&
    typeof i.quantidade === "number" &&
    Number.isFinite(i.quantidade) &&
    i.quantidade > 0
      ? [{ sku: i.sku, quantidade: i.quantidade }]
      : [],
  );
}

export async function resolverItensDoCarrinho(
  iniciais: readonly ItemInicialB2c[],
  buscar: (sku: string) => Promise<(BalcaoProduto & { ativo?: boolean })[]>,
): Promise<{ itens: Item[]; indisponiveis: string[]; erros: string[] }> {
  const resolvidos = await Promise.all(
    iniciais.map(async (i) => {
      try {
        const p = (await buscar(i.sku)).find((p) => p.sku === i.sku);
        if (!p || p.ativo === false || !Number.isFinite(p.preco_varejo) || p.preco_varejo <= 0) {
          return { sku: i.sku, item: null, erro: "" };
        }
        // Insufficient stock is displayed, never filtered; SNCF decides at creation.
        return { sku: i.sku, item: { ...p, quantidade: i.quantidade }, erro: "" };
      } catch (e) {
        return {
          sku: i.sku,
          item: null,
          erro: `${i.sku}: ${e instanceof Error ? e.message : "Erro ao buscar produto"}`,
        };
      }
    }),
  );
  return {
    itens: resolvidos.flatMap((r) => (r.item ? [r.item] : [])),
    indisponiveis: resolvidos.filter((r) => !r.item).map((r) => r.sku),
    erros: resolvidos.flatMap((r) => (r.erro ? [r.erro] : [])),
  };
}
