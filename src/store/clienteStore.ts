import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Cliente } from "@/types/cliente";
import { useAuth } from "@/store/authStore";
import { useOrder } from "@/store/orderStore";

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

interface ClienteState {
  clientes: Cliente[];
  upsertCliente: (c: Cliente) => void;
  deleteCliente: (id: string) => void;
  setAtivo: (id: string, ativo: boolean) => void;
  findByCnpj: (cnpjDigits: string) => Cliente | undefined;
  getById: (id: string) => Cliente | undefined;
}

export const useClientes = create<ClienteState>()(
  persist(
    (set, get) => ({
      clientes: [],
      upsertCliente: (c) =>
        set((s) => {
          const i = s.clientes.findIndex((x) => x.id === c.id);
          if (i >= 0) {
            const copy = [...s.clientes];
            copy[i] = c;
            return { clientes: copy };
          }
          return { clientes: [c, ...s.clientes] };
        }),
      deleteCliente: (id) =>
        set((s) => ({ clientes: s.clientes.filter((c) => c.id !== id) })),
      setAtivo: (id, ativo) =>
        set((s) => ({
          clientes: s.clientes.map((c) =>
            c.id === id ? { ...c, ativo, atualizadoEm: new Date().toISOString() } : c,
          ),
        })),
      findByCnpj: (cnpjDigits) =>
        get().clientes.find((c) => c.cnpj === cnpjDigits && c.cnpj !== ""),
      getById: (id) => get().clientes.find((c) => c.id === id),
    }),
    { name: "fetely_clientes_v1", storage: createJSONStorage(safeStorage) },
  ),
);

/** Visible to current user — vendedor sees own; admin/master see all */
export function useVisibleClientes(): Cliente[] {
  const clientes = useClientes((s) => s.clientes);
  const user = useAuth((s) => s.user);
  const roles = useAuth((s) => s.roles);
  const admin = roles.includes("admin") || roles.includes("master");
  if (admin) return clientes;
  if (!user) return [];
  return clientes.filter((c) => c.cadastradoPorVendedorId === user.id);
}

/** Search ALL clients for order flow — avoid duplicates across sellers */
export function searchClientesForOrder(query: string, limit = 8): Cliente[] {
  const all = useClientes.getState().clientes;
  const q = query.trim().toLowerCase();
  if (!q) return all.slice(0, limit);
  const digits = q.replace(/\D/g, "");
  return all
    .filter(
      (c) =>
        c.razaoSocial.toLowerCase().includes(q) ||
        c.nomeFantasia.toLowerCase().includes(q) ||
        (digits.length > 0 && c.cnpj.includes(digits)) ||
        c.cidade.toLowerCase().includes(q) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    )
    .slice(0, limit);
}

/** Calculate aggregated stats from saved orders */
export function calcClienteStats(clienteId: string) {
  const history = useOrder.getState().history;
  const pedidos = history.filter((o) => o.meta.clienteId === clienteId);
  const totalFaturado = pedidos.reduce((s, o) => s + o.total, 0);
  const ultimo = pedidos[0]?.createdAt;
  const ticketMedio = pedidos.length > 0 ? totalFaturado / pedidos.length : 0;
  return {
    totalPedidos: pedidos.length,
    totalFaturado,
    ultimoPedidoEm: ultimo,
    ticketMedio,
    pedidos,
  };
}
