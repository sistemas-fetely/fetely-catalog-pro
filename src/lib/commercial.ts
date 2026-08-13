// Regras comerciais Fetély — faixas, condições de pagamento, cálculo de pedido.
// V10: valores agora são *vivos* — mantidos em sincronia pelo cartilhasStore.

export type FreteTipo = "FOB" | "CIF";

export interface Faixa {
  id: number;
  nome: string;
  valorMin: number;
  valorMax: number; // use Infinity para "sem limite"
  frete: FreteTipo;
  descontoCelebra: number;
  bonusPix: number;
  totalComPix: number;
  cartaoAte: string;
  boletoAte: string;
  prazoMedioBoleto: number;
  condicoesDisponiveis: number[];
  requerSenhaMaster?: boolean;
  bonusPixAplicavel?: boolean;
  cor?: string;
  icone?: string;
  descricao?: string;
  ativa?: boolean;
  ordem?: number;
  freteObservacao?: string;
  criadoEm?: string;
  atualizadoEm?: string;
  criadoPor?: string;
  atualizadoPor?: string;
}

export interface CondicaoPagamento {
  id: number;
  descricao: string;
  valorMinimo: number;
  tipo: "pix" | "boleto" | "cartao";
  numeroParcelas?: number;
  diasParcelas?: number[];
  semJuros?: boolean;
  temBonusPix?: boolean;
  ativa?: boolean;
  exibirParaVendedor?: boolean;
  destaque?: boolean;
  ordem?: number;
  criadoEm?: string;
  atualizadoEm?: string;
  criadoPor?: string;
}

export interface RegrasGerais {
  pedidoMinimo: number;
  descontoMasterMax: number;
  tentativasSenhaMaster: number;
  bloqueioSenhaMasterMinutos: number;
  provisaoExpirarDias: number;
  faixaReservadaNome: string;
  bonusPixPadrao: number;
  atualizadoEm?: string;
  atualizadoPor?: string;
}


export const FAIXAS_DEFAULT: Faixa[] = [
  {
    id: 1,
    nome: "Convidado",
    valorMin: 1500,
    valorMax: 4999.99,
    frete: "FOB",
    descontoCelebra: 5,
    bonusPix: 2.5,
    totalComPix: 7.5,
    cartaoAte: "3x (0/30/60)",
    boletoAte: "2x (0/30)",
    prazoMedioBoleto: 15,
    condicoesDisponiveis: [1, 2, 3, 8, 9, 10, 13],
    cor: "#94A3B8",
    bonusPixAplicavel: true,
    ativa: true,
    ordem: 1,
  },
  {
    id: 2,
    nome: "Anfitrião",
    valorMin: 5000,
    valorMax: 7999.99,
    frete: "CIF",
    descontoCelebra: 10,
    bonusPix: 2.5,
    totalComPix: 12.5,
    cartaoAte: "3x (0/30/60)",
    boletoAte: "3x (0/30/60 ou 15/30/45)",
    prazoMedioBoleto: 30,
    condicoesDisponiveis: [1, 2, 3, 4, 5, 8, 9, 10, 13],
    cor: "#C9A84C",
    icone: "✨",
    bonusPixAplicavel: true,
    ativa: true,
    ordem: 2,
  },
  {
    id: 3,
    nome: "Celebrante",
    valorMin: 8000,
    valorMax: 11999.99,
    frete: "CIF",
    descontoCelebra: 15,
    bonusPix: 2.5,
    totalComPix: 17.5,
    cartaoAte: "4x (0/30/60/90)",
    boletoAte: "4x (0/30/60/90)",
    prazoMedioBoleto: 45,
    condicoesDisponiveis: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 13],
    cor: "#D4A574",
    bonusPixAplicavel: true,
    ativa: true,
    ordem: 3,
  },
  {
    id: 4,
    nome: "Cerimônia",
    valorMin: 12000,
    valorMax: Infinity,
    frete: "CIF",
    descontoCelebra: 20,
    bonusPix: 2.5,
    totalComPix: 22.5,
    cartaoAte: "4x (0/30/60/90)",
    boletoAte: "5x (0/30/60/90/120)",
    prazoMedioBoleto: 60,
    condicoesDisponiveis: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    cor: "#E8C07A",
    bonusPixAplicavel: true,
    ativa: true,
    ordem: 4,
  },
  {
    id: 5,
    nome: "Reservada",
    valorMin: 12000,
    valorMax: Infinity,
    frete: "CIF",
    descontoCelebra: 25,
    bonusPix: 0,
    totalComPix: 25,
    cartaoAte: "4x (0/30/60/90)",
    boletoAte: "5x (0/30/60/90/120)",
    prazoMedioBoleto: 60,
    condicoesDisponiveis: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    requerSenhaMaster: true,
    bonusPixAplicavel: false,
    cor: "#9B72CF",
    icone: "🔐",
    ativa: true,
    ordem: 5,
  },
];

