import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};
const safeStorage = (): Storage =>
  typeof window !== "undefined" ? window.localStorage : noopStorage;
import type { CartItem, OrderCommercial, OrderMeta, Product, SavedOrder } from "@/types";
import { useAuth } from "@/store/authStore";


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
  saveOrder: (commercial?: OrderCommercial) => SavedOrder;
  reassignOrder: (
    orderId: string,
    novo: { vendedorId: string; vendedorNome?: string | null; vendedorLogin?: string | null; vendedorTipo?: "interno" | "representante" | null },
  ) => void;

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
      saveOrder: (commercial) => {
        const { items, meta } = get();
        const total =
          commercial?.totalFinal ??
          items.reduce((sum, i) => sum + i.product.precoAtacado * i.quantity, 0);
        const auth = useAuth.getState();
        const profile = auth.profile;

        // Build cliente snapshot if a cliente is bound via meta.clienteId
        let metaWithSnapshot = meta;
        if (meta.clienteId && !meta.clienteSnapshot && typeof window !== "undefined") {
          try {
            const raw = window.localStorage.getItem("fetely_clientes_v1");
            if (raw) {
              const parsed = JSON.parse(raw);
              const list: Array<Record<string, unknown>> = parsed?.state?.clientes ?? [];
              const c = list.find((x) => x.id === meta.clienteId) as
                | (Record<string, string | boolean | undefined>)
                | undefined;
              if (c) {
                const endereco = c.enderecoEntregaIgual
                  ? `${c.logradouro ?? ""}${c.numero ? `, ${c.numero}` : ""} — ${c.bairro ?? ""}, ${c.cidade ?? ""}/${c.estado ?? ""} · ${c.cep ?? ""}`
                  : `${c.entregaLogradouro ?? ""}${c.entregaNumero ? `, ${c.entregaNumero}` : ""} — ${c.entregaBairro ?? ""}, ${c.entregaCidade ?? ""}/${c.entregaEstado ?? ""} · ${c.entregaCep ?? ""}`;
                metaWithSnapshot = {
                  ...meta,
                  clienteSnapshot: {
                    clienteId: String(c.id),
                    cnpj: String(c.cnpjFormatado ?? ""),
                    razaoSocial: String(c.razaoSocial ?? ""),
                    nomeFantasia: String(c.nomeFantasia ?? ""),
                    cidade: String(c.cidade ?? ""),
                    estado: String(c.estado ?? ""),
                    contatoNome: String(c.contatoNome ?? ""),
                    contatoEmail: String(c.contatoEmail ?? ""),
                    contatoTelefone: String(c.contatoTelefone ?? ""),
                    enderecoEntrega: endereco,
                  },
                };
              }
            }
          } catch {
            /* ignore */
          }
        }

        const order: SavedOrder = {
          id: `PED-${Date.now()}`,
          createdAt: new Date().toISOString(),
          items,
          meta: metaWithSnapshot,
          total,
          commercial,
          vendedorId: auth.user?.id,
          vendedorNome: profile?.nome_completo ?? profile?.email ?? undefined,
          vendedorLogin: profile?.login_amigavel ?? profile?.email ?? undefined,
          vendedorTipo: profile?.tipo_vendedor ?? null,
        };
        set((s) => ({ history: [order, ...s.history].slice(0, 30) }));
        return order;
      },
      reassignOrder: (orderId, novo) => {
        set((s) => ({
          history: s.history.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  vendedorId: novo.vendedorId,
                  vendedorNome: novo.vendedorNome ?? o.vendedorNome,
                  vendedorLogin: novo.vendedorLogin ?? o.vendedorLogin,
                  vendedorTipo: novo.vendedorTipo ?? o.vendedorTipo ?? null,
                }
              : o,
          ),
        }));
      },



    }),
    { name: "fetely-order", storage: createJSONStorage(safeStorage) },
  ),
);

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.product.precoAtacado * i.quantity, 0);
}

/**
 * Hook que retorna o histórico de pedidos visível para o usuário logado.
 * - admin/master: vê todos os pedidos
 * - vendedor: vê apenas os próprios (vendedorId === user.id)
 * - pedidos antigos sem vendedorId só aparecem para admin/master
 */
export function useVisibleOrders(): SavedOrder[] {
  const history = useOrder((s) => s.history);
  const user = useAuth((s) => s.user);
  const roles = useAuth((s) => s.roles);
  const isAdminOrMaster = roles.includes("admin") || roles.includes("master");
  if (isAdminOrMaster) return history;
  if (!user) return [];
  return history.filter((o) => o.vendedorId === user.id);
}

