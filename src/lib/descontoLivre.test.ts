import { describe, expect, test } from "bun:test";
import { DESCONTO_LIVRE_MAX, descontoLivreLiberado } from "./commercial";

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
});
