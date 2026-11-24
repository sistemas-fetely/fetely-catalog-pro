// @ts-ignore — bun:test é fornecido pelo runner do Bun
import { afterEach, expect, test } from "bun:test";
import { EMAILS_PF_LIBERADO, halfBox, isValidMultiple, nearestMultiple, quantidadeLivreLiberada, setQuantidadeLivre } from "./format";

afterEach(() => setQuantidadeLivre(false));

test("Amanda pode lançar quantidade 1 em vez de meia caixa", () => {
  setQuantidadeLivre(quantidadeLivreLiberada("amandafetely@gmail.com", false));
  expect(halfBox(12)).toBe(1);
  expect(isValidMultiple(1, 12)).toBe(true);
  expect(nearestMultiple(1, 12)).toBe(1);
});

test("Rafaela mantém a quantidade unitária", () => {
  setQuantidadeLivre(quantidadeLivreLiberada("rafaela.barbosa@fetely.com.br", false));
  expect(isValidMultiple(1, 12)).toBe(true);
});

test("master mantém a quantidade unitária", () => {
  setQuantidadeLivre(quantidadeLivreLiberada("master@example.com", true));
  expect(isValidMultiple(1, 12)).toBe(true);
});

test("demais usuários mantêm a meia caixa", () => {
  setQuantidadeLivre(quantidadeLivreLiberada("vendedor@example.com", false));
  expect(halfBox(12)).toBe(6);
  expect(isValidMultiple(1, 12)).toBe(false);
});

test("liberação da Amanda não amplia o cadastro de pessoa física", () => {
  expect(EMAILS_PF_LIBERADO.includes("amandafetely@gmail.com")).toBe(false);
  expect(EMAILS_PF_LIBERADO.includes("rafaela.barbosa@fetely.com.br")).toBe(true);
});