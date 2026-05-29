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
    valorMin: 2500,
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
  { id: 1, descricao: "PIX antecipado", valorMinimo: 2500, tipo: "pix", numeroParcelas: 1, diasParcelas: [0], temBonusPix: true, destaque: true, ativa: true, exibirParaVendedor: true, ordem: 1 },
  { id: 2, descricao: "Boleto à vista", valorMinimo: 2500, tipo: "boleto", numeroParcelas: 1, diasParcelas: [0], ativa: true, exibirParaVendedor: true, ordem: 2 },
  { id: 3, descricao: "Boleto 0/30 (2x)", valorMinimo: 2500, tipo: "boleto", numeroParcelas: 2, diasParcelas: [0, 30], ativa: true, exibirParaVendedor: true, ordem: 3 },
  { id: 4, descricao: "Boleto 0/30/60 (3x)", valorMinimo: 5000, tipo: "boleto", numeroParcelas: 3, diasParcelas: [0, 30, 60], ativa: true, exibirParaVendedor: true, ordem: 4 },
  { id: 5, descricao: "Boleto 15/30/45 (3x)", valorMinimo: 5000, tipo: "boleto", numeroParcelas: 3, diasParcelas: [15, 30, 45], ativa: true, exibirParaVendedor: true, ordem: 5 },
  { id: 6, descricao: "Boleto 0/30/60/90 (4x)", valorMinimo: 8000, tipo: "boleto", numeroParcelas: 4, diasParcelas: [0, 30, 60, 90], ativa: true, exibirParaVendedor: true, ordem: 6 },
  { id: 7, descricao: "Boleto 0/30/60/90/120 (5x)", valorMinimo: 12000, tipo: "boleto", numeroParcelas: 5, diasParcelas: [0, 30, 60, 90, 120], ativa: true, exibirParaVendedor: true, ordem: 7 },
  { id: 8, descricao: "Cartão à vista", valorMinimo: 2500, tipo: "cartao", numeroParcelas: 1, diasParcelas: [0], semJuros: true, ativa: true, exibirParaVendedor: true, ordem: 8 },
  { id: 9, descricao: "Cartão 2x sem juros", valorMinimo: 2500, tipo: "cartao", numeroParcelas: 2, diasParcelas: [0, 30], semJuros: true, ativa: true, exibirParaVendedor: true, ordem: 9 },
  { id: 10, descricao: "Cartão 3x sem juros (0/30/60)", valorMinimo: 2500, tipo: "cartao", numeroParcelas: 3, diasParcelas: [0, 30, 60], semJuros: true, ativa: true, exibirParaVendedor: true, ordem: 10 },
  { id: 11, descricao: "Cartão 4x sem juros (0/30/60/90)", valorMinimo: 8000, tipo: "cartao", numeroParcelas: 4, diasParcelas: [0, 30, 60, 90], semJuros: true, ativa: true, exibirParaVendedor: true, ordem: 11 },
  { id: 12, descricao: "Cartão 5x sem juros (0/30/60/90/120)", valorMinimo: 12000, tipo: "cartao", numeroParcelas: 5, diasParcelas: [0, 30, 60, 90, 120], semJuros: true, ativa: true, exibirParaVendedor: true, ordem: 12 },
  { id: 13, descricao: "Boleto 0/15 (à vista + 1)", valorMinimo: 2500, tipo: "boleto", numeroParcelas: 2, diasParcelas: [0, 15], ativa: true, exibirParaVendedor: true, ordem: 13 },
];

export const REGRAS_DEFAULT: RegrasGerais = {
  pedidoMinimo: 2500,
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
}

export function calcularPedido(args: {
  bruto: number;
  usarReservada?: boolean;
  descontoMasterPct?: number;
  condicao?: CondicaoPagamento | null;
}): CalculoPedido {
  const { bruto, usarReservada = false, descontoMasterPct = 0, condicao = null } = args;
  const faixa = detectarFaixa(bruto, usarReservada);

  if (!faixa) {
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
    };
  }

  const descontoCelebraValor = bruto * (faixa.descontoCelebra / 100);
  const aposCelebra = bruto - descontoCelebraValor;

  const masterPct = Math.max(
    0,
    Math.min(REGRAS_ATUAIS.descontoMasterMax, descontoMasterPct),
  );
  const descontoMasterValor = aposCelebra * (masterPct / 100);
  const subtotalAposDescontos = aposCelebra - descontoMasterValor;

  const aplicouPix =
    !!condicao &&
    condicao.tipo === "pix" &&
    faixa.bonusPix > 0 &&
    faixa.bonusPixAplicavel !== false;
  const bonusPixValor = aplicouPix
    ? subtotalAposDescontos * (faixa.bonusPix / 100)
    : 0;

  const total = subtotalAposDescontos - bonusPixValor;
  return {
    bruto,
    faixa,
    descontoCelebraValor,
    descontoMasterValor,
    subtotalAposDescontos,
    bonusPixValor,
    total,
    totalSemPix: subtotalAposDescontos,
    aplicouPix,
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

export const SENHA_MASTER_DEFAULT = "fetely2025";

export const JUSTIFICATIVAS_NEGOCIACAO = [
  "Feira / evento presencial",
  "Cliente estratégico",
  "Liquidação de estoque",
  "Reativação de cliente",
  "Outro",
] as const;
