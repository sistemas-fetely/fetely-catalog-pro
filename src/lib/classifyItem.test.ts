// @ts-ignore — bun:test é fornecido pelo runner do Bun
import { describe, expect, test } from "bun:test";
import { disponivelParaVenda, vendaBloqueada, roteamentoQtd } from "./classifyItem";

describe("autoridade do estoque — Flavio 21/10/2026", () => {
  test("999999 permite venda firme normal mesmo com status Prev", () => {
    const p = { estoqueDisponivel: 999999, statusEstoque: "Prev. Nov 2026" };
    expect(disponivelParaVenda(p)).toBe(999999);
    expect(roteamentoQtd(p, 24)).toEqual({ firme: 24, provisao: 0 });
    expect(vendaBloqueada(p)).toBe(false);
  });
  test("zero com Prev vai integralmente para provisão", () => {
    const p = { estoqueDisponivel: 0, statusEstoque: "Prev. Nov 2026", prontaEntrega: true };
    expect(roteamentoQtd(p, 24)).toEqual({ firme: 0, provisao: 24 });
    expect(vendaBloqueada(p)).toBe(false);
  });
  test("01887: zero em estoque com pronta entrega não permite nenhuma venda", () => {
    const p = { estoqueDisponivel: 0, statusEstoque: "em estoque", prontaEntrega: true };
    expect(disponivelParaVenda(p)).toBe(0);
    expect(vendaBloqueada(p)).toBe(true);
    expect(roteamentoQtd(p, 12)).toEqual({ firme: 0, provisao: 0 });
  });
  test("zero Esgotado bloqueia firme e provisão", () => {
    const p = { estoqueDisponivel: 0, statusEstoque: "Esgotado" };
    expect(vendaBloqueada(p)).toBe(true);
    expect(roteamentoQtd(p, 12)).toEqual({ firme: 0, provisao: 0 });
  });
  test("pronta entrega nunca torna estoque positivo infinito", () => {
    expect(disponivelParaVenda({ estoqueDisponivel: 12, statusEstoque: "em estoque", prontaEntrega: true })).toBe(12);
  });
  test("previsão precisa começar com Prev", () => {
    expect(vendaBloqueada({ estoqueDisponivel: 0, statusEstoque: "Sem previsão" })).toBe(true);
  });
});
import { emEstoque as _em } from "./classifyItem";
describe("coleções de velas liberadas sem estoque", () => {
  test("Classique com estoque zero e Prev vai inteiro para pedido", () => {
    const p = { estoqueDisponivel: 0, statusEstoque: "Prev. Nov 2026", prontaEntrega: false, colecao: "Classique" };
    expect(_em(p)).toBe(true);
    expect(roteamentoQtd(p, 12)).toEqual({ firme: 12, provisao: 0 });
  });
  test("Jingle Pop com estoque zero e Prev continua em provisão", () => {
    const p = { estoqueDisponivel: 0, statusEstoque: "Prev. Nov 2026", prontaEntrega: false, colecao: "Jingle Pop" };
    expect(roteamentoQtd(p, 12)).toEqual({ firme: 0, provisao: 12 });
  });
});
