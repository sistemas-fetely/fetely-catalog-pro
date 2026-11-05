// @ts-ignore — bun:test é fornecido pelo runner do Bun
import { describe, expect, test } from "bun:test";
import { DESCONTO_LIVRE_MAX, descontoLivreLiberado, calcularPedido } from "./commercial";

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
});
