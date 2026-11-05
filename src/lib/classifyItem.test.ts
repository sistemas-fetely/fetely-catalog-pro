// @ts-ignore — bun:test é fornecido pelo runner do Bun
import { describe, expect, test } from "bun:test";
import { classificarItem, disponivelParaVenda, emEstoque, vendaBloqueada, roteamentoQtd } from "./classifyItem";

describe("liberação de todos os itens — Thomer 05/11/2026", () => {
  test("Jingle Pop com saldo zero e previsão segue integralmente como pedido", () => {
    const p = { estoqueDisponivel: 0, statusEstoque: "Prev. Nov 2026", colecao: "Jingle Pop" };
    expect(roteamentoQtd(p, 24)).toEqual({ firme: 24, provisao: 0 });
    expect(emEstoque(p)).toBe(true);
    expect(vendaBloqueada(p)).toBe(false);
  });
  test("itens de qualquer coleção e sem coleção ficam liberados com saldo zero", () => {
    for (const colecao of ["Classique", "Fine Pure", "Le Moment", "Dots Doux", "Spirale", "Twist", "Lumi Star", "Pattern", "Amour", "Piacera", "Signature", "Outra coleção", undefined]) {
      const p = { estoqueDisponivel: 0, statusEstoque: "Esgotado", colecao };
      expect(vendaBloqueada(p)).toBe(false);
      expect(roteamentoQtd(p, 12)).toEqual({ firme: 12, provisao: 0 });
    }
  });
  test("saldo insuficiente não separa nenhuma quantidade para provisão", () => {
    expect(roteamentoQtd({ estoqueDisponivel: 2, statusEstoque: "em estoque" }, 24)).toEqual({ firme: 24, provisao: 0 });
  });
  test("liberação não tem teto artificial de 999999 nem altera saldo físico", () => {
    const p = { estoqueDisponivel: 0, statusEstoque: "Prev. Nov 2026", prontaEntrega: false };
    expect(disponivelParaVenda(p)).toBe(Number.POSITIVE_INFINITY);
    expect(roteamentoQtd(p, 1000000)).toEqual({ firme: 1000000, provisao: 0 });
    expect(p.estoqueDisponivel).toBe(0);
    expect(p.prontaEntrega).toBe(false);
  });
  test("classificação antiga por status também segue como pedido", () => {
    for (const status of ["Prev. Nov 2026", "Esgotado", "em estoque", ""]) {
      expect(classificarItem(status)).toBe("firme");
    }
  });
  test("quantidade inválida negativa não cria itens", () => {
    expect(roteamentoQtd({ estoqueDisponivel: 0, statusEstoque: "Prev" }, -1)).toEqual({ firme: 0, provisao: 0 });
  });
});