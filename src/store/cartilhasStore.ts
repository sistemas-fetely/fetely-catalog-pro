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
import { supabase } from "@/integrations/supabase/client";
import { createSafeStorage } from "@/lib/safeStorage";


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
  hidratado: boolean;
  hydrate: () => Promise<void>;
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

// --- Helpers ---------------------------------------------------------------

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

// --- Mappers TS <-> Banco --------------------------------------------------

function rowToFaixa(row: Record<string, unknown>): Faixa {
  return {
    id: row.id as number,
    nome: row.nome as string,
    valorMin: Number(row.valor_min ?? 0),
    valorMax: row.valor_max == null ? Infinity : Number(row.valor_max),
    frete: row.frete as "CIF" | "FOB",
    descontoCelebra: Number(row.desconto_celebra ?? 0),
    bonusPix: Number(row.bonus_pix ?? 0),
    totalComPix: Number(row.total_com_pix ?? 0),
    cartaoAte: (row.cartao_ate as string) ?? "",
    boletoAte: (row.boleto_ate as string) ?? "",
    prazoMedioBoleto: Number(row.prazo_medio_boleto ?? 0),
    condicoesDisponiveis: (row.condicoes_disponiveis as number[]) ?? [],
    requerSenhaMaster: (row.requer_senha_master as boolean) ?? false,
    bonusPixAplicavel: (row.bonus_pix_aplicavel as boolean) ?? true,
    cor: (row.cor as string | null) ?? undefined,
    icone: (row.icone as string | null) ?? undefined,
    descricao: (row.descricao as string | null) ?? undefined,
    freteObservacao: (row.frete_observacao as string | null) ?? undefined,
    ativa: (row.ativa as boolean) ?? true,
    ordem: (row.ordem as number) ?? 0,
  } as Faixa;
}

function faixaToRow(f: Faixa, usuario?: string): Record<string, unknown> {
  return {
    id: f.id,
    nome: f.nome,
    valor_min: f.valorMin,
    valor_max: f.valorMax === Infinity ? null : f.valorMax,
    frete: f.frete,
    desconto_celebra: f.descontoCelebra,
    bonus_pix: f.bonusPix,
    total_com_pix: f.totalComPix,
    cartao_ate: f.cartaoAte,
    boleto_ate: f.boletoAte,
    prazo_medio_boleto: f.prazoMedioBoleto,
    condicoes_disponiveis: f.condicoesDisponiveis ?? [],
    requer_senha_master: f.requerSenhaMaster ?? false,
    bonus_pix_aplicavel: f.bonusPixAplicavel ?? true,
    cor: f.cor ?? null,
    icone: f.icone ?? null,
    descricao: f.descricao ?? null,
    frete_observacao: f.freteObservacao ?? null,
    ativa: f.ativa ?? true,
    ordem: f.ordem ?? 0,
    atualizado_por: usuario ?? null,
  };
}

function rowToCondicao(row: Record<string, unknown>): CondicaoPagamento {
  return {
    id: row.id as number,
    descricao: row.descricao as string,
    valorMinimo: Number(row.valor_minimo ?? 0),
    tipo: row.tipo as "pix" | "boleto" | "cartao",
    numeroParcelas: (row.numero_parcelas as number | null) ?? undefined,
    diasParcelas: (row.dias_parcelas as number[] | null) ?? undefined,
    semJuros: (row.sem_juros as boolean) ?? false,
    temBonusPix: (row.tem_bonus_pix as boolean) ?? false,
    destaque: (row.destaque as boolean) ?? false,
    exibirParaVendedor: (row.exibir_para_vendedor as boolean) ?? true,
    ativa: (row.ativa as boolean) ?? true,
    ordem: (row.ordem as number) ?? 0,
    criadoEm: (row.criado_em as string | null) ?? undefined,
    atualizadoEm: (row.atualizado_em as string | null) ?? undefined,
    criadoPor: (row.criado_por as string | null) ?? undefined,
  };
}

