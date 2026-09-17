export function formatBRL(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

// --- Quantidade livre (unidade por unidade) ---------------------------------
// Alguns usuários (master e contas autorizadas) lançam pedido peça por peça,
// sem respeitar caixa fechada / meia caixa. O flag é definido no login.
let quantidadeLivre = false;

/** E-mails autorizados a lançar quantidade unitária, além do master. */
export const EMAILS_QUANTIDADE_LIVRE = ["rafaela.barbosa@fetely.com.br"];

export function setQuantidadeLivre(v: boolean): void {
  quantidadeLivre = v;
}

export function isQuantidadeLivre(): boolean {
  return quantidadeLivre;
}

// --- Cadastro de pessoa física (PF) -----------------------------------------
// A opção "Pessoa Física" no cadastro de cliente fica visível apenas para o
// master e contas autorizadas, enquanto a frente PF está em rollout. Os demais
// usuários continuam vendo somente Pessoa Jurídica (cadastros PF existentes
// continuam abrindo normalmente para leitura/edição).
let pfLiberado = false;

/** E-mails autorizados a cadastrar pessoa física, além do master. */
export const EMAILS_PF_LIBERADO = EMAILS_QUANTIDADE_LIVRE;

export function setPfLiberado(v: boolean): void {
  pfLiberado = v;
}

export function isPfLiberado(): boolean {
  return pfLiberado;
}

/** Meia caixa — quantidade mínima permitida por SKU. */
export function halfBox(mult: number): number {
  if (quantidadeLivre) return 1;
  if (!Number.isFinite(mult) || mult <= 1) return 1;
  return mult % 2 === 0 ? mult / 2 : mult;
}

/** Quantidade mínima de venda (meia caixa). */
export function minQty(mult: number): number {
  return halfBox(mult);
}

export function nearestMultiple(value: number, mult: number): number {
  const step = halfBox(mult);
  if (step <= 1) return Math.max(0, Math.round(value));
  return Math.max(step, Math.round(value / step) * step);
}

export function isValidMultiple(value: number, mult: number): boolean {
  const step = halfBox(mult);
  if (!Number.isInteger(value) || value <= 0) return false;
  // nunca menos que meia caixa e sempre em passos de meia caixa
  if (value < step) return false;
  return value % step === 0;
}

