import { safeLocalStorage } from "@/lib/safeStorage";
import { supabase } from "@/integrations/supabase/client";
// V20 — Tabela de frete FOB por UF.
// Fonte oficial: tabela public.frete_uf + regras_gerais.frete_fallback_percent (banco).
// O localStorage funciona como cache local para o cálculo síncrono do carrinho;
// syncFreteFromDb() mantém o cache alinhado (e sobe customizações locais antigas
// uma única vez). Escritas no admin são write-through (local + banco).
// Calculadora de frete consulta esta tabela apenas quando o frete é FOB —
// CIF (faixa ou premissa) e negociação master continuam com prioridade.

export interface FreteUF {
  uf: string; // sigla maiúscula
  percentual: number; // % sobre subtotal após descontos
  ativo: boolean;
  vigenciaInicio?: string | null;
  vigenciaFim?: string | null;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

export const UFS_BR = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
] as const;

export const FRETE_UF_PADRAO: FreteUF[] = [
  { uf: "SP", percentual: 7, ativo: true },
  { uf: "RJ", percentual: 7, ativo: true },
  { uf: "PR", percentual: 10, ativo: true },
  { uf: "RS", percentual: 10, ativo: true },
  { uf: "SC", percentual: 5, ativo: true },
  { uf: "DF", percentual: 9, ativo: true },
  { uf: "MT", percentual: 10, ativo: true },
  { uf: "AM", percentual: 21, ativo: true },
  { uf: "TO", percentual: 19, ativo: true },
  { uf: "AP", percentual: 19, ativo: true },
  { uf: "PE", percentual: 26, ativo: true },
  { uf: "PB", percentual: 26, ativo: true },
  { uf: "CE", percentual: 26, ativo: true },
  { uf: "MA", percentual: 26, ativo: true },
  { uf: "RN", percentual: 26, ativo: true },
  { uf: "AL", percentual: 26, ativo: true },
];

export const FRETE_FALLBACK_PERCENT_DEFAULT = 5;

const KEY_TABELA = "fetely_fretes_uf";
const KEY_FALLBACK = "fetely_frete_fallback_percent";
const KEY_INIT = "fetely_fretes_uf_inicializado";
const KEY_MIGRADA = "fetely_fretes_uf_migrada_db";

// Tabela nova (criada depois dos types gerados) — cast para any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function inicializar(): void {
  if (!hasStorage()) return;
  if (!localStorage.getItem(KEY_INIT)) {
    safeLocalStorage.setItem(KEY_TABELA, JSON.stringify(FRETE_UF_PADRAO));
    safeLocalStorage.setItem(KEY_FALLBACK, JSON.stringify(FRETE_FALLBACK_PERCENT_DEFAULT));
    safeLocalStorage.setItem(KEY_INIT, "true");
  }
}

export function getFretesUF(): FreteUF[] {
  if (!hasStorage()) return FRETE_UF_PADRAO;
  inicializar();
  try {
    const raw = localStorage.getItem(KEY_TABELA);
    if (!raw) return FRETE_UF_PADRAO;
    const parsed = JSON.parse(raw) as FreteUF[];
    return Array.isArray(parsed) ? parsed : FRETE_UF_PADRAO;
  } catch {
    return FRETE_UF_PADRAO;
  }
}

export function setFretesUF(lista: FreteUF[]): void {
  if (!hasStorage()) return;
  safeLocalStorage.setItem(KEY_TABELA, JSON.stringify(lista));
}

export function getFreteFallbackPercent(): number {
  if (!hasStorage()) return FRETE_FALLBACK_PERCENT_DEFAULT;
  inicializar();
  try {
    const raw = localStorage.getItem(KEY_FALLBACK);
    if (!raw) return FRETE_FALLBACK_PERCENT_DEFAULT;
    const n = Number(JSON.parse(raw));
    return Number.isFinite(n) ? n : FRETE_FALLBACK_PERCENT_DEFAULT;
  } catch {
    return FRETE_FALLBACK_PERCENT_DEFAULT;
  }
}

export function setFreteFallbackPercent(n: number): void {
  if (!hasStorage()) return;
  safeLocalStorage.setItem(KEY_FALLBACK, JSON.stringify(n));
  // Write-through para o banco (fonte oficial) — regras_gerais tem 1 linha.
  void db
    .from("regras_gerais")
    .update({ frete_fallback_percent: n })
    .gt("id", 0)
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.warn("[freteUf] falha ao salvar fallback no banco:", error.message);
    });
}

export function upsertFreteUF(entry: FreteUF, usuario?: string): void {
  const lista = getFretesUF();
  const uf = entry.uf.toUpperCase();
  const idx = lista.findIndex((f) => f.uf.toUpperCase() === uf);
  const next: FreteUF = {
    ...entry,
    uf,
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: usuario,
  };
  if (idx >= 0) lista[idx] = next;
  else lista.push(next);
  setFretesUF(lista);
  // Write-through para o banco
  void db
    .from("frete_uf")
    .upsert({
      uf,
      percentual: next.percentual,
      ativo: next.ativo,
      atualizado_em: next.atualizadoEm,
      atualizado_por: usuario ?? null,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.warn("[freteUf] falha ao salvar UF no banco:", error.message);
    });
}

export function removeFreteUF(uf: string): void {
  const norm = uf.toUpperCase();
  const lista = getFretesUF().filter((f) => f.uf.toUpperCase() !== norm);
  setFretesUF(lista);
  void db
    .from("frete_uf")
    .delete()
    .eq("uf", norm)
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.warn("[freteUf] falha ao remover UF no banco:", error.message);
    });
}

// ------------------------------------------------------ Sync com o banco

function assinatura(lista: FreteUF[]): string {
  return lista
    .map((f) => `${f.uf.toUpperCase()}|${f.percentual}|${f.ativo}`)
    .sort()
    .join(";");
}

function localTemCustomizacao(): boolean {
  return (
    assinatura(getFretesUF()) !== assinatura(FRETE_UF_PADRAO) ||
    getFreteFallbackPercent() !== FRETE_FALLBACK_PERCENT_DEFAULT
  );
}

/**
 * Alinha o cache local com o banco (fonte oficial).
 * - Se o navegador tem customizações antigas que ainda não foram para o banco,
 *   sobe elas primeiro (uma única vez) para não perder a tabela do admin.
 * - Depois baixa o estado oficial do banco para o cache local.
 * Silencioso em caso de erro (offline/RLS): mantém o cache local.
 */
export async function syncFreteFromDb(usuario?: string): Promise<void> {
  if (!hasStorage()) return;
  inicializar();
  try {
    if (localTemCustomizacao() && !localStorage.getItem(KEY_MIGRADA)) {
      const { error } = await db.from("frete_uf").upsert(
        getFretesUF().map((f) => ({
          uf: f.uf.toUpperCase(),
          percentual: f.percentual,
          ativo: f.ativo,
          atualizado_em: f.atualizadoEm ?? new Date().toISOString(),
          atualizado_por: f.atualizadoPor ?? usuario ?? "migracao-local",
        })),
      );
      if (error) return; // não sobrescreve o local antes de conseguir subir
      await db
        .from("regras_gerais")
        .update({ frete_fallback_percent: getFreteFallbackPercent() })
        .gt("id", 0);
    }
    safeLocalStorage.setItem(KEY_MIGRADA, "true");

    const { data: rows } = await db
      .from("frete_uf")
      .select("uf,percentual,ativo,atualizado_em,atualizado_por")
      .order("uf", { ascending: true });
    if (Array.isArray(rows) && rows.length > 0) {
      const lista: FreteUF[] = rows.map(
        (r: {
          uf: string;
          percentual: number;
          ativo: boolean;
          atualizado_em: string;
          atualizado_por: string | null;
        }) => ({
          uf: r.uf,
          percentual: Number(r.percentual),
          ativo: r.ativo,
          atualizadoEm: r.atualizado_em,
          atualizadoPor: r.atualizado_por ?? undefined,
        }),
      );
      safeLocalStorage.setItem(KEY_TABELA, JSON.stringify(lista));
    }

    const { data: rg } = await db
      .from("regras_gerais")
      .select("frete_fallback_percent")
      .limit(1)
      .maybeSingle();
    if (rg?.frete_fallback_percent != null) {
      safeLocalStorage.setItem(KEY_FALLBACK, JSON.stringify(Number(rg.frete_fallback_percent)));
    }
  } catch {
    /* offline ou sem permissão: segue com o cache local */
  }
}

export interface FretePercentResult {
  percentual: number;
  origemFallback: boolean;
}

export function getFretePercent(uf: string | undefined | null): FretePercentResult {
  const fallback = getFreteFallbackPercent();
  if (!uf) return { percentual: fallback, origemFallback: true };
  const norm = uf.toUpperCase();
  const config = getFretesUF().find((f) => f.uf.toUpperCase() === norm && f.ativo);
  if (config) return { percentual: config.percentual, origemFallback: false };
  return { percentual: fallback, origemFallback: true };
}

export function ufsSemTabela(): string[] {
  const cadastradas = new Set(getFretesUF().map((f) => f.uf.toUpperCase()));
  return UFS_BR.filter((u) => !cadastradas.has(u));
}
