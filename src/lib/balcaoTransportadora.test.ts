// @ts-expect-error — bun:test is supplied by the existing test runner.
import { expect, test } from "bun:test";
import { modoAoTrocarOrigem, parametrosCotacaoTransportadora, selecionarTransportadora } from "./balcaoTransportadora";
import { pendenciaBasica } from "./balcaoPedido";
import { FORM_VAZIO } from "../components/balcao/types";

test("XPM-SC selects only transportadora; Site SP restores normal modes and Evento remains balcao", () => {
  expect(modoAoTrocarOrigem("XPM-SC", false, "sedex")).toBe("transportadora");
  expect(modoAoTrocarOrigem("SITE-SP", false, "transportadora")).toBe("retirada");
  expect(modoAoTrocarOrigem("EVENTO", true, "transportadora")).toBe("balcao");
  expect(modoAoTrocarOrigem("SITE-SP", false, "pac")).toBe("pac");
});
test("carrier quote forwards CEP, SKU/unit quantity and product value without calculating freight", () => {
  expect(parametrosCotacaoTransportadora("01001-000", [{ sku: "TESTE", quantidade: 2, preco_varejo: 40 }]))
    .toEqual({ p_cep: "01001000", p_itens: [{ sku: "TESTE", quantidade: 2 }], p_valor: 80 });
});
const opcoes = [{ transportadora_id: "a", nome: "A", valor: 35, prazo_dias: 4 }, { transportadora_id: "b", nome: "B", valor: 40, prazo_dias: 2 }];
test("only SNCF recommendation is preselected; valid seller selection is retained", () => {
  expect(selecionarTransportadora({ ok: true, opcoes, recomendada: "b" }, null)).toBe("b");
  expect(selecionarTransportadora({ ok: true, opcoes, recomendada: opcoes[1] }, "a")).toBe("a");
  expect(selecionarTransportadora({ ok: true, opcoes }, null)).toBeNull();
});
test("failed SNCF quote preserves original error and cannot supply a selected carrier", () => {
  expect(() => selecionarTransportadora({ ok: false, opcoes, erro: "CEP não atendido" }, "a")).toThrow("CEP não atendido");
});
test("transportadora requires a full delivery address and a successful quote before creation", () => {
  const base = { clienteSelecionado: true, novoCliente: false, form: { ...FORM_VAZIO, telefone: "11999999999", email: "cliente@example.test" }, cpf: "52998224725", itens: [{ quantidade: 1 }], modo: "transportadora" as const, cotando: false, entregaDisponivel: true, motivoBeneficioOk: true, pagamento: "pix", bonificacaoOk: true, emailCartaoOk: true };
  expect(pendenciaBasica(base)?.campo).toBe("balcao-entrega-cep");
  const form = { ...base.form, cep: "01001000", logradouro: "Praça da Sé", numero: "12", bairro: "Sé", cidade: "São Paulo", uf: "SP" };
  expect(pendenciaBasica({ ...base, form })).toBeNull();
  expect(pendenciaBasica({ ...base, form, entregaDisponivel: false })?.card).toBe("entrega");
  expect(pendenciaBasica({ ...base, form: { ...form, numero: "" } })?.campo).toBe("balcao-entrega-numero");
});