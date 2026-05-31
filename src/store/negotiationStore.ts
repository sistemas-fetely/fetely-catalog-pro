import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { hashSenha, SENHA_MASTER_DEFAULT } from "@/lib/commercial";

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

interface PersistState {
  masterHash: string | null;
}

interface SessionState {
  ativo: boolean;
  tentativas: number;
  descontoPct: number;
  justificativa: string;
  observacaoInterna: string;
  usarReservada: boolean;
  condicaoSelecionadaId: number | null;
  freteGratis: boolean;
  liberarTodasCondicoes: boolean;
}

interface NegotiationStore extends PersistState, SessionState {
  ensureInitialHash: () => Promise<void>;
  tryActivate: (senha: string) => Promise<{ ok: boolean; bloqueado: boolean; erro?: string }>;
  desativar: () => void;
  alterarSenha: (atual: string, nova: string) => Promise<{ ok: boolean; erro?: string }>;
  setDescontoPct: (v: number) => void;
  setJustificativa: (v: string) => void;
  setObservacaoInterna: (v: string) => void;
  setUsarReservada: (v: boolean) => void;
  setCondicaoSelecionadaId: (id: number | null) => void;
  setFreteGratis: (v: boolean) => void;
  setLiberarTodasCondicoes: (v: boolean) => void;
  resetSession: () => void;
}

const defaultSession: SessionState = {
  ativo: false,
  tentativas: 0,
  descontoPct: 0,
  justificativa: "",
  observacaoInterna: "",
  usarReservada: false,
  condicaoSelecionadaId: null,
  freteGratis: false,
  liberarTodasCondicoes: true,
};

export const useNegotiation = create<NegotiationStore>()(
  persist(
    (set, get) => ({
      masterHash: null,
      ...defaultSession,

      ensureInitialHash: async () => {
        if (!get().masterHash) {
          const h = await hashSenha(SENHA_MASTER_DEFAULT);
          set({ masterHash: h });
        }
      },

      tryActivate: async (senha: string) => {
        const state = get();
        if (state.tentativas >= 3) {
          return { ok: false, bloqueado: true, erro: "Muitas tentativas. Recarregue a página." };
        }
        await get().ensureInitialHash();
        const h = await hashSenha(senha);
        if (h === get().masterHash) {
          set({ ativo: true, tentativas: 0 });
          return { ok: true, bloqueado: false };
        }
        const novas = state.tentativas + 1;
        set({ tentativas: novas });
        return {
          ok: false,
          bloqueado: novas >= 3,
          erro: novas >= 3 ? "Bloqueado após 3 tentativas." : "Senha incorreta.",
        };
      },

      desativar: () =>
        set({
          ativo: false,
          descontoPct: 0,
          justificativa: "",
          observacaoInterna: "",
          usarReservada: false,
          freteGratis: false,
          liberarTodasCondicoes: true,
        }),


      alterarSenha: async (atual, nova) => {
        await get().ensureInitialHash();
        const hAtual = await hashSenha(atual);
        if (hAtual !== get().masterHash) return { ok: false, erro: "Senha atual incorreta." };
        if (nova.length < 8) return { ok: false, erro: "Nova senha precisa de 8+ caracteres." };
        const hNova = await hashSenha(nova);
        set({ masterHash: hNova });
        return { ok: true };
      },

      setDescontoPct: (v) => set({ descontoPct: Math.max(0, Math.min(15, v)) }),
      setJustificativa: (v) => set({ justificativa: v }),
      setObservacaoInterna: (v) => set({ observacaoInterna: v }),
      setUsarReservada: (v) => set({ usarReservada: v }),
      setCondicaoSelecionadaId: (id) => set({ condicaoSelecionadaId: id }),
      setFreteGratis: (v) => set({ freteGratis: v }),
      setLiberarTodasCondicoes: (v) => set({ liberarTodasCondicoes: v }),
      resetSession: () => set({ ...defaultSession, tentativas: 0 }),
    }),
    {
      name: "fetely-negotiation-v2",
      storage: createJSONStorage(safeStorage),
      partialize: (s) => ({ masterHash: s.masterHash }),
    },
  ),
);

// Log de negociações para auditoria
export interface NegociacaoLog {
  id: string;
  timestamp: string;
  valorBruto: number;
  descontoPct: number;
  descontoValor: number;
  justificativa: string;
  faixaUsada: string;
}

export function registrarNegociacao(log: NegociacaoLog) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem("fetely_negociacoes");
    const arr: NegociacaoLog[] = raw ? JSON.parse(raw) : [];
    arr.unshift(log);
    window.localStorage.setItem("fetely_negociacoes", JSON.stringify(arr.slice(0, 200)));
  } catch {
    /* ignore */
  }
}
