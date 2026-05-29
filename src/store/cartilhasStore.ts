import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  _syncCommercial,
  FAIXAS_DEFAULT,
  CONDICOES_DEFAULT,
  REGRAS_DEFAULT,
  type Faixa,
  type CondicaoPagamento,
  type RegrasGerais,
} from "@/lib/commercial";

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

export type AuditEntidade = "faixa" | "condicao" | "regras_gerais";
export type AuditAcao = "criado" | "editado" | "desativado" | "reativado" | "reordenado";

export interface AuditCampo {
  campo: string;
  valorAnterior: string | number;
  valorNovo: string | number;
}

export interface AuditCartilha {
  id: string;
  timestamp: string;
  usuarioId: string;
  usuarioNome: string;
  entidade: AuditEntidade;
  entidadeId: string | number;
  entidadeNome: string;
  acao: AuditAcao;
  camposAlterados?: AuditCampo[];
}

export interface AuditMeta {
  usuarioId: string;
  usuarioNome: string;
}

interface CartilhasState {
  faixas: Faixa[];
  condicoes: CondicaoPagamento[];
  regras: RegrasGerais;
  audit: AuditCartilha[];
  upsertFaixa: (f: Faixa, meta: AuditMeta) => { ok: true } | { ok: false; error: string };
  removeFaixa: (id: number, meta: AuditMeta) => void;
  toggleFaixaAtiva: (id: number, meta: AuditMeta) => void;
  reorderFaixas: (orderedIds: number[], meta: AuditMeta) => void;
  upsertCondicao: (c: CondicaoPagamento, meta: AuditMeta) => { ok: true } | { ok: false; error: string };
  toggleCondicaoAtiva: (id: number, meta: AuditMeta) => void;
  reorderCondicoes: (orderedIds: number[], meta: AuditMeta) => void;
  updateRegras: (r: RegrasGerais, meta: AuditMeta) => void;
  resetToDefault: () => void;
}