export const CONDICOES_DEFAULT: CondicaoPagamento[] = [
  { id: 1, descricao: "PIX antecipado", valorMinimo: 1500, tipo: "pix", numeroParcelas: 1, diasParcelas: [0], temBonusPix: true, destaque: true, ativa: true, exibirParaVendedor: true, ordem: 1 },
  { id: 2, descricao: "Boleto à vista", valorMinimo: 1500, tipo: "boleto", numeroParcelas: 1, diasParcelas: [0], ativa: true, exibirParaVendedor: true, ordem: 2 },
  { id: 3, descricao: "Boleto 0/30 (2x)", valorMinimo: 1500, tipo: "boleto", numeroParcelas: 2, diasParcelas: [0, 30], ativa: true, exibirParaVendedor: true, ordem: 3 },
  { id: 4, descricao: "Boleto 0/30/60 (3x)", valorMinimo: 5000, tipo: "boleto", numeroParcelas: 3, diasParcelas: [0, 30, 60], ativa: true, exibirParaVendedor: true, ordem: 4 },
  { id: 5, descricao: "Boleto 15/30/45 (3x)", valorMinimo: 5000, tipo: "boleto", numeroParcelas: 3, diasParcelas: [15, 30, 45], ativa: true, exibirParaVendedor: true, ordem: 5 },
  { id: 6, descricao: "Boleto 0/30/60/90 (4x)", valorMinimo: 8000, tipo: "boleto", numeroParcelas: 4, diasParcelas: [0, 30, 60, 90], ativa: true, exibirParaVendedor: true, ordem: 6 },
  { id: 7, descricao: "Boleto 0/30/60/90/120 (5x)", valorMinimo: 12000, tipo: "boleto", numeroParcelas: 5, diasParcelas: [0, 30, 60, 90, 120], ativa: true, exibirParaVendedor: true, ordem: 7 },
  { id: 8, descricao: "Cartão à vista", valorMinimo: 1500, tipo: "cartao", numeroParcelas: 1, diasParcelas: [0], semJuros: true, ativa: true, exibirParaVendedor: true, ordem: 8 },
  { id: 9, descricao: "Cartão 2x sem juros", valorMinimo: 1500, tipo: "cartao", numeroParcelas: 2, diasParcelas: [0, 30], semJuros: true, ativa: true, exibirParaVendedor: true, ordem: 9 },
  { id: 10, descricao: "Cartão 3x sem juros (0/30/60)", valorMinimo: 1500, tipo: "cartao", numeroParcelas: 3, diasParcelas: [0, 30, 60], semJuros: true, ativa: true, exibirParaVendedor: true, ordem: 10 },
  { id: 11, descricao: "Cartão 4x sem juros (0/30/60/90)", valorMinimo: 8000, tipo: "cartao", numeroParcelas: 4, diasParcelas: [0, 30, 60, 90], semJuros: true, ativa: true, exibirParaVendedor: true, ordem: 11 },
  { id: 12, descricao: "Cartão 5x sem juros (0/30/60/90/120)", valorMinimo: 12000, tipo: "cartao", numeroParcelas: 5, diasParcelas: [0, 30, 60, 90, 120], semJuros: true, ativa: true, exibirParaVendedor: true, ordem: 12 },
  { id: 13, descricao: "Boleto 0/15 (à vista + 1)", valorMinimo: 1500, tipo: "boleto", numeroParcelas: 2, diasParcelas: [0, 15], ativa: true, exibirParaVendedor: true, ordem: 13 },
  { id: 14, descricao: "Boleto 30/60/90/120 (4x)", valorMinimo: 8000, tipo: "boleto", numeroParcelas: 4, diasParcelas: [30, 60, 90, 120], ativa: true, exibirParaVendedor: true, ordem: 14 },
];

