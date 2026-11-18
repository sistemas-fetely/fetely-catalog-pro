import type { CotacaoTransportadora, ModoEntrega } from "../components/balcao/types";

export const CD_XPM_SC = "XPM-SC";
export const saiDaXpm = (codigo: string) => codigo === CD_XPM_SC;

// Only project the RPC inputs; pricing and freight benefits belong to SNCF.
export function parametrosCotacaoTransportadora(cep: string, itens: { sku: string; quantidade: number; preco_varejo: number }[]) {
  return { p_cep: cep.replace(/\D/g, ""), p_itens: itens.map(({ sku, quantidade }) => ({ sku, quantidade })),
    p_valor: itens.reduce((total, item) => total + item.preco_varejo * item.quantidade, 0) };
}

export function selecionarTransportadora(cotacao: CotacaoTransportadora, atual: string | null): string | null {
  if (!cotacao.ok) throw new Error(cotacao.erro || "Não foi possível cotar a transportadora.");
  if (atual && cotacao.opcoes.some(o => o.transportadora_id === atual)) return atual;
  const recomendada = typeof cotacao.recomendada === "string" ? cotacao.recomendada : cotacao.recomendada?.transportadora_id;
  // No local recommendation: an absent SNCF recommendation leaves selection to the seller.
  return cotacao.opcoes.find(o => o.transportadora_id === recomendada)?.transportadora_id ?? null;
}

export function modoAoTrocarOrigem(codigo: string, balcao: boolean, atual: ModoEntrega): ModoEntrega {
  if (balcao) return "balcao";
  if (saiDaXpm(codigo)) return "transportadora";
  return atual === "balcao" || atual === "transportadora" ? "retirada" : atual;
}