function condicaoToRow(c: CondicaoPagamento): Record<string, unknown> {
  return {
    id: c.id,
    descricao: c.descricao,
    valor_minimo: c.valorMinimo,
    tipo: c.tipo,
    numero_parcelas: c.numeroParcelas ?? null,
    dias_parcelas: c.diasParcelas ?? null,
    sem_juros: c.semJuros ?? false,
    tem_bonus_pix: c.temBonusPix ?? false,
    destaque: c.destaque ?? false,
    exibir_para_vendedor: c.exibirParaVendedor ?? true,
    ativa: c.ativa ?? true,
    ordem: c.ordem ?? 0,
    criado_por: c.criadoPor ?? null,
  };
}

function rowToRegras(row: Record<string, unknown>): RegrasGerais {
  return {
    pedidoMinimo: Number(row.pedido_minimo ?? 0),
    descontoMasterMax: Number(row.desconto_master_max ?? 0),
    tentativasSenhaMaster: Number(row.tentativas_senha_master ?? 0),
    bloqueioSenhaMasterMinutos: Number(row.bloqueio_senha_master_minutos ?? 0),
    provisaoExpirarDias: Number(row.provisao_expirar_dias ?? 0),
    faixaReservadaNome: (row.faixa_reservada_nome as string) ?? "Reservada",
    bonusPixPadrao: Number(row.bonus_pix_padrao ?? 0),
    atualizadoEm: (row.atualizado_em as string | null) ?? undefined,
    atualizadoPor: (row.atualizado_por as string | null) ?? undefined,
  };
}


function regrasToRow(r: RegrasGerais, usuario?: string): Record<string, unknown> {
  return {
    id: 1,
    pedido_minimo: r.pedidoMinimo,
    desconto_master_max: r.descontoMasterMax,
    tentativas_senha_master: r.tentativasSenhaMaster,
    bloqueio_senha_master_minutos: r.bloqueioSenhaMasterMinutos,
    provisao_expirar_dias: r.provisaoExpirarDias,
    faixa_reservada_nome: r.faixaReservadaNome,
    bonus_pix_padrao: r.bonusPixPadrao,
    atualizado_por: usuario ?? null,
  };
}


function logAudit(entry: AuditCartilha): void {
  // fire-and-forget
  supabase
    .from("cartilhas_audit")
    .insert({
      criado_em: entry.timestamp,
      usuario_id: entry.usuarioId || null,
      usuario_nome: entry.usuarioNome,
      entidade: entry.entidade,
      entidade_id: String(entry.entidadeId),
      entidade_nome: entry.entidadeNome,
      acao: entry.acao,
      campos_alterados: entry.camposAlterados ?? null,
    } as never)
    .then(({ error }) => {
      if (error) console.error("[cartilhasStore] logAudit falhou:", error);
    });
}

// --- Store -----------------------------------------------------------------

