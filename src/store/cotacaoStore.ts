import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem, OrderCommercial, OrderMeta } from "@/types";
import type {
  Cotacao,
  MotivoPerdaCotacao,
  StatusCotacao,
} from "@/types/cotacao";
import { COTACAO_VALIDADE_DIAS } from "@/types/cotacao";
import { useAuth } from "@/store/authStore";
import { useClientes } from "@/store/clienteStore";

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

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

interface CreateCotacaoInput {
  items: CartItem[];
  meta: OrderMeta;
  total: number;
  commercial?: OrderCommercial;
}

interface CotacaoState {
  cotacoes: Cotacao[];
  counter: number;
  criarCotacao: (input: CreateCotacaoInput) => Cotacao;
  atualizarCotacao: (id: string, input: CreateCotacaoInput) => Cotacao | null;
  atualizarStatus: (
    id: string,
    status: StatusCotacao,
    extra?: { motivo?: MotivoPerdaCotacao; motivoObs?: string; pedidoConvertidoId?: string },
  ) => void;
  duplicar: (id: string) => Cotacao | null;
  marcarConvertida: (id: string, pedidoId: string) => void;
  deletar: (id: string) => void;
  expirarVencidas: () => void;
}

export const useCotacao = create<CotacaoState>()(
  persist(
    (set, get) => ({
      cotacoes: [],
      counter: 0,
      criarCotacao: (input) => {
        const auth = useAuth.getState();
        const next = get().counter + 1;
        const id = `C${String(next).padStart(4, "0")}`;
        const now = new Date().toISOString();
        const cotacao: Cotacao = {
          id,
          criadoEm: now,
          atualizadoEm: now,
          validoAte: addDays(now, COTACAO_VALIDADE_DIAS),
          vendedorId: auth.user?.id ?? "",
          vendedorNome:
            auth.profile?.nome_completo ?? auth.profile?.email ?? "—",
          vendedorLogin: auth.profile?.login_amigavel ?? auth.profile?.email ?? undefined,
          items: input.items,
          meta: input.meta,
          total: input.total,
          commercial: input.commercial,
          status: "aberta",
        };
        set((s) => ({ cotacoes: [cotacao, ...s.cotacoes], counter: next }));
        return cotacao;
      },
      atualizarCotacao: (id, input) => {
        const now = new Date().toISOString();
        let updated: Cotacao | null = null;
        set((s) => ({
          cotacoes: s.cotacoes.map((c) => {
            if (c.id !== id) return c;
            updated = {
              ...c,
              items: input.items,
              meta: input.meta,
              total: input.total,
              commercial: input.commercial,
              atualizadoEm: now,
              validoAte: addDays(now, COTACAO_VALIDADE_DIAS),
              status: c.status === "expirada" ? "aberta" : c.status,
            };
            return updated;
          }),
        }));
        return updated;
      },
      atualizarStatus: (id, status, extra) => {
        const now = new Date().toISOString();
        set((s) => ({
          cotacoes: s.cotacoes.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status,
                  atualizadoEm: now,
                  motivoPerda: status === "perdida" ? extra?.motivo ?? c.motivoPerda : c.motivoPerda,
                  motivoPerdaObs:
                    status === "perdida" ? extra?.motivoObs ?? c.motivoPerdaObs : c.motivoPerdaObs,
                  pedidoConvertidoId:
                    status === "convertida" ? extra?.pedidoConvertidoId ?? c.pedidoConvertidoId : c.pedidoConvertidoId,
                }
              : c,
          ),
        }));
      },
      duplicar: (id) => {
        const orig = get().cotacoes.find((c) => c.id === id);
        if (!orig) return null;
        return get().criarCotacao({
          items: orig.items,
          meta: orig.meta,
          total: orig.total,
          commercial: orig.commercial,
        });
      },
      marcarConvertida: (id, pedidoId) =>
        get().atualizarStatus(id, "convertida", { pedidoConvertidoId: pedidoId }),
      deletar: (id) =>
        set((s) => ({ cotacoes: s.cotacoes.filter((c) => c.id !== id) })),
      expirarVencidas: () => {
        const hoje = Date.now();
        set((s) => ({
          cotacoes: s.cotacoes.map((c) =>
            (c.status === "aberta" || c.status === "em_negociacao") &&
            new Date(c.validoAte).getTime() < hoje
              ? { ...c, status: "expirada", atualizadoEm: new Date().toISOString() }
              : c,
          ),
        }));
      },
    }),
    {
      name: "fetely_cotacoes",
      storage: createJSONStorage(safeStorage),
      partialize: (state) => ({ cotacoes: state.cotacoes, counter: state.counter }),
    },
  ),
);

export function useVisibleCotacoes(): Cotacao[] {
  const cotacoes = useCotacao((s) => s.cotacoes);
  const user = useAuth((s) => s.user);
  const profile = useAuth((s) => s.profile);
  const roles = useAuth((s) => s.roles);
  const clientes = useClientes((s) => s.clientes);
  const admin = roles.includes("admin") || roles.includes("master");
  if (admin) return cotacoes;
  if (!user) return [];
  if (roles.includes("cliente")) {
    const cid = profile?.cliente_id ?? null;
    if (!cid) return [];
    return cotacoes.filter((c) => c.meta.clienteId === cid);
  }
  const meusClienteIds = new Set(
    clientes.filter((c) => c.cadastradoPorVendedorId === user.id).map((c) => c.id),
  );
  return cotacoes.filter(
    (c) =>
      c.vendedorId === user.id ||
      (c.meta.clienteId && meusClienteIds.has(c.meta.clienteId)),
  );
}

export function diasAteExpirar(cotacao: Cotacao): number {
  const ms = new Date(cotacao.validoAte).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
