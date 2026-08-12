import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem } from "@/types";
import { createSafeStorage } from "@/lib/safeStorage";


export type StatusFilaItem = "pendente" | "feito" | "pulado";

export interface FilaItem {
  clienteId: string;
  clienteNome: string;
  status: StatusFilaItem;
  pedidoGerado?: string;
}

export interface FilaOrigem {
  tipo: "pedido" | "modelo";
  refId: string;        // pedido.id ou modelo.id
  refLabel: string;     // ex: "#PED-2050" ou "Kit Velas Premium"
  itens: CartItem[];    // itens base (já recalculados com preço atual no momento do iniciar)
  grupoOrigemId?: string;
}

interface DuplicacaoState {
  ativo: boolean;
  origem: FilaOrigem | null;
  fila: FilaItem[];
  indiceAtual: number; // índice do próximo a revisar (status pendente)
  iniciar: (origem: FilaOrigem, clientes: { id: string; nome: string }[]) => void;
  marcarFeito: (clienteId: string, pedidoId: string) => void;
  pular: (clienteId: string) => void;
  proximoPendente: () => FilaItem | null;
  finalizar: () => void;
  cancelar: () => void;
}

export const useDuplicacao = create<DuplicacaoState>()(
  persist(
    (set, get) => ({
      ativo: false,
      origem: null,
      fila: [],
      indiceAtual: 0,
      iniciar: (origem, clientes) => {
        set({
          ativo: true,
          origem,
          fila: clientes.map((c) => ({
            clienteId: c.id,
            clienteNome: c.nome,
            status: "pendente" as StatusFilaItem,
          })),
          indiceAtual: 0,
        });
      },
      marcarFeito: (clienteId, pedidoId) => {
        set((s) => ({
          fila: s.fila.map((f) =>
            f.clienteId === clienteId ? { ...f, status: "feito" as StatusFilaItem, pedidoGerado: pedidoId } : f,
          ),
        }));
      },
      pular: (clienteId) => {
        set((s) => ({
          fila: s.fila.map((f) =>
            f.clienteId === clienteId ? { ...f, status: "pulado" as StatusFilaItem } : f,
          ),
        }));
      },
      proximoPendente: () => {
        const f = get().fila.find((x) => x.status === "pendente");
        return f ?? null;
      },
      finalizar: () => set({ ativo: false }),
      cancelar: () => set({ ativo: false, origem: null, fila: [], indiceAtual: 0 }),
    }),
    {
      name: "fetely-duplicacao-v1",
      storage: createJSONStorage(createSafeStorage),
    },
  ),
);
