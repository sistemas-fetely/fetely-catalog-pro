// @ts-ignore — bun:test é fornecido pelo runner do Bun
import { describe, expect, test } from "bun:test";
import { DESCONTO_LIVRE_MAX, descontoLivreLiberado, calcularPedido } from "./commercial";
import { recalcularComercialParaItens } from "./recalcComercial";
import { orderToRow } from "@/store/orderStore";
import type { OrderCommercial, SavedOrder, Product } from "@/types";

// Regra Thomer 05/11/2026: desconto livre de até 100% com senha master,
// somente para Thomer e Joseph.
describe("desconto livre até 100% — somente Thomer e Joseph", () => {
  test("Thomer (conta Fetely) está liberado", () => {
    expect(descontoLivreLiberado("thomer@fetely.com.br")).toBe(true);
  });

  test("Thomer (conta pessoal) está liberado", () => {
    expect(descontoLivreLiberado("thomer.elkrief@me.com")).toBe(true);
  });

  test("Joseph está liberado", () => {
    expect(descontoLivreLiberado("joseph@fetely.com.br")).toBe(true);
  });

  test("e-mail com maiúsculas/espaços também é reconhecido", () => {
    expect(descontoLivreLiberado("  Joseph@Fetely.com.br ")).toBe(true);
  });

  test("outros usuários não têm desconto livre", () => {
    expect(descontoLivreLiberado("amanda@fetely.com.br")).toBe(false);
    expect(descontoLivreLiberado("rafaella.barbosa@fetely.com.br")).toBe(false);
    expect(descontoLivreLiberado(null)).toBe(false);
    expect(descontoLivreLiberado(undefined)).toBe(false);
    expect(descontoLivreLiberado("")).toBe(false);
  });

  test("o teto do desconto livre é 100%", () => {
    expect(DESCONTO_LIVRE_MAX).toBe(100);
  });

  test("100% liberado zera os produtos no cálculo usado para salvar", () => {
    const c = calcularPedido({ bruto: 2000, descontoMasterPct: 100, descontoMasterMax: 100, aplicarDescontoCelebra: false, aplicarBonusPix: false });
    expect(c.descontoMasterPercentEfetivo).toBe(100);
    expect(c.descontoMasterValor).toBe(2000);
    expect(c.total).toBe(0);
  });

  test("50% liberado aplica metade, não 30%", () => {
    const c = calcularPedido({ bruto: 2000, descontoMasterPct: 50, descontoMasterMax: 100, aplicarDescontoCelebra: false, freteGratisOverride: true });
    expect(c.descontoMasterValor).toBe(1000);
    expect(c.total).toBe(1000);
  });

  test("sem liberação mantém teto normal de 30%", () => {
    const c = calcularPedido({ bruto: 2000, descontoMasterPct: 100, aplicarDescontoCelebra: false, freteGratisOverride: true });
    expect(c.descontoMasterPercentEfetivo).toBe(30);
    expect(c.descontoMasterValor).toBe(600);
    expect(c.total).toBe(1400);
  });

  test("representante permanece limitado a 15% e negociação desligada não desconta", () => {
    const c = calcularPedido({ bruto: 2000, descontoMasterPct: 100, descontoMasterMax: 15, aplicarDescontoCelebra: false, freteGratisOverride: true });
    expect(c.descontoMasterValor).toBe(300);
    expect(calcularPedido({ bruto: 2000, descontoMasterPct: 100, descontoMasterMax: 100, aplicarDescontoNegociacao: false }).descontoMasterValor).toBe(0);
  });

  test("pedido serializado e conversão mantêm valor e percentual de 100%", () => {
    const c = calcularPedido({ bruto: 2000, descontoMasterPct: 100, descontoMasterMax: 100, aplicarDescontoCelebra: false });
    const commercial: OrderCommercial = { faixaId: 1, faixaNome: "Convidado", frete: "FOB", condicaoId: 2, condicaoDescricao: "Boleto à vista", bruto: c.bruto, descontoCelebraPct: 0, descontoCelebraValor: 0, descontoMasterPct: c.descontoMasterPercentEfetivo ?? 0, descontoMasterValor: c.descontoMasterValor, bonusPixValor: 0, aplicouPix: false, totalFinal: c.total, totalSemPix: c.totalSemPix, negociacao: true, justificativa: "Autorizado", observacaoInterna: "", usouReservada: false };
    const product = { sku: "TEST", precoAtacado: 1000 } as Product;
    const items = [{ sku: "TEST", product, quantity: 2 }];
    const row = orderToRow({ id: "TEST-DESCONTO", createdAt: "2026-11-05", meta: {}, commercial, total: c.total, items } as SavedOrder);
    expect(row.total).toBe(0);
    expect((row.commercial as OrderCommercial).descontoMasterPct).toBe(100);
    expect((row.commercial as OrderCommercial).descontoMasterValor).toBe(2000);
    const converted = recalcularComercialParaItens(commercial, items);
    expect(converted.descontoMasterPct).toBe(100);
    expect(converted.descontoMasterValor).toBe(2000);
    expect(converted.totalFinal).toBe(0);
  });
});