export const REGRAS_DEFAULT: RegrasGerais = {
  pedidoMinimo: 1500,
  descontoMasterMax: 15,
  tentativasSenhaMaster: 3,
  bloqueioSenhaMasterMinutos: 30,
  provisaoExpirarDias: 90,
  faixaReservadaNome: "Reservada",
  bonusPixPadrao: 2.5,
};


// === LIVE BINDINGS — mantidos em sincronia pelo cartilhasStore via _syncCommercial() ===
export const FAIXAS: Faixa[] = [...FAIXAS_DEFAULT];
export const CONDICOES_PAGAMENTO: CondicaoPagamento[] = [...CONDICOES_DEFAULT];
export let REGRAS_ATUAIS: RegrasGerais = { ...REGRAS_DEFAULT };
export let PEDIDO_MINIMO = REGRAS_ATUAIS.pedidoMinimo;
export let DESCONTO_MASTER_MAX = REGRAS_ATUAIS.descontoMasterMax;

/**
 * Replace in-place os arrays/regras vigentes. Chamado pelo cartilhasStore.
 * Mantém referência dos arrays — todos os consumidores existentes continuam funcionando.
 */
export function _syncCommercial(
  faixas: Faixa[],
  condicoes: CondicaoPagamento[],
  regras: RegrasGerais,
): void {
  const fAtivas = faixas
    .filter((f) => f.ativa !== false)
    .sort((a, b) => (a.ordem ?? a.id) - (b.ordem ?? b.id));
  FAIXAS.length = 0;
  FAIXAS.push(...fAtivas);

  const cAtivas = condicoes
    .filter((c) => c.ativa !== false && c.exibirParaVendedor !== false)
    .sort((a, b) => (a.ordem ?? a.id) - (b.ordem ?? b.id));
  CONDICOES_PAGAMENTO.length = 0;
  CONDICOES_PAGAMENTO.push(...cAtivas);

  REGRAS_ATUAIS = { ...regras };
  PEDIDO_MINIMO = regras.pedidoMinimo;
  DESCONTO_MASTER_MAX = regras.descontoMasterMax;
}

export function detectarFaixa(totalBruto: number, usarReservada = false): Faixa | null {
  if (totalBruto < REGRAS_ATUAIS.pedidoMinimo) return null;
  const sorted = [...FAIXAS].sort((a, b) => b.valorMin - a.valorMin);
  if (usarReservada) {
    const reservada = sorted.find((f) => f.requerSenhaMaster && totalBruto >= f.valorMin);
    if (reservada) return reservada;
  }
  return (
    sorted.find(
      (f) => !f.requerSenhaMaster && totalBruto >= f.valorMin && totalBruto <= f.valorMax,
    ) ?? null
  );
}

export function proximaFaixa(faixaAtual: Faixa | null): Faixa | null {
  const sorted = [...FAIXAS]
    .filter((f) => !f.requerSenhaMaster)
    .sort((a, b) => a.valorMin - b.valorMin);
  if (!faixaAtual) return sorted[0] ?? null;
  return sorted.find((f) => f.valorMin > faixaAtual.valorMin) ?? null;
}

export type FreteOrigem = "negociacao_master" | "premissa_cliente" | "faixa";

