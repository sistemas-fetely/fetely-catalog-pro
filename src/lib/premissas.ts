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

const CAMPO_LABEL: Record<string, string> = {
  temDescontoHomologado: "Desconto homologado",
  descontoHomologadoPercent: "Desconto %",
  descontoHomologadoSobrePos: "Desconto acumula sobre faixa",
  descontoHomologadoObs: "Obs. desconto",
  bonusPixPersonalizado: "Bônus PIX personalizado",
  bonusPixPercent: "Bônus PIX %",
  freteFixo: "Frete fixo",
  freteTipo: "Tipo frete",
  freteObs: "Obs. frete",
  temCondicaoPreferencial: "Condição preferencial",
  condicoesPermitidas: "Condições permitidas",
  condicaoPreferencialId: "Cond. preferencial",
  temFaixaFixa: "Faixa fixa",
  faixaFixaId: "Faixa fixa ID",
  temPedidoMinimoPersonalizado: "Pedido mínimo personalizado",
  pedidoMinimoValor: "Pedido mínimo R$",
  vigenciaInicio: "Vigência início",
  vigenciaFim: "Vigência fim",
  premissasAtivas: "Premissas ativas",
};

const CAMPOS_IGNORE = new Set(["atualizadoPor", "atualizadoEm", "historico", "aprovadoPor", "aprovadoEm"]);

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  return String(v);
}

/** Compara duas premissas e devolve a lista de campos alterados. */
export function diffPremissas(
  antes: PremissasComerciais | null | undefined,
  depois: PremissasComerciais | null | undefined,
): { campo: string; anterior: string; novo: string }[] {
  if (!depois) return [];
  const a = (antes ?? {}) as Record<string, unknown>;
  const b = depois as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: { campo: string; anterior: string; novo: string }[] = [];
  for (const k of keys) {
    if (CAMPOS_IGNORE.has(k)) continue;
    const va = a[k];
    const vb = b[k];
    const eq = Array.isArray(va) && Array.isArray(vb)
      ? va.length === vb.length && va.every((x, i) => x === vb[i])
      : va === vb;
    if (!eq) {
      out.push({ campo: CAMPO_LABEL[k] ?? k, anterior: fmt(va), novo: fmt(vb) });
    }
  }
  return out;
}
