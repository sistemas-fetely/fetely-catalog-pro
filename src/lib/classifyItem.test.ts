// @ts-ignore — bun:test é fornecido pelo runner do Bun
import { describe, expect, test } from "bun:test";
import { classificarItem, disponivelParaVenda, emEstoque, vendaBloqueada, roteamentoQtd } from "./classifyItem";

describe("liberação comercial com exceção de Jingle Pop — Thomer 09/11/2026", () => {
  test("Jingle Pop com saldo zero e previsão vai integralmente para provisão", () => {
    const p = { estoqueDisponivel: 0, statusEstoque: "Prev. Nov 2026", colecao: "Jingle Pop" };
    expect(roteamentoQtd(p, 24)).toEqual({ firme: 0, provisao: 24 });
    expect(emEstoque(p)).toBe(false);
    expect(vendaBloqueada(p)).toBe(false);
  });

  test("Jingle Pop sem saldo e sem previsão fica bloqueado", () => {
    const p = { estoqueDisponivel: 0, statusEstoque: "Esgotado", colecao: "Jingle Pop" };
    expect(vendaBloqueada(p)).toBe(true);
    expect(roteamentoQtd(p, 24)).toEqual({ firme: 0, provisao: 0 });
  });

  test("Jingle Pop com saldo vende firme e separa somente o excedente para provisão", () => {
    const p = { estoqueDisponivel: 12, statusEstoque: "Prev. Nov 2026", colecao: "jingle pop" };
    expect(disponivelParaVenda(p)).toBe(12);
    expect(emEstoque(p)).toBe(true);
    expect(vendaBloqueada(p)).toBe(false);
    expect(roteamentoQtd(p, 24)).toEqual({ firme: 12, provisao: 12 });
    expect(roteamentoQtd(p, 12)).toEqual({ firme: 12, provisao: 0 });
  });

  test("itens das demais coleções e sem coleção continuam liberados com saldo zero", () => {
    for (const colecao of ["Classique", "Fine Pure", "Le Moment", "Dots Doux", "Spirale", "Twist", "Lumi Star", "Pattern", "Amour", "Piacera", "Signature", "Outra coleção", undefined]) {
      const p = { estoqueDisponivel: 0, statusEstoque: "Esgotado", colecao };
      expect(vendaBloqueada(p)).toBe(false);
      expect(roteamentoQtd(p, 12)).toEqual({ firme: 12, provisao: 0 });
    }
  });

  test("saldo insuficiente fora de Jingle Pop não separa quantidade para provisão", () => {
    expect(roteamentoQtd({ estoqueDisponivel: 2, statusEstoque: "em estoque", colecao: "Classique" }, 24)).toEqual({ firme: 24, provisao: 0 });
  });

  test("liberação das demais coleções não tem teto artificial nem altera saldo físico", () => {
    const p = { estoqueDisponivel: 0, statusEstoque: "Prev. Nov 2026", prontaEntrega: false, colecao: "Classique" };
    expect(disponivelParaVenda(p)).toBe(Number.POSITIVE_INFINITY);
    expect(roteamentoQtd(p, 1000000)).toEqual({ firme: 1000000, provisao: 0 });
    expect(p.estoqueDisponivel).toBe(0);
    expect(p.prontaEntrega).toBe(false);
  });

  test("classificação por status reconhece previsão", () => {
    expect(classificarItem("Prev. Nov 2026")).toBe("provisao");
    for (const status of ["Esgotado", "em estoque", ""]) {
      expect(classificarItem(status)).toBe("firme");
    }
  });

  test("quantidade inválida negativa não cria itens", () => {
    expect(roteamentoQtd({ estoqueDisponivel: 0, statusEstoque: "Prev", colecao: "Jingle Pop" }, -1)).toEqual({ firme: 0, provisao: 0 });
  });
});
