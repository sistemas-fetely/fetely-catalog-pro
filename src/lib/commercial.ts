// Regras comerciais Fetély — faixas, condições de pagamento, cálculo de pedido.

export type FreteTipo = "FOB" | "CIF";

export interface Faixa {
  id: number;
  nome: string;
  valorMin: number;
  valorMax: number;
  frete: FreteTipo;
  descontoCelebra: number;
  bonusPix: number;
  totalComPix: number;
  cartaoAte: string;
  boletoAte: string;
  prazoMedioBoleto: number;
  condicoesDisponiveis: number[];
  requerSenhaMaster?: boolean;
}

export interface CondicaoPagamento {
  id: number;
  descricao: string;
  valorMinimo: number;
  tipo: "pix" | "boleto" | "cartao";
}

export const FAIXAS: Faixa[] = [
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
  },
];

export const CONDICOES_PAGAMENTO: CondicaoPagamento[] = [
  { id: 1, descricao: "PIX antecipado", valorMinimo: 2500, tipo: "pix" },
  { id: 2, descricao: "Boleto à vista", valorMinimo: 2500, tipo: "boleto" },
  { id: 3, descricao: "Boleto 0/30 (2x)", valorMinimo: 2500, tipo: "boleto" },
  { id: 4, descricao: "Boleto 0/30/60 (3x)", valorMinimo: 5000, tipo: "boleto" },
  { id: 5, descricao: "Boleto 15/30/45 (3x)", valorMinimo: 5000, tipo: "boleto" },
  { id: 6, descricao: "Boleto 0/30/60/90 (4x)", valorMinimo: 8000, tipo: "boleto" },
  { id: 7, descricao: "Boleto 0/30/60/90/120 (5x)", valorMinimo: 12000, tipo: "boleto" },
  { id: 8, descricao: "Cartão à vista", valorMinimo: 2500, tipo: "cartao" },
  { id: 9, descricao: "Cartão 2x sem juros", valorMinimo: 2500, tipo: "cartao" },
  { id: 10, descricao: "Cartão 3x sem juros (0/30/60)", valorMinimo: 2500, tipo: "cartao" },
  { id: 11, descricao: "Cartão 4x sem juros (0/30/60/90)", valorMinimo: 8000, tipo: "cartao" },
  { id: 12, descricao: "Cartão 5x sem juros (0/30/60/90/120)", valorMinimo: 12000, tipo: "cartao" },
  { id: 13, descricao: "Boleto 0/15 (à vista + 1)", valorMinimo: 2500, tipo: "boleto" },
];

export const PEDIDO_MINIMO = 2500;
export const DESCONTO_MASTER_MAX = 15;

export function detectarFaixa(totalBruto: number, usarReservada = false): Faixa | null {
  if (totalBruto < PEDIDO_MINIMO) return null;
  if (usarReservada && totalBruto >= 12000) return FAIXAS[4];
  if (totalBruto >= 12000) return FAIXAS[3];
  if (totalBruto >= 8000) return FAIXAS[2];
  if (totalBruto >= 5000) return FAIXAS[1];
  return FAIXAS[0];
}

export function proximaFaixa(faixaAtual: Faixa | null): Faixa | null {
  if (!faixaAtual) return FAIXAS[0];
  if (faixaAtual.id >= 4) return null;
  return FAIXAS[faixaAtual.id]; // index = id (1-based step)
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

  const masterPct = Math.max(0, Math.min(DESCONTO_MASTER_MAX, descontoMasterPct));
  const descontoMasterValor = aposCelebra * (masterPct / 100);
  const subtotalAposDescontos = aposCelebra - descontoMasterValor;

  const aplicouPix = !!condicao && condicao.tipo === "pix" && faixa.bonusPix > 0;
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
