import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem, OrderCommercial, OrderMeta, Product, SavedOrder } from "@/types";
import { useAuth } from "@/store/authStore";
import { supabase } from "@/integrations/supabase/client";

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

interface OrderState {
  items: CartItem[];
  meta: OrderMeta;
  history: SavedOrder[];
  hidratado: boolean;
  hydrate: () => Promise<void>;
  setHistoryFromRows: (orders: SavedOrder[]) => void;
  addItem: (product: Product, quantity: number) => void;
  addBulk: (entries: { product: Product; quantity: number }[]) => void;
  updateQty: (sku: string, quantity: number) => void;
  removeItem: (sku: string) => void;
  removeItems: (skus: string[]) => void;
  clearCart: () => void;
  setMeta: (m: Partial<OrderMeta>) => void;
  saveOrder: (commercial?: OrderCommercial, itemsOverride?: CartItem[]) => Promise<SavedOrder>;
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

function rowToOrder(row: Record<string, unknown>, items: CartItem[]): SavedOrder {
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    items,
    meta: row.meta as OrderMeta,
    total: Number(row.total ?? 0),
    commercial: (row.commercial as OrderCommercial | null) ?? undefined,
    vendedorId: (row.vendedor_id as string | null) ?? undefined,
    vendedorNome: (row.vendedor_nome as string | null) ?? undefined,
    vendedorLogin: (row.vendedor_login as string | null) ?? undefined,
    vendedorTipo: (row.vendedor_tipo as "interno" | "representante" | null) ?? null,
  };
}

function rowToItem(row: Record<string, unknown>): CartItem {
  return {
    sku: row.sku as string,
    product: row.product_snapshot as Product,
    quantity: Number(row.quantity ?? 0),
  };
}

export function orderToRow(o: SavedOrder): Record<string, unknown> {
  const totalUnidades = o.items.reduce((s, i) => s + i.quantity, 0);
  const totalSkus = o.items.length;
  const metaAny = o.meta as OrderMeta & { provisaoOrigemId?: string };
  return {
    id: o.id,
    created_at: o.createdAt,
    vendedor_id: o.vendedorId ?? null,
    vendedor_nome: o.vendedorNome ?? "—",
    vendedor_login: o.vendedorLogin ?? null,
    vendedor_tipo: o.vendedorTipo ?? null,
    cliente_id: o.meta.clienteId ?? null,
    meta: o.meta,
    cliente_snapshot: o.meta.clienteSnapshot ?? null,
    commercial: o.commercial ?? null,
    total: o.total,
    total_unidades: totalUnidades,
    total_skus: totalSkus,
    provisao_origem_id: metaAny.provisaoOrigemId ?? null,
  };
}

export function orderItemsToRows(o: SavedOrder): Record<string, unknown>[] {
  return o.items.map((it, idx) => ({
    order_id: o.id,
    posicao: idx,
    sku: it.sku,
    product_snapshot: it.product,
    quantity: it.quantity,
    preco_unit_atacado: it.product.precoAtacado,
    subtotal_bruto: it.product.precoAtacado * it.quantity,
  }));
}