function diffObj<T extends Record<string, unknown>>(prev: T, next: T): AuditCampo[] {
  const out: AuditCampo[] = [];
  const keys = new Set<string>([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of keys) {
    const a = prev[k];
    const b = next[k];
    if (JSON.stringify(a ?? "") !== JSON.stringify(b ?? "")) {
      out.push({
        campo: k,
        valorAnterior: typeof a === "number" ? a : String(a ?? ""),
        valorNovo: typeof b === "number" ? b : String(b ?? ""),
      });
    }
  }
  return out;
}

function nextId(arr: { id: number }[]): number {
  return arr.reduce((m, x) => Math.max(m, x.id), 0) + 1;
}

function makeAudit(
  meta: AuditMeta,
  entidade: AuditEntidade,
  entidadeId: string | number,
  entidadeNome: string,
  acao: AuditAcao,
  camposAlterados?: AuditCampo[],
): AuditCartilha {
  return {
    id: `AC${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    usuarioId: meta.usuarioId,
    usuarioNome: meta.usuarioNome,
    entidade,
    entidadeId,
    entidadeNome,
    acao,
    camposAlterados,
  };
}

export const useCartilhas = create<CartilhasState>()(
  persist(
    (set, get) => ({
      faixas: FAIXAS_DEFAULT,
      condicoes: CONDICOES_DEFAULT,
      regras: REGRAS_DEFAULT,
      audit: [],

      upsertFaixa: (f, meta) => {
        if (!f.nome.trim()) return { ok: false, error: "Nome é obrigatório" };
        if (f.valorMin < 0) return { ok: false, error: "Valor mínimo inválido" };
        if (f.valorMax !== Infinity && f.valorMax <= f.valorMin) {
          return { ok: false, error: "Valor máximo deve ser maior que o mínimo" };
        }
        if (!f.condicoesDisponiveis || f.condicoesDisponiveis.length === 0) {
          return { ok: false, error: "A faixa precisa ter ao menos uma condição de pagamento" };
        }
        if (f.descontoCelebra < 0 || f.descontoCelebra > 100) {
          return { ok: false, error: "Desconto Celebra inválido" };
        }
        const state = get();
        const idx = state.faixas.findIndex((x) => x.id === f.id);
        const existing = idx >= 0 ? state.faixas[idx] : null;
        const now = new Date().toISOString();
        const next: Faixa = {
          ...f,
          totalComPix: f.descontoCelebra + (f.bonusPixAplicavel === false ? 0 : f.bonusPix),
          ativa: f.ativa ?? true,
          ordem: f.ordem ?? (existing?.ordem ?? state.faixas.length + 1),
          atualizadoEm: now,
          atualizadoPor: meta.usuarioNome,
          criadoEm: existing?.criadoEm ?? now,
          criadoPor: existing?.criadoPor ?? meta.usuarioNome,
        };
        const newFaixas =
          idx >= 0
            ? state.faixas.map((x, i) => (i === idx ? next : x))
            : [...state.faixas, { ...next, id: f.id || nextId(state.faixas) }];
        const entry = makeAudit(
          meta,
          "faixa",
          next.id,
          next.nome,
          existing ? "editado" : "criado",
          existing ? diffObj(existing as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>) : undefined,
        );
        set({ faixas: newFaixas, audit: [entry, ...state.audit].slice(0, 1000) });
        return { ok: true };
      },

      removeFaixa: (id, meta) => {
        const state = get();
        const f = state.faixas.find((x) => x.id === id);
        if (!f) return;
        const entry = makeAudit(meta, "faixa", id, f.nome, "desativado");
        set({
          faixas: state.faixas.map((x) => (x.id === id ? { ...x, ativa: false } : x)),
          audit: [entry, ...state.audit].slice(0, 1000),
        });
      },

      toggleFaixaAtiva: (id, meta) => {
        const state = get();
        const f = state.faixas.find((x) => x.id === id);
        if (!f) return;
        const ativa = !(f.ativa ?? true);
        const entry = makeAudit(meta, "faixa", id, f.nome, ativa ? "reativado" : "desativado");
        set({
          faixas: state.faixas.map((x) => (x.id === id ? { ...x, ativa } : x)),
          audit: [entry, ...state.audit].slice(0, 1000),
        });
      },

      reorderFaixas: (orderedIds, meta) => {
        const state = get();
        const newFaixas = state.faixas.map((f) => {
          const idx = orderedIds.indexOf(f.id);
          return idx >= 0 ? { ...f, ordem: idx + 1 } : f;
        });
        const entry = makeAudit(meta, "faixa", "ordem", "Reordenação de faixas", "reordenado");
        set({ faixas: newFaixas, audit: [entry, ...state.audit].slice(0, 1000) });
      },

      upsertCondicao: (c, meta) => {
        if (!c.descricao.trim()) return { ok: false, error: "Descrição é obrigatória" };
        if (!c.numeroParcelas || c.numeroParcelas < 1) {
          return { ok: false, error: "Número de parcelas inválido" };
        }
        if (!c.diasParcelas || c.diasParcelas.length !== c.numeroParcelas) {
          return { ok: false, error: "Quantidade de dias precisa bater com nº de parcelas" };
        }
        const state = get();
        const idx = state.condicoes.findIndex((x) => x.id === c.id);
        const existing = idx >= 0 ? state.condicoes[idx] : null;
        const now = new Date().toISOString();
        const next: CondicaoPagamento = {
          ...c,
          ativa: c.ativa ?? true,
          exibirParaVendedor: c.exibirParaVendedor ?? true,
          ordem: c.ordem ?? (existing?.ordem ?? state.condicoes.length + 1),
          atualizadoEm: now,
          criadoEm: existing?.criadoEm ?? now,
          criadoPor: existing?.criadoPor ?? meta.usuarioNome,
        };
        const newCondicoes =
          idx >= 0
            ? state.condicoes.map((x, i) => (i === idx ? next : x))
            : [...state.condicoes, { ...next, id: c.id || nextId(state.condicoes) }];
        const entry = makeAudit(
          meta,
          "condicao",
          next.id,
          next.descricao,
          existing ? "editado" : "criado",
          existing ? diffObj(existing as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>) : undefined,
        );
        set({ condicoes: newCondicoes, audit: [entry, ...state.audit].slice(0, 1000) });
        return { ok: true };
      },

      toggleCondicaoAtiva: (id, meta) => {
        const state = get();
        const c = state.condicoes.find((x) => x.id === id);
        if (!c) return;
        const ativa = !(c.ativa ?? true);
        const entry = makeAudit(meta, "condicao", id, c.descricao, ativa ? "reativado" : "desativado");
        set({
          condicoes: state.condicoes.map((x) => (x.id === id ? { ...x, ativa } : x)),
          audit: [entry, ...state.audit].slice(0, 1000),
        });
      },

      reorderCondicoes: (orderedIds, meta) => {
        const state = get();
        const newCondicoes = state.condicoes.map((c) => {
          const idx = orderedIds.indexOf(c.id);
          return idx >= 0 ? { ...c, ordem: idx + 1 } : c;
        });
        const entry = makeAudit(meta, "condicao", "ordem", "Reordenação de condições", "reordenado");
        set({ condicoes: newCondicoes, audit: [entry, ...state.audit].slice(0, 1000) });
      },

      updateRegras: (r, meta) => {
        const state = get();
        const now = new Date().toISOString();
        const next: RegrasGerais = { ...r, atualizadoEm: now, atualizadoPor: meta.usuarioNome };
        const entry = makeAudit(
          meta,
          "regras_gerais",
          "regras",
          "Regras Gerais",
          "editado",
          diffObj(state.regras as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>),
        );
        set({ regras: next, audit: [entry, ...state.audit].slice(0, 1000) });
      },

      resetToDefault: () =>
        set({
          faixas: FAIXAS_DEFAULT,
          condicoes: CONDICOES_DEFAULT,
          regras: REGRAS_DEFAULT,
        }),
    }),
    {
      name: "fetely-cartilhas",
      storage: createJSONStorage(safeStorage),
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) {
          _syncCommercial(state.faixas, state.condicoes, state.regras);
        }
      },
    },
  ),
);

// Mantém commercial.ts em sincronia a cada alteração na store.
if (typeof window !== "undefined") {
  // Sync inicial (caso onRehydrateStorage não dispare síncrono)
  const s = useCartilhas.getState();
  _syncCommercial(s.faixas, s.condicoes, s.regras);
  useCartilhas.subscribe((s) => _syncCommercial(s.faixas, s.condicoes, s.regras));
}
