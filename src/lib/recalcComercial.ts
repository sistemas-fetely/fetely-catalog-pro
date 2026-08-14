// Recalcula as BASES DE CÁLCULO de um OrderCommercial sobre uma lista real de itens,
// preservando as DECISÕES COMERCIAIS já tomadas (condição, faixa, frete tipo, negociação,
// bonificação). Usado na conversão de cotação → pedido, onde a lista de itens firmes
// pode ter encolhido desde a criação da cotação.
import type { CartItem, OrderCommercial } from "@/types";
import { CONDICOES_PAGAMENTO, calcularPedido } from "@/lib/commercial";
import { effectiveItemSubtotal } from "@/store/orderStore";

export function brutoDosItens(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + effectiveItemSubtotal(i), 0);
}

export function recalcularComercialParaItens(
  base: OrderCommercial,
  items: CartItem[],
): OrderCommercial {
  const bruto = brutoDosItens(items);
  const condicao =
    CONDICOES_PAGAMENTO.find((c) => c.id === base.condicaoId) ?? null;

  const c = calcularPedido({
    bruto,
    usarReservada: base.usouReservada,
    descontoMasterPct: base.descontoMasterPct ?? 0,
    condicao,
    freteGratisOverride: !!base.freteIsento,
    ignorarPedidoMinimo: true,
    uf: base.freteUf ?? null,
    aplicarDescontoCelebra: (base.descontoCelebraPct ?? 0) > 0,
    aplicarDescontoNegociacao: (base.descontoMasterPct ?? 0) > 0,
    aplicarBonusPix: !!base.aplicouPix,
    aplicarAcrescimoIsentoIE: !!base.acrescimoIsentoIEAplicado,
    acrescimoIsentoIEPercent: base.acrescimoIsentoIEPercent,
    freteAjusteModo: base.freteAjusteModo,
    freteAjusteQtd: base.freteAjusteAplicado
      ? base.freteAjusteModo === "valor"
        ? base.freteAjusteValor ?? 0
        : base.freteAjustePercent ?? 0
      : 0,
  });

  return {
    // DECISÕES preservadas da cotação
    faixaId: base.faixaId,
    faixaNome: base.faixaNome,
    frete: base.frete,
    condicaoId: base.condicaoId,
    condicaoDescricao: base.condicaoDescricao,
    descontoCelebraPct: base.descontoCelebraPct,
    descontoMasterPct: base.descontoMasterPct,
    negociacao: base.negociacao,
    justificativa: base.justificativa,
    observacaoInterna: base.observacaoInterna,
    usouReservada: base.usouReservada,
    bonificado: base.bonificado,
    motivoBonificacao: base.motivoBonificacao,
    premissasAplicadas: base.premissasAplicadas,

    // BASES recalculadas sobre os itens reais
    bruto: c.bruto,
    descontoCelebraValor: c.descontoCelebraValor,
    descontoMasterValor: c.descontoMasterValor,
    bonusPixValor: c.bonusPixValor,
    bonusPixPercent: c.bonusPixPercentEfetivo ?? 0,
    aplicouPix: c.aplicouPix,
    totalFinal: c.total,
    totalSemPix: c.totalSemPix,
    freteValor: c.freteValor ?? 0,
    fretePercent: c.fretePercent,
    freteIsento: c.freteIsento ?? false,
    freteUf: c.freteUf ?? base.freteUf,
    freteOrigem: c.freteOrigem ?? base.freteOrigem,
    freteUsouFallback: c.freteUsouFallback ?? false,
    freteAjusteModo: c.freteAjusteModo ?? base.freteAjusteModo,
    freteAjustePercent: c.freteAjustePercent ?? base.freteAjustePercent,
    freteAjusteValor: c.freteAjusteValor ?? 0,
    freteAjusteAplicado: c.freteAjusteAplicado ?? false,
    acrescimoIsentoIEValor: c.acrescimoIsentoIEValor ?? 0,
    acrescimoIsentoIEPercent: c.acrescimoIsentoIEPercent ?? 0,
    acrescimoIsentoIEAplicado: !!c.acrescimoIsentoIEAplicado,
  };
}