export interface CalculoPedido {
  bruto: number;
  faixa: Faixa | null;
  descontoCelebraValor: number;
  descontoMasterValor: number;
  subtotalAposDescontos: number;
  bonusPixValor: number;
  total: number;
  totalSemPix: number;
  aplicouPix: boolean;
  premissasAplicadas?: boolean;
  descontoCelebraPercentEfetivo?: number;
  bonusPixPercentEfetivo?: number;
  freteEfetivo?: "CIF" | "FOB";
  pedidoMinimoEfetivo?: number;
  /** Valor base de frete (percentual × subtotal após descontos) */
  freteBase?: number;
  /** Valor de frete efetivamente cobrado (somado ao total quando FOB) */
  freteValor?: number;
  /** Percentual usado para o cálculo do frete (varia por UF — V20) */
  fretePercent?: number;
  /** true quando frete não é cobrado (CIF ou negociação grátis) */
  freteIsento?: boolean;
  /** true quando a isenção veio da negociação master */
  freteGratisNegociado?: boolean;
  /** V20 — UF usada para consultar a tabela de frete por UF */
  freteUf?: string;
  /** V20 — origem da regra de frete aplicada */
  freteOrigem?: FreteOrigem;
  /** V20 — true quando a UF não estava cadastrada e usou o fallback padrão */
  freteUsouFallback?: boolean;
  /** V23 — modo do ajuste manual de frete na negociação */
  freteAjusteModo?: "percent" | "valor";
  /** V23 — percentual do ajuste manual (pode ser negativo) */
  freteAjustePercent?: number;
  /** V23 — valor do ajuste manual aplicado no frete (+ acréscimo / – decréscimo) */
  freteAjusteValor?: number;
  /** V23 — true quando houve ajuste manual de frete */
  freteAjusteAplicado?: boolean;
  /** V21 — acréscimo por cliente isento de Inscrição Estadual */
  acrescimoIsentoIEValor?: number;
  /** V21 — percentual do acréscimo de isento de IE aplicado (0 quando não aplicado) */
  acrescimoIsentoIEPercent?: number;
  /** V21 — true quando o acréscimo de isento de IE foi aplicado */
  acrescimoIsentoIEAplicado?: boolean;
}

/** V21 — percentual de acréscimo aplicado quando o cliente é isento de Inscrição Estadual */
export const ACRESCIMO_ISENTO_IE_PERCENT = 15;



/** Percentual padrão de frete sobre o subtotal após descontos. Mantido para
 * compatibilidade com cálculos antigos; novos pedidos usam a tabela por UF. */
export const FRETE_PERCENT = 5;

import type { PremissasComerciais } from "@/types/cliente";
import { getFretePercent } from "@/lib/freteUf";

