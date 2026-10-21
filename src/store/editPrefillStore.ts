// Guarda as escolhas comerciais (condição, descontos, frete, bonificação...)
// de um pedido/cotação que está sendo editado, para o painel comercial do
// carrinho já abrir preenchido. Consumido uma única vez pelo painel.
import { create } from "zustand";
import type { CartItem, OrderCommercial } from "@/types";
import { useOrder } from "@/store/orderStore";
import { vendaBloqueada } from "@/lib/classifyItem";
import { avisarEsgotados } from "@/lib/salesStock";
import { useCatalog } from "@/store/catalogStore";

interface EditPrefillState {
  commercial: OrderCommercial | null;
  setCommercial: (c: OrderCommercial | null) => void;
  consume: () => OrderCommercial | null;
}

export const useEditPrefill = create<EditPrefillState>((set, get) => ({
  commercial: null,
  setCommercial: (c) => set({ commercial: c }),
  consume: () => {
    const c = get().commercial;
    if (c) set({ commercial: null });
    return c;
  },
}));

/** Carrega itens no carrinho preservando a negociação por item. */
export function carregarItensNoCarrinho(items: CartItem[]) {
  const catalog = useCatalog.getState().products;
  const bySku = new Map(catalog.map((p) => [p.sku, p]));
  const validos = items.filter((i) => i && i.product && i.quantity > 0);
  const atuais = validos.map((i) => ({
      ...i,
      product: bySku.get(i.sku) ?? i.product,
    }));
  avisarEsgotados(atuais.filter((i) => vendaBloqueada(i.product)).map((i) => i.product));
  useOrder.setState({ items: atuais.filter((i) => !vendaBloqueada(i.product)) });
}

/** Extrai o número de parcelas de uma descrição como "Cartão 3x sem juros". */
export function parcelasDaDescricao(desc: string | undefined | null): number | null {
  const m = /cart[aã]o\s+(\d+)\s*x/i.exec(desc ?? "");
  return m ? Number(m[1]) : null;
}