export const useOrder = create<OrderState>()(
  persist(
    (set, get) => ({
      items: [],
      meta: defaultMeta,
      history: [],
      hidratado: false,
      hydrate: async () => {
        try {
          const { data: orderRows, error: err1 } = await supabase
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(200);
          if (err1) throw err1;
          const ids = (orderRows ?? []).map((r) => r.id as string);
          let itemsByOrder: Record<string, CartItem[]> = {};
          if (ids.length > 0) {
            const { data: itemRows, error: err2 } = await supabase
              .from("order_items")
              .select("*")
              .in("order_id", ids)
              .order("posicao", { ascending: true });
            if (err2) throw err2;
            itemsByOrder = (itemRows ?? []).reduce<Record<string, CartItem[]>>((acc, r) => {
              const oid = (r as Record<string, unknown>).order_id as string;
              if (!acc[oid]) acc[oid] = [];
              acc[oid].push(rowToItem(r as Record<string, unknown>));
              return acc;
            }, {});
          }
          const history = (orderRows ?? []).map((r) =>
            rowToOrder(r as Record<string, unknown>, itemsByOrder[(r as Record<string, unknown>).id as string] ?? []),
          );
          set({ history, hidratado: true });
        } catch (err) {
          console.error("[orderStore] hydrate falhou:", err);
          set({ hidratado: true });
        }
      },
      setHistoryFromRows: (orders) => set({ history: orders }),
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
      removeItems: (skus) => {
        const set_ = new Set(skus);
        set((s) => ({ items: s.items.filter((i) => !set_.has(i.sku)) }));
      },
      clearCart: () => set({ items: [], meta: defaultMeta }),
      setMeta: (m) => set((s) => ({ meta: { ...s.meta, ...m } })),
      saveOrder: async (commercial, itemsOverride) => {
        const { items: allItems, meta } = get();
        const items = itemsOverride ?? allItems;
        const total =
          commercial?.totalFinal ??
          items.reduce((sum, i) => sum + i.product.precoAtacado * i.quantity, 0);

        // ── GUARD: session pronta e usuário identificado ──
        const auth = useAuth.getState();
        if (!auth.session || !auth.user?.id) {
          throw new Error(
            "Sua sessão expirou ou ainda está carregando. Atualize a página e tente novamente.",
          );
        }
        const profile = auth.profile;
        const vendedorNomeFinal =
          profile?.nome_completo ?? profile?.email ?? auth.user.email;
        if (!vendedorNomeFinal) {
          throw new Error("Perfil do vendedor não está disponível. Atualize a página.");
        }

        let metaWithSnapshot = meta;
        if (meta.clienteId && !meta.clienteSnapshot && typeof window !== "undefined") {
          try {
            const raw = window.localStorage.getItem("fetely_clientes_v1");
            if (raw) {
              const parsed = JSON.parse(raw);
              const list: Array<Record<string, unknown>> = parsed?.state?.clientes ?? [];
              const c = list.find((x) => x.id === meta.clienteId) as
                | Record<string, string | boolean | undefined>
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
          vendedorId: auth.user.id,
          vendedorNome: vendedorNomeFinal,
          vendedorLogin: profile?.login_amigavel ?? profile?.email ?? undefined,
          vendedorTipo: profile?.tipo_vendedor ?? null,
        };

        // ── SAVE NO BANCO COM AWAIT REAL ──
        try {
          const { error: errO } = await supabase
            .from("orders")
            .upsert(orderToRow(order) as never, { onConflict: "id" });
          if (errO) throw errO;

          const itemRows = orderItemsToRows(order);
          if (itemRows.length > 0) {
            await supabase.from("order_items").delete().eq("order_id", order.id);
            const { error: errI } = await supabase
              .from("order_items")
              .insert(itemRows as never);
            if (errI) throw errI;
          }
        } catch (err: unknown) {
          console.error("[orderStore] saveOrder banco falhou:", err, order.id);
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(
            msg
              ? `Não foi possível salvar o pedido no banco: ${msg}`
              : "Não foi possível salvar o pedido. Verifique sua conexão e tente novamente.",
          );
        }

        // ── SÓ ADICIONA AO HISTORY APÓS SUCESSO NO BANCO ──
        set((s) => ({ history: [order, ...s.history].slice(0, 200) }));

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
        const update: Record<string, unknown> = { vendedor_id: novo.vendedorId };
        if (novo.vendedorNome !== undefined && novo.vendedorNome !== null) update.vendedor_nome = novo.vendedorNome;
        if (novo.vendedorLogin !== undefined && novo.vendedorLogin !== null) update.vendedor_login = novo.vendedorLogin;
        if (novo.vendedorTipo !== undefined && novo.vendedorTipo !== null) update.vendedor_tipo = novo.vendedorTipo;
        void supabase
          .from("orders")
          .update(update as never)
          .eq("id", orderId)
          .then(({ error }) => {
            if (error) console.error("[orderStore] reassignOrder falhou:", error, orderId);
          });
      },
    }),
    {
      name: "fetely-order",
      storage: createJSONStorage(safeStorage),
      partialize: (state) =>
        ({
          items: state.items,
          meta: state.meta,
          history: state.history,
        }) as Partial<OrderState>,
    },
  ),
);

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.product.precoAtacado * i.quantity, 0);
}

export function useVisibleOrders(): SavedOrder[] {
  const history = useOrder((s) => s.history);
  const user = useAuth((s) => s.user);
  const profile = useAuth((s) => s.profile);
  const roles = useAuth((s) => s.roles);
  const isAdminOrMaster = roles.includes("admin") || roles.includes("master");
  if (isAdminOrMaster) return history;
  if (!user) return [];
  if (roles.includes("cliente")) {
    const cid = profile?.cliente_id ?? null;
    if (!cid) return [];
    return history.filter((o) => o.meta.clienteId === cid);
  }
  return history.filter((o) => o.vendedorId === user.id);
}
