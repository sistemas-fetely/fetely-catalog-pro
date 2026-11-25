import { describe, expect, test } from "vitest";
import { roteamentoQtd, vendaBloqueada, emEstoque } from "./classifyItem";

describe("Jingle Pop liberada como pronta entrega — Thomer 25/11/2026", () => {
  test("Jingle Pop com saldo zero e previsão vai inteira para pedido firme", () => {
    const p = { estoqueDisponivel: 0, statusEstoque: "Prev. Nov 2026", colecao: "Jingle Pop" };
    expect(roteamentoQtd(p, 24)).toEqual({ firme: 24, provisao: 0 });
  });
  test("Jingle Pop sem saldo e sem previsão não bloqueia", () => {
    const p = { estoqueDisponivel: 0, statusEstoque: "Esgotado", colecao: "Jingle Pop" };
    expect(vendaBloqueada(p)).toBe(false);
    expect(emEstoque(p)).toBe(true);
  });
  test("Jingle Pop com saldo parcial não separa excedente para provisão", () => {
    const p = { estoqueDisponivel: 12, statusEstoque: "Prev. Nov 2026", colecao: "jingle pop" };
    expect(roteamentoQtd(p, 30)).toEqual({ firme: 30, provisao: 0 });
  });
  test("outras coleções seguem firmes sem saldo", () => {
    const p = { estoqueDisponivel: 0, statusEstoque: "Prev", colecao: "Classic" };
    expect(roteamentoQtd(p, 6)).toEqual({ firme: 6, provisao: 0 });
  });
});
