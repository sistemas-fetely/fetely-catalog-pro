// Dimension mirrored from the SNCF B2C payment contract; codes are payment-rule codes,
// never inferred from forma_solicitada (pix and pix_safra both have forma pix).
export const MEIOS_PAGAMENTO_B2C = {
  pix: { codigo: "pix", rotulo: "PIX (QR)", icone: "qr", link: false, qrLocal: true, declaracaoBalcao: true, parcelas: false },
  pix_safra: { codigo: "pix_safra", rotulo: "PIX pelo Safra (link)", icone: "link", link: true, qrLocal: false, declaracaoBalcao: false, parcelas: false },
  cartao: { codigo: "cartao", rotulo: "Cartão (link)", icone: "cartao", link: true, qrLocal: false, declaracaoBalcao: false, parcelas: true },
  cartao_maquininha: { codigo: "cartao_maquininha", rotulo: "Cartão maquininha", icone: "maquininha", link: false, qrLocal: false, declaracaoBalcao: false, parcelas: false },
  bonificacao: { codigo: "bonificacao", rotulo: "Bonificação", icone: "presente", link: false, qrLocal: false, declaracaoBalcao: false, parcelas: false },
} as const;
export type MeioPagamentoB2c = keyof typeof MEIOS_PAGAMENTO_B2C;
export type MeioCobrancaB2c = Exclude<MeioPagamentoB2c, "bonificacao">;

export function meioPagamentoB2c(codigo: string | null | undefined) {
  const chave = codigo === "sem_pagamento" ? "bonificacao" : codigo;
  return chave && Object.hasOwn(MEIOS_PAGAMENTO_B2C, chave) ? MEIOS_PAGAMENTO_B2C[chave as MeioPagamentoB2c] : null;
}
export const rotuloPagamentoB2c = (codigo: string | null | undefined) => meioPagamentoB2c(codigo)?.rotulo ?? codigo ?? "—";
export const usaLinkPagamentoB2c = (codigo: string | null | undefined) => meioPagamentoB2c(codigo)?.link === true;
export const usaQrLocalB2c = (codigo: string | null | undefined) => meioPagamentoB2c(codigo)?.qrLocal === true;
export const permiteDeclararPagamentoB2c = (codigo: string | null | undefined, modo: string) =>
  modo === "balcao" && meioPagamentoB2c(codigo)?.declaracaoBalcao === true;
export function opcoesPagamentoB2c(edicao: boolean, modoBalcao: boolean) {
  return Object.values(MEIOS_PAGAMENTO_B2C).filter(m => m.codigo !== "bonificacao" || !edicao && !modoBalcao);
}
export function legendaPagamentoB2c(codigo: MeioPagamentoB2c, imediato: boolean, parcelas: number) {
  if (codigo === "pix") return imediato ? "QR na tela · cliente pagou" : "QR local · chave da Fetely";
  if (codigo === "pix_safra") return "Link Safrapay · parcela única · confirmação automática";
  if (codigo === "cartao") return `Link Safrapay · até ${parcelas}x`;
  if (codigo === "cartao_maquininha") return imediato ? "Pagou na maquininha? Digite o NSU do comprovante." : "Passa na loja · sem link · anexar o comprovante";
  return "Sem cobrança · direto para faturamento";
}
export function resumoPagamentoB2c(codigo: MeioPagamentoB2c | null, imediato: boolean, parcelas: number) {
  if (!codigo) return "Pagamento não selecionado";
  const rotulo = rotuloPagamentoB2c(codigo);
  if (codigo === "cartao") return `${rotulo} · até ${parcelas}x`;
  if (codigo === "cartao_maquininha") return `${rotulo} · ${imediato ? "NSU" : "comprovante"}`;
  if (codigo === "bonificacao") return `${rotulo} · sem cobrança`;
  return rotulo;
}
// Preserve the rule code verbatim; only card links accept an installment parameter.
export function pagamentoParaCriacaoB2c(pagamento: MeioPagamentoB2c | null, parcelas: number) {
  return { pagamento, ...(meioPagamentoB2c(pagamento)?.parcelas ? { max_parcelas: parcelas } : {}) };
}

export type LinkPagamentoB2c = { url: string | null; meio?: string; expira_em?: string | null };
export function exigirUrlPagamentoB2c(resposta: LinkPagamentoB2c) {
  if (!resposta.url) throw new Error("O SNCF não devolveu a URL do link de pagamento.");
  let url: URL;
  try { url = new URL(resposta.url); } catch { throw new Error("O SNCF devolveu uma URL de pagamento inválida."); }
  if (url.protocol !== "https:") throw new Error("O SNCF devolveu uma URL de pagamento inválida.");
  return resposta.url;
}