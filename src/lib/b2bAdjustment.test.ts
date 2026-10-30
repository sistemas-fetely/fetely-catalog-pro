// @ts-ignore Bun supplies the test runner
import { expect, test } from "bun:test";
import { canAdjust, canAdjustFreight, submitAdjustment, adjustmentItems, type B2BPermissions } from "./b2bAdjustment";
import type { CartItem } from "@/types";
const p: B2BPermissions = { estagio: "qualquer", editar_itens: false, editar_frete: false, editar_pagamento: false, motivo_bloqueio: "Bloqueado pelo SNCF", frete: { tipo: "FOB", valor: 45, contratado_pelo_cliente: false }, condicao_atual: "pix", condicoes: [] };
test("somente permissões SNCF habilitam ajuste sem regra de estágio", () => {
  expect(canAdjust(p)).toBe(false);
  expect(canAdjust({ ...p, editar_itens: true, estagio: "faturado" })).toBe(true);
});
test("frete contratado pelo cliente bloqueia edição", () => {
  expect(canAdjustFreight({ ...p, editar_frete: true })).toBe(true);
  expect(canAdjustFreight({ ...p, editar_frete: true, frete: { ...p.frete, contratado_pelo_cliente: true } })).toBe(false);
});
test("motivo exige três caracteres e impede envio", async () => {
  let calls = 0;
  const call = async () => { calls++; return { ok: true, resultado: "aplicado" as const, mensagem: "OK" }; };
  await expect(submitAdjustment("b2b_frete", { motivo: " ab " }, call)).rejects.toThrow("mín. 3");
  expect(calls).toBe(0);
  await submitAdjustment("b2b_frete", { motivo: " abc " }, call);
  expect(calls).toBe(1);
});
test("envia frete total sem somar o valor atual e mantém reanálise", async () => {
  let sent: Record<string, unknown> = {};
  const result = await submitAdjustment("b2b_frete", { pedido_id: "sncf", valor_frete: 80, motivo: "Ajuste" }, async (tipo, body) => {
    expect(tipo).toBe("b2b_frete"); sent = body;
    return { ok: true, resultado: "enviado_reanalise", mensagem: "Mensagem SNCF" };
  });
  expect(sent.valor_frete).toBe(80);
  expect(result.resultado).toBe("enviado_reanalise");
  expect(result.mensagem).toBe("Mensagem SNCF");
});
test("itens enviam preço do carrinho e fator da faixa", () => {
  expect(adjustmentItems([{ sku: "SKU", quantity: 2, product: { nomeComercial: "Vela", precoAtacado: 100 } } as CartItem], 0.9)).toEqual([{ sku: "SKU", descricao: "Vela", quantidade: 2, valor_unitario: 90 }]);
});