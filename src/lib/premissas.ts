// V13 — Engine de aplicação das Premissas Comerciais do cliente.
// Encapsula a lógica de "premissa vigente → faixa → regras gerais".

import type { Cliente, PremissasComerciais } from "@/types/cliente";

export type StatusPremissa = "ativa" | "expirando" | "expirada" | "inativa" | "sem";

/** Confere se hoje está dentro de [vigenciaInicio, vigenciaFim] */
export function isPremissaVigente(inicioISO: string, fimISO: string | null): boolean {
  const hoje = new Date();
  const inicio = new Date(inicioISO);
  if (isNaN(inicio.getTime()) || hoje < inicio) return false;
  if (fimISO) {
    const fim = new Date(fimISO);
    if (isNaN(fim.getTime())) return true;
    // fim inclusivo (end of day)
    fim.setHours(23, 59, 59, 999);
    if (hoje > fim) return false;
  }
  return true;
}

/** Quantos dias faltam até vigenciaFim (negativo = já expirou). null = sem expiração */
export function diasParaExpirar(fimISO: string | null): number | null {
  if (!fimISO) return null;
  const fim = new Date(fimISO);
  if (isNaN(fim.getTime())) return null;
  fim.setHours(23, 59, 59, 999);
  const diff = fim.getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function statusPremissas(c: Cliente | null | undefined): StatusPremissa {
  const p = c?.premissasComerciais;
  if (!p) return "sem";
  if (!p.premissasAtivas) return "inativa";
  if (!isPremissaVigente(p.vigenciaInicio, p.vigenciaFim)) return "expirada";
  const d = diasParaExpirar(p.vigenciaFim);
  if (d !== null && d <= 30) return "expirando";
  return "ativa";
}

/** Premissas efetivas — só retorna se ATIVAS E VIGENTES */
export function getPremissasVigentes(c: Cliente | null | undefined): PremissasComerciais | null {
  if (!c?.premissasComerciais) return null;
  const p = c.premissasComerciais;
  if (!p.premissasAtivas) return null;
  if (!isPremissaVigente(p.vigenciaInicio, p.vigenciaFim)) return null;
  return p;
}
