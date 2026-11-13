// @ts-ignore — bun:test is supplied by the existing test runner.
import { expect, test } from "bun:test";
import { exigirUrlPagamentoB2c, meioPagamentoB2c, opcoesPagamentoB2c, pagamentoParaCriacaoB2c, permiteDeclararPagamentoB2c, usaLinkPagamentoB2c, usaQrLocalB2c } from "./balcaoPagamento";
import { vendaImediataConcluida } from "./balcaoPedido";

test("PIX Safra is a distinct payment rule next to local PIX and both card methods", () => {
  expect(opcoesPagamentoB2c(false, false).map(m => m.codigo)).toEqual(["pix", "pix_safra", "cartao", "cartao_maquininha", "bonificacao"]);
  expect(meioPagamentoB2c("pix_safra")?.codigo).toBe("pix_safra");
  expect(meioPagamentoB2c("desconhecido")).toBeNull();
});
test("creation sends pix_safra verbatim without card installment fields", () => {
  expect(pagamentoParaCriacaoB2c("pix_safra", 12)).toEqual({ pagamento: "pix_safra" });
  expect(pagamentoParaCriacaoB2c("pix", 12)).toEqual({ pagamento: "pix" });
  expect(pagamentoParaCriacaoB2c("cartao", 12)).toEqual({ pagamento: "cartao", max_parcelas: 12 });
});
test("PIX Safra uses a payment link and never the local PIX QR", () => {
  expect(usaLinkPagamentoB2c("pix_safra")).toBe(true);
  expect(usaQrLocalB2c("pix_safra")).toBe(false);
  expect(usaQrLocalB2c("pix")).toBe(true);
  expect(usaLinkPagamentoB2c("pix")).toBe(false);
});
test("PIX Safra never accepts seller declaration or becomes sold from a local declaration", () => {
  expect(permiteDeclararPagamentoB2c("pix_safra", "balcao")).toBe(false);
  expect(permiteDeclararPagamentoB2c("pix_safra", "retirada")).toBe(false);
  expect(vendaImediataConcluida("balcao", "pix_safra", true)).toBe(false);
  expect(permiteDeclararPagamentoB2c("pix", "balcao")).toBe(true);
  expect(permiteDeclararPagamentoB2c("pix", "retirada")).toBe(false);
});
test("event and editing keep PIX Safra available without permitting bonification", () => {
  expect(opcoesPagamentoB2c(false, true).map(m => m.codigo)).toEqual(["pix", "pix_safra", "cartao", "cartao_maquininha"]);
  expect(opcoesPagamentoB2c(true, false).map(m => m.codigo)).toEqual(["pix", "pix_safra", "cartao", "cartao_maquininha"]);
  expect(meioPagamentoB2c("sem_pagamento")?.codigo).toBe("bonificacao");
});
test("link actions use the exact SNCF URL even when the returned Safra meio is pix", () => {
  expect(exigirUrlPagamentoB2c({ url: "https://pagamento.example.test/safra/123", meio: "pix" })).toBe("https://pagamento.example.test/safra/123");
  expect(() => exigirUrlPagamentoB2c({ url: null, meio: "pix" })).toThrow("não devolveu a URL");
  expect(() => exigirUrlPagamentoB2c({ url: "000201-PIX-LOCAL" })).toThrow("URL de pagamento inválida");
  expect(() => exigirUrlPagamentoB2c({ url: "javascript:alert(1)" })).toThrow("URL de pagamento inválida");
});