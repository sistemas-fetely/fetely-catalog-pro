// @ts-ignore — bun:test é fornecido pelo runner do Bun
import { expect, test } from "bun:test";
import { isBonification, orderPayment, selectionAfterBonification } from "./bonificationPayment";

test("Pedido bonificado grava sem_pagamento em vez de boleto ou vazio", () => {
  for (const current of ["boleto", "", "pix"]) {
    expect(orderPayment({ condicaoDescricao: "Pedido bonificado" }, current)).toBe("sem_pagamento");
  }
});
test("bonificação também é reconhecida na edição pelo indicador existente", () => {
  expect(isBonification({ bonificado: true })).toBe(true);
  expect(orderPayment({ bonificado: true }, "boleto")).toBe("sem_pagamento");
});
test("ao sair da bonificação não há pagamento pré-selecionado", () => {
  expect(selectionAfterBonification(true, false, 2)).toBeNull();
});
test("demais condições e seleções não mudam", () => {
  for (const method of ["pix", "boleto", "cartao", "cartao_maquininha"]) {
    expect(orderPayment({ condicaoDescricao: "Outra condição" }, method)).toBe(method);
  }
  expect(selectionAfterBonification(false, false, 2)).toBe(2);
});