export const useCartilhas = create<CartilhasState>()(
  persist(
    (set, get) => ({
      faixas: FAIXAS_DEFAULT,
      condicoes: CONDICOES_DEFAULT,
      regras: REGRAS_DEFAULT,
      audit: [],
      hidratado: false,

      hydrate: async () => {
        try {
          const [faixasRes, condRes, regrasRes] = await Promise.all([
            supabase.from("faixas").select("*").order("ordem", { ascending: true }),
            supabase.from("condicoes_pagamento").select("*").order("ordem", { ascending: true }),
            supabase.from("regras_gerais").select("*").eq("id", 1).maybeSingle(),
          ]);
          if (faixasRes.error) throw faixasRes.error;
          if (condRes.error) throw condRes.error;
          if (regrasRes.error) throw regrasRes.error;
          const faixas = (faixasRes.data ?? []).map((r) => rowToFaixa(r as Record<string, unknown>));
          const condicoes = (condRes.data ?? []).map((r) => rowToCondicao(r as Record<string, unknown>));
          const regras = regrasRes.data
            ? rowToRegras(regrasRes.data as Record<string, unknown>)
            : REGRAS_DEFAULT;
          _syncCommercial(faixas, condicoes, regras);
          set({ faixas, condicoes, regras, hidratado: true });
        } catch (err) {
          console.error("[cartilhasStore] hydrate falhou:", err);
          set({ hidratado: true });
        }
      },

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
        const novoId = f.id || nextId(state.faixas);
        const next: Faixa = {
          ...f,
          id: novoId,
          totalComPix: f.descontoCelebra + (f.bonusPixAplicavel === false ? 0 : f.bonusPix),
          ativa: f.ativa ?? true,
          ordem: f.ordem ?? (existing?.ordem ?? state.faixas.length + 1),
        };
        const newFaixas =
          idx >= 0
            ? state.faixas.map((x, i) => (i === idx ? next : x))
            : [...state.faixas, next];
        const entry = makeAudit(
          meta,
          "faixa",
          next.id,
          next.nome,
          existing ? "editado" : "criado",
          existing
            ? diffObj(existing as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>)
            : undefined,
        );
        set({ faixas: newFaixas, audit: [entry, ...state.audit].slice(0, 100) });
        _syncCommercial(newFaixas, state.condicoes, state.regras);
        supabase
          .from("faixas")
          .upsert(faixaToRow(next, meta.usuarioNome) as never, { onConflict: "id" })
          .then(({ error }) => {
            if (error) console.error("[cartilhasStore] upsertFaixa banco falhou:", error);
            else logAudit(entry);
          });
        return { ok: true };
      },

      removeFaixa: (id, meta) => {
        const state = get();
        const f = state.faixas.find((x) => x.id === id);
        if (!f) return;
        const entry = makeAudit(meta, "faixa", id, f.nome, "desativado");
        const newFaixas = state.faixas.map((x) => (x.id === id ? { ...x, ativa: false } : x));
        set({ faixas: newFaixas, audit: [entry, ...state.audit].slice(0, 100) });
        _syncCommercial(newFaixas, state.condicoes, state.regras);
        supabase
          .from("faixas")
          .update({ ativa: false, atualizado_por: meta.usuarioNome } as never)
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("[cartilhasStore] removeFaixa banco falhou:", error);
            else logAudit(entry);
          });
      },

      toggleFaixaAtiva: (id, meta) => {
        const state = get();
        const f = state.faixas.find((x) => x.id === id);
        if (!f) return;
        const ativa = !(f.ativa ?? true);
        const entry = makeAudit(meta, "faixa", id, f.nome, ativa ? "reativado" : "desativado");
        const newFaixas = state.faixas.map((x) => (x.id === id ? { ...x, ativa } : x));
        set({ faixas: newFaixas, audit: [entry, ...state.audit].slice(0, 100) });
        _syncCommercial(newFaixas, state.condicoes, state.regras);
        supabase
          .from("faixas")
          .update({ ativa, atualizado_por: meta.usuarioNome } as never)
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("[cartilhasStore] toggleFaixaAtiva banco falhou:", error);
            else logAudit(entry);
          });
      },

      reorderFaixas: (orderedIds, meta) => {
        const state = get();
        const newFaixas = state.faixas.map((f) => {
          const idx = orderedIds.indexOf(f.id);
          return idx >= 0 ? { ...f, ordem: idx + 1 } : f;
        });
        const entry = makeAudit(meta, "faixa", "ordem", "Reordenação de faixas", "reordenado");
        set({ faixas: newFaixas, audit: [entry, ...state.audit].slice(0, 100) });
        _syncCommercial(newFaixas, state.condicoes, state.regras);
        (async () => {
          try {
            for (const id of orderedIds) {
              await supabase
                .from("faixas")
                .update({ ordem: orderedIds.indexOf(id) + 1 } as never)
                .eq("id", id);
            }
            logAudit(entry);
          } catch (err) {
            console.error("[cartilhasStore] reorderFaixas banco falhou:", err);
          }
        })();
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
        const novoId = c.id || nextId(state.condicoes);
        const next: CondicaoPagamento = {
          ...c,
          id: novoId,
          ativa: c.ativa ?? true,
          exibirParaVendedor: c.exibirParaVendedor ?? true,
          ordem: c.ordem ?? (existing?.ordem ?? state.condicoes.length + 1),
          criadoPor: existing?.criadoPor ?? meta.usuarioNome,
        };
        const newCondicoes =
          idx >= 0
            ? state.condicoes.map((x, i) => (i === idx ? next : x))
            : [...state.condicoes, next];
        const entry = makeAudit(
          meta,
          "condicao",
          next.id,
          next.descricao,
          existing ? "editado" : "criado",
          existing
            ? diffObj(existing as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>)
            : undefined,
        );
        set({ condicoes: newCondicoes, audit: [entry, ...state.audit].slice(0, 100) });
        _syncCommercial(state.faixas, newCondicoes, state.regras);
        supabase
          .from("condicoes_pagamento")
          .upsert(condicaoToRow(next) as never, { onConflict: "id" })
          .then(({ error }) => {
            if (error) console.error("[cartilhasStore] upsertCondicao banco falhou:", error);
            else logAudit(entry);
          });
        return { ok: true };
      },

      toggleCondicaoAtiva: (id, meta) => {
        const state = get();
        const c = state.condicoes.find((x) => x.id === id);
        if (!c) return;
        const ativa = !(c.ativa ?? true);
        const entry = makeAudit(meta, "condicao", id, c.descricao, ativa ? "reativado" : "desativado");
        const newCondicoes = state.condicoes.map((x) => (x.id === id ? { ...x, ativa } : x));
        set({ condicoes: newCondicoes, audit: [entry, ...state.audit].slice(0, 100) });
        _syncCommercial(state.faixas, newCondicoes, state.regras);
        supabase
          .from("condicoes_pagamento")
          .update({ ativa } as never)
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("[cartilhasStore] toggleCondicaoAtiva banco falhou:", error);
            else logAudit(entry);
          });
      },

      reorderCondicoes: (orderedIds, meta) => {
        const state = get();
        const newCondicoes = state.condicoes.map((c) => {
          const idx = orderedIds.indexOf(c.id);
          return idx >= 0 ? { ...c, ordem: idx + 1 } : c;
        });
        const entry = makeAudit(meta, "condicao", "ordem", "Reordenação de condições", "reordenado");
        set({ condicoes: newCondicoes, audit: [entry, ...state.audit].slice(0, 100) });
        _syncCommercial(state.faixas, newCondicoes, state.regras);
        (async () => {
          try {
            for (const id of orderedIds) {
              await supabase
                .from("condicoes_pagamento")
                .update({ ordem: orderedIds.indexOf(id) + 1 } as never)
                .eq("id", id);
            }
            logAudit(entry);
          } catch (err) {
            console.error("[cartilhasStore] reorderCondicoes banco falhou:", err);
          }
        })();
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
        set({ regras: next, audit: [entry, ...state.audit].slice(0, 100) });
        _syncCommercial(state.faixas, state.condicoes, next);
        supabase
          .from("regras_gerais")
          .upsert(regrasToRow(next, meta.usuarioNome) as never, { onConflict: "id" })
          .then(({ error }) => {
            if (error) console.error("[cartilhasStore] updateRegras banco falhou:", error);
            else logAudit(entry);
          });
      },

      resetToDefault: () => {
        set({
          faixas: FAIXAS_DEFAULT,
          condicoes: CONDICOES_DEFAULT,
          regras: REGRAS_DEFAULT,
        });
        _syncCommercial(FAIXAS_DEFAULT, CONDICOES_DEFAULT, REGRAS_DEFAULT);
      },
    }),
    {
      name: "fetely-cartilhas",
      storage: createJSONStorage(createSafeStorage),
      version: 2,
      partialize: (state) => ({
        faixas: state.faixas,
        condicoes: state.condicoes,
        regras: state.regras,
      }) as Partial<CartilhasState>,
      onRehydrateStorage: () => (state) => {
        if (state) {
          _syncCommercial(state.faixas, state.condicoes, state.regras);
        }
      },
    },
  ),
);

// Sync inicial + subscribe pra manter commercial.ts globals em dia
if (typeof window !== "undefined") {
  const s = useCartilhas.getState();
  _syncCommercial(s.faixas, s.condicoes, s.regras);
  useCartilhas.subscribe((s) => _syncCommercial(s.faixas, s.condicoes, s.regras));
}