export function calcularPedido(args: {
  bruto: number;
  usarReservada?: boolean;
  descontoMasterPct?: number;
  condicao?: CondicaoPagamento | null;
  premissas?: PremissasComerciais | null;
  /** Negociação master — força frete CIF independente da faixa */
  freteGratisOverride?: boolean;
  /** Negociação master — libera pedido abaixo do mínimo (usa faixa mais baixa) */
  ignorarPedidoMinimo?: boolean;
  /** V20 — UF de destino para cálculo de frete FOB. Opcional: sem UF usa fallback. */
  uf?: string | null;
  /** Quando false, nenhum desconto/bônus é aplicado (venda sem desconto). */
  aplicarDescontos?: boolean;
  /** Controles independentes — sobrepõem `aplicarDescontos` quando informados. */
  aplicarDescontoCelebra?: boolean;
  aplicarDescontoNegociacao?: boolean;
  aplicarBonusPix?: boolean;
  /** V21 — aplica acréscimo por cliente isento de Inscrição Estadual */
  aplicarAcrescimoIsentoIE?: boolean;
  /** V21 — percentual do acréscimo (default 15%) */
  acrescimoIsentoIEPercent?: number;
  /** V23 — ajuste manual do frete na negociação: modo do ajuste */
  freteAjusteModo?: "percent" | "valor";
  /** V23 — quantidade do ajuste (positiva = acréscimo, negativa = decréscimo) */
  freteAjusteQtd?: number;
}): CalculoPedido {
  const {
    bruto,
    usarReservada = false,
    descontoMasterPct = 0,
    condicao = null,
    premissas = null,
    freteGratisOverride = false,
    ignorarPedidoMinimo = false,
    uf = null,
    aplicarDescontos = true,
    aplicarAcrescimoIsentoIE = false,
    acrescimoIsentoIEPercent = ACRESCIMO_ISENTO_IE_PERCENT,
    freteAjusteModo = "percent",

    freteAjusteQtd = 0,
  } = args;
  const usarCelebra = args.aplicarDescontoCelebra ?? aplicarDescontos;
  const usarNegociacao = args.aplicarDescontoNegociacao ?? aplicarDescontos;
  const usarPix = args.aplicarBonusPix ?? aplicarDescontos;




  // 1. FAIXA — premissa pode forçar faixa fixa
  let faixa: Faixa | null;
  if (premissas?.temFaixaFixa && premissas.faixaFixaId != null) {
    faixa =
      FAIXAS.find((f) => f.id === premissas.faixaFixaId) ??
      detectarFaixa(bruto, usarReservada);
  } else {
    faixa = detectarFaixa(bruto, usarReservada);
    if (!faixa && ignorarPedidoMinimo) {
      // Negociação master liberou pedido abaixo do mínimo → usa a faixa
      // não-reservada de menor valor para o cálculo (descontos, frete, pix).
      const menor = [...FAIXAS]
        .filter((f) => !f.requerSenhaMaster)
        .sort((a, b) => a.valorMin - b.valorMin)[0];
      faixa = menor ?? null;
    }
  }

  // pedido mínimo efetivo (pode ser personalizado)
  const pedidoMinimoEfetivo = premissas?.temPedidoMinimoPersonalizado
    ? premissas.pedidoMinimoValor
    : REGRAS_ATUAIS.pedidoMinimo;

  // se sem faixa fixa e bruto abaixo do mínimo efetivo → bloquear,
  // a menos que a negociação master tenha liberado explicitamente.
  const semFaixa =
    !faixa ||
    (!premissas?.temFaixaFixa && !ignorarPedidoMinimo && bruto < pedidoMinimoEfetivo);

  if (semFaixa) {
    return {
      bruto,
      faixa: null,
      descontoCelebraValor: 0,
      descontoMasterValor: 0,
      subtotalAposDescontos: bruto,
      bonusPixValor: 0,
      total: bruto,
      totalSemPix: bruto,
      aplicouPix: false,
      premissasAplicadas: !!premissas,
      descontoCelebraPercentEfetivo: 0,
      bonusPixPercentEfetivo: 0,
      freteEfetivo: undefined,
      pedidoMinimoEfetivo,
    };
  }

  // 2. DESCONTO — homologado substitui ou acumula sobre faixa
  let descontoCelebraPct = faixa!.descontoCelebra;
  if (premissas?.temDescontoHomologado) {
    descontoCelebraPct = premissas.descontoHomologadoSobrePos
      ? faixa!.descontoCelebra + premissas.descontoHomologadoPercent
      : premissas.descontoHomologadoPercent;
  }
  if (!usarCelebra) descontoCelebraPct = 0;
  const descontoCelebraValor = bruto * (descontoCelebraPct / 100);
  const aposCelebra = bruto - descontoCelebraValor;

  const masterPct = usarNegociacao
    ? Math.max(0, Math.min(REGRAS_ATUAIS.descontoMasterMax, descontoMasterPct))
    : 0;
  const descontoMasterValor = aposCelebra * (masterPct / 100);
  const subtotalAposDescontos = aposCelebra - descontoMasterValor;

  // 3. BÔNUS PIX — personalizado sobrepõe faixa
  const bonusPixPct = premissas?.bonusPixPersonalizado
    ? premissas.bonusPixPercent
    : faixa!.bonusPix;
  const aplicouPix =
    usarPix &&
    !!condicao &&
    condicao.tipo === "pix" &&
    bonusPixPct > 0 &&
    faixa!.bonusPixAplicavel !== false;
  const bonusPixValor = aplicouPix
    ? subtotalAposDescontos * (bonusPixPct / 100)
    : 0;


  // 4. FRETE — precedência: negociação master → premissa do cliente → faixa
  let freteOrigem: FreteOrigem;
  let freteEfetivo: "CIF" | "FOB";
  if (freteGratisOverride) {
    freteOrigem = "negociacao_master";
    freteEfetivo = "CIF";
  } else if (premissas?.freteFixo && premissas.freteTipo) {
    freteOrigem = "premissa_cliente";
    freteEfetivo = premissas.freteTipo;
  } else {
    freteOrigem = "faixa";
    freteEfetivo = faixa!.frete;
  }

  // 5. FRETE — V20: percentual vem da tabela por UF quando FOB
  const { percentual: ufPercent, origemFallback: freteUsouFallback } = getFretePercent(uf);
  const fretePercentEfetivo = freteEfetivo === "FOB" ? ufPercent : 0;
  const freteBase =
    freteEfetivo === "FOB" ? Math.round(subtotalAposDescontos * (ufPercent / 100) * 100) / 100 : 0;
  const isentoPorCif = freteEfetivo === "CIF";
  const freteIsento = freteGratisOverride || isentoPorCif;
  const freteAntesAjuste = freteIsento ? 0 : freteBase;

  // 5b. FRETE — V23: ajuste manual (acréscimo/decréscimo) em % ou R$
  const freteAjusteAplicado = !!freteAjusteQtd;
  const freteAjusteValor = freteAjusteAplicado
    ? Math.round(
        (freteAjusteModo === "percent"
          ? freteAntesAjuste * (freteAjusteQtd / 100)
          : freteAjusteQtd) * 100,
      ) / 100
    : 0;
  const freteValor = Math.max(0, Math.round((freteAntesAjuste + freteAjusteValor) * 100) / 100);

  // 6. ACRÉSCIMO ISENTO DE INSCRIÇÃO ESTADUAL — V21
  const acrescimoPct = aplicarAcrescimoIsentoIE ? acrescimoIsentoIEPercent : 0;
  const acrescimoIsentoIEValor = aplicarAcrescimoIsentoIE
    ? Math.round(subtotalAposDescontos * (acrescimoPct / 100) * 100) / 100
    : 0;

  const subtotalComBonus = subtotalAposDescontos - bonusPixValor;
  const total = subtotalComBonus + freteValor + acrescimoIsentoIEValor;
  return {
    bruto,
    faixa,
    descontoCelebraValor,
    descontoMasterValor,
    subtotalAposDescontos,
    bonusPixValor,
    total,
    totalSemPix: subtotalAposDescontos + freteValor + acrescimoIsentoIEValor,
    aplicouPix,
    premissasAplicadas: !!premissas,
    descontoCelebraPercentEfetivo: descontoCelebraPct,
    bonusPixPercentEfetivo: aplicouPix ? bonusPixPct : 0,
    freteEfetivo,
    pedidoMinimoEfetivo,
    freteBase,
    freteValor,
    fretePercent: fretePercentEfetivo,
    freteIsento,
    freteGratisNegociado: freteGratisOverride,
    freteUf: uf ? uf.toUpperCase() : undefined,
    freteOrigem,
    freteUsouFallback: freteEfetivo === "FOB" ? freteUsouFallback : false,
    freteAjusteModo,
    freteAjustePercent: freteAjusteModo === "percent" ? freteAjusteQtd : undefined,
    freteAjusteValor,
    freteAjusteAplicado,
    acrescimoIsentoIEValor,
    acrescimoIsentoIEPercent: acrescimoPct,
    acrescimoIsentoIEAplicado: aplicarAcrescimoIsentoIE,
  };
}


