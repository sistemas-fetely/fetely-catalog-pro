import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, OrderMeta, Product, SavedOrder } from "@/types";

interface OrderState {
  items: CartItem[];
  meta: OrderMeta;
  history: SavedOrder[];
  addItem: (product: Product, quantity: number) => void;
  addBulk: (entries: { product: Product; quantity: number }[]) => void;
  updateQty: (sku: string, quantity: number) => void;
  removeItem: (sku: string) => void;
  clearCart: () => void;
  setMeta: (m: Partial<OrderMeta>) => void;
  saveOrder: () => SavedOrder;
}

const defaultMeta: OrderMeta = {
  cliente: "",
  cnpj: "",
  condicaoPagamento: "À vista",
  observacoes: "",
  vendedor: "Representante Fetély",
};

export const useOrder = create<OrderState>()(
  persist(
    (set, get) => ({
      items: [],
      meta: defaultMeta,
      history: [],
      addItem: (product, quantity) => {
        if (quantity <= 0) return;
        set((s) => {
          const existing = s.items.find((i) => i.sku === product.sku);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.sku === product.sku ? { ...i, quantity: i.quantity + quantity } : i,
              ),
            };
          }
          return { items: [...s.items, { sku: product.sku, product, quantity }] };
        });
      },
      addBulk: (entries) => {
        entries.forEach((e) => get().addItem(e.product, e.quantity));
      },
      updateQty: (sku, quantity) => {
        if (quantity <= 0) return get().removeItem(sku);
        set((s) => ({
          items: s.items.map((i) => (i.sku === sku ? { ...i, quantity } : i)),
        }));
      },
      removeItem: (sku) => set((s) => ({ items: s.items.filter((i) => i.sku !== sku) })),
      clearCart: () => set({ items: [], meta: defaultMeta }),
      setMeta: (m) => set((s) => ({ meta: { ...s.meta, ...m } })),
      saveOrder: () => {
        const { items, meta } = get();
        const total = items.reduce((sum, i) => sum + i.product.precoAtacado * i.quantity, 0);
        const order: SavedOrder = {
          id: `PED-${Date.now()}`,
          createdAt: new Date().toISOString(),
          items,
          meta,
          total,
        };
        set((s) => ({ history: [order, ...s.history].slice(0, 30) }));
        return order;
      },
    }),
    { name: "fetely-order" },
  ),
);

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.product.precoAtacado * i.quantity, 0);
}
