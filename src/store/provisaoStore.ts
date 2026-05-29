import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ItemProvisao, ProvisaoFutura, StatusProvisao } from "@/types/provisao";
import type { ClienteSnapshot } from "@/types/cliente";
import { useAuth } from "@/store/authStore";
import { compararPrevisao } from "@/lib/classifyItem";

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

interface CreateProvisaoInput {
  clienteId: string;
  clienteSnapshot: ClienteSnapshot;
  itens: ItemProvisao[];
  pedidoFirmeId?: string;
  observacoes?: string;
}

interface ProvisaoState {
  provisoes: ProvisaoFutura[];
  counter: number;
  createProvisao: (input: CreateProvisaoInput) => ProvisaoFutura;
  updateStatus: (id: string, status: StatusProvisao, extra?: Partial<ProvisaoFutura>) => void;
  setObservacoes: (id: string, txt: string) => void;
  cancelar: (id: string) => void;
}

export const useProvisao = create<ProvisaoState>()(
  persist(
    (set, get) => ({
      provisoes: [],
      counter: 0,
      createProvisao: (input) => {
        const auth = useAuth.getState();
        const next = get().counter + 1;
        const id = `P${String(next).padStart(4, "0")}`;
        const datasSet = new Set(input.itens.map((i) => i.previsaoData));
        const datasPrevisao = Array.from(datasSet).sort(compararPrevisao);
        const totalReferencia = input.itens.reduce(
          (s, i) => s + i.precoAtacadoReferencia * i.quantidade,
          0,
        );
        const now = new Date().toISOString();
        const provisao: ProvisaoFutura = {
          id,
          criadoEm: now,
          atualizadoEm: now,
          vendedorId: auth.user?.id ?? "",
          vendedorNome:
            auth.profile?.nome_completo ?? auth.profile?.email ?? "—",
          clienteId: input.clienteId,
          clienteSnapshot: input.clienteSnapshot,
          pedidoFirmeId: input.pedidoFirmeId,
          status: "aguardando_estoque",
          itens: input.itens,
          datasPrevisao,
          proximaPrevisao: datasPrevisao[0] ?? "—",
          observacoes: input.observacoes,
          totalReferencia,
        };
        set((s) => ({
          provisoes: [provisao, ...s.provisoes],
          counter: next,
        }));
        return provisao;
      },
      updateStatus: (id, status, extra) =>
        set((s) => ({
          provisoes: s.provisoes.map((p) =>
            p.id === id
              ? { ...p, ...extra, status, atualizadoEm: new Date().toISOString() }
              : p,
          ),
        })),
      setObservacoes: (id, txt) =>
        set((s) => ({
          provisoes: s.provisoes.map((p) =>
            p.id === id
              ? { ...p, observacoes: txt, atualizadoEm: new Date().toISOString() }
              : p,
          ),
        })),
      cancelar: (id) =>
        set((s) => ({
          provisoes: s.provisoes.map((p) =>
            p.id === id
              ? { ...p, status: "cancelado", atualizadoEm: new Date().toISOString() }
              : p,
          ),
        })),
    }),
    { name: "fetely_provisoes_v1", storage: createJSONStorage(safeStorage) },
  ),
);

export function useVisibleProvisoes(): ProvisaoFutura[] {
  const provisoes = useProvisao((s) => s.provisoes);
  const user = useAuth((s) => s.user);
  const roles = useAuth((s) => s.roles);
  const admin = roles.includes("admin") || roles.includes("master");
  if (admin) return provisoes;
  if (!user) return [];
  return provisoes.filter((p) => p.vendedorId === user.id);
}