// SHA-256 hash (browser only)
export async function hashSenha(senha: string): Promise<string> {
  const buf = new TextEncoder().encode(senha);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const SENHA_MASTER_DEFAULT = "Hamsa1818";

import type { OrderCommercial } from "@/types";

export function getBonusPixPercent(c: OrderCommercial): number {
  if (c.bonusPixPercent != null && c.bonusPixPercent > 0) return c.bonusPixPercent;
  const base = c.bruto - c.descontoCelebraValor - c.descontoMasterValor;
  if (c.bonusPixValor <= 0 || base <= 0) return 0;
  return Math.round((c.bonusPixValor / base) * 100 * 10) / 10;
}

export function formatPercentBR(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

export const JUSTIFICATIVAS_NEGOCIACAO = [

  "Feira / evento presencial",
  "Cliente estratégico",
  "Liquidação de estoque",
  "Reativação de cliente",
  "Outro",
] as const;

// === PEDIDO BONIFICADO ===
export const CONDICAO_BONIFICADO_ID = 999;
export const CONDICAO_BONIFICADO: CondicaoPagamento = {
  id: CONDICAO_BONIFICADO_ID,
  descricao: "Pedido bonificado",
  valorMinimo: 0,
  tipo: "boleto",
  numeroParcelas: 1,
  diasParcelas: [0],
  semJuros: true,
  ativa: true,
  exibirParaVendedor: true,
  destaque: false,
  ordem: 999,
};
export const MOTIVOS_BONIFICACAO = [
  { id: "amostra", label: "Amostra" },
  { id: "brinde", label: "Brinde" },
  { id: "compensacao", label: "Compensação" },
  { id: "marketing", label: "Marketing" },
  { id: "outro", label: "Outro (especificar)" },
] as const;
export type MotivoBonificacaoId = typeof MOTIVOS_BONIFICACAO[number]["id"];
