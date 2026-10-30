import { create } from "zustand";
import type { SavedOrder } from "@/types";
import { b2b, type B2BPermissions } from "@/lib/b2bAdjustment";
import { useOrder } from "@/store/orderStore";

export const useB2BAdjustment = create<{
  target: SavedOrder | null;
  permissions: B2BPermissions | null;
  open: (order: SavedOrder, permissions: B2BPermissions) => void;
  close: () => void;
}>((set) => ({ target: null, permissions: null, open: (target, permissions) => set({ target, permissions }), close: () => set({ target: null, permissions: null }) }));

// Read SNCF's existing Farol for authoritative totals; never infer totals from the submitted adjustment.
export async function refreshAdjustedOrder(order: SavedOrder) {
  const [permissions, farol] = await Promise.all([
    b2b<B2BPermissions>("b2b_permissoes", { pedido_id: order.sncfPedidoId }),
    b2b<{ ok: boolean; pedidos: { pedido_id: string; valor_liquido: number | null }[] }>("farol"),
  ]);
  const remote = farol.pedidos.find(p => p.pedido_id === order.sncfPedidoId);
  if (remote?.valor_liquido == null) throw new Error("SNCF não retornou o valor atualizado do pedido.");
  const local = await useOrder.getState().hydrateOrderById(order.id);
  const updated: SavedOrder = { ...(local ?? order), total: Number(remote.valor_liquido),
    meta: { ...(local ?? order).meta, condicaoPagamento: permissions.condicoes.find(c => c.slug === permissions.condicao_atual)?.rotulo ?? permissions.condicao_atual },
    commercial: (local ?? order).commercial ? { ...(local ?? order).commercial as NonNullable<SavedOrder["commercial"]>, totalFinal: Number(remote.valor_liquido), freteValor: permissions.frete.valor,
      condicaoDescricao: permissions.condicoes.find(c => c.slug === permissions.condicao_atual)?.rotulo ?? permissions.condicao_atual } : undefined,
  };
  useOrder.setState(s => ({ history: s.history.map(o => o.id === order.id ? updated : o) }));
  useB2BAdjustment.setState({ target: updated, permissions });
  return updated;
}