import { safeLocalStorage } from "@/lib/safeStorage";
// V20 — Tabela de frete FOB por UF.
// Armazenamento em localStorage com seed automático na primeira leitura.
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
}

export function removeFreteUF(uf: string): void {
  const lista = getFretesUF().filter((f) => f.uf.toUpperCase() !== uf.toUpperCase());
  setFretesUF(lista);
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
