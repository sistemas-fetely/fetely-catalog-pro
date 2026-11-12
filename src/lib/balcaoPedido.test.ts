// @ts-ignore — bun:test is supplied by the existing test runner.
import { expect, test } from "bun:test";
import { cpfPrivado, juntarObservacao, modalidadesVisiveis, pendenciaBasica, separarObservacao } from "./balcaoPedido";
import { FORM_VAZIO, type OpcaoEntrega } from "../components/balcao/types";

const opcao = (modo: "sedex" | "pac", valor: number, prazo: number | null, ok = true): OpcaoEntrega => ({ modo, ok, frete_cobrado: valor, prazo_dias: prazo, valor_itens: 100, desconto_pedido: 0, valor_total: 100 + valor, gratis: false, fonte: null, avisos: [] });
test("SEDEX cheaper and faster hides PAC", () => {
  const r = modalidadesVisiveis([opcao("sedex", 15, 2), opcao("pac", 20, 5)]);
  expect(r.oculto).toBe("pac"); expect(r.opcoes.map(o => o.modo)).toEqual(["sedex"]);
});
test("dominance requires one strict improvement, never hides equal or incomparable quotes", () => {
  expect(modalidadesVisiveis([opcao("sedex", 20, 2), opcao("pac", 20, 2)]).oculto).toBeNull();
  expect(modalidadesVisiveis([opcao("sedex", 20, 2), opcao("pac", 15, 5)]).oculto).toBeNull();
});
test("PAC can dominate SEDEX but unknown deadlines and failed quotes cannot", () => {
  expect(modalidadesVisiveis([opcao("sedex", 25, 4), opcao("pac", 20, 4)]).oculto).toBe("sedex");
  expect(modalidadesVisiveis([opcao("sedex", 10, null), opcao("pac", 20, 5)]).oculto).toBeNull();
  expect(modalidadesVisiveis([opcao("sedex", 10, 1, false), opcao("pac", 20, 5)]).oculto).toBeNull();
});
test("expedition is first in the existing observation, preserves multiline text on editing", () => {
  const texto = juntarObservacao(" enviar só a peça\nembalar para presente ", " contato na portaria ");
  expect(texto).toBe("EXPEDIÇÃO: enviar só a peça\nembalar para presente\n\ncontato na portaria");
  expect(separarObservacao(texto)).toEqual({ expedicao: "enviar só a peça\nembalar para presente", observacao: "contato na portaria" });
  expect(juntarObservacao("", "nota antiga")).toBe("nota antiga");
  expect(separarObservacao("nota antiga")).toEqual({ expedicao: "", observacao: "nota antiga" });
});
test("CPF displayed in customer selection conceals first and last digits", () => {
  expect(cpfPrivado("52998224725")).toBe("***.982.247-**");
});
const base = { clienteSelecionado: false, novoCliente: true, form: { ...FORM_VAZIO, nome: "Teste", cpf: "529.982.247-25", telefone: "11999999999" }, cpf: "52998224725", itens: [{ quantidade: 2 }], modo: "retirada" as const, cotando: false, entregaDisponivel: true, motivoBeneficioOk: true, pagamento: "pix", bonificacaoOk: true, emailCartaoOk: true };
test("invalid CPF checksum blocks creation, not only an eleven-digit check", () => {
  expect(pendenciaBasica({ ...base, cpf: "52998224724" })?.campo).toBe("balcao-cliente-cpf");
  expect(pendenciaBasica(base)).toBeNull();
});
test("first pending field is customer before CPF, item and delivery", () => {
  expect(pendenciaBasica({ ...base, novoCliente: false, cpf: "", itens: [], modo: "sedex" })?.card).toBe("cliente");
});
test("new customers require telephone", () => {
  expect(pendenciaBasica({ ...base, form: { ...base.form, telefone: "" } })?.campo).toBe("balcao-cliente-telefone");
});
test("quantities are positive integers but do not check commercial stock", () => {
  expect(pendenciaBasica({ ...base, itens: [{ quantidade: 1.5 }] })?.card).toBe("itens");
  expect(pendenciaBasica({ ...base, itens: [{ quantidade: 0 }] })?.card).toBe("itens");
  expect(pendenciaBasica({ ...base, itens: [{ quantidade: 999 }] })).toBeNull();
});
test("shipping requires CEP and required address fields; collection does not", () => {
  expect(pendenciaBasica({ ...base, modo: "sedex" })?.campo).toBe("balcao-entrega-cep");
  expect(pendenciaBasica({ ...base, modo: "sedex", form: { ...base.form, cep: "01001000", logradouro: "Praça", numero: "1", bairro: "Sé", cidade: "São Paulo", uf: "SP" } })).toBeNull();
});
test("pending quotation blocks submission, benefit and bonification require reasons", () => {
  expect(pendenciaBasica({ ...base, cotando: true })?.card).toBe("entrega");
  expect(pendenciaBasica({ ...base, motivoBeneficioOk: false })?.card).toBe("beneficio");
  expect(pendenciaBasica({ ...base, pagamento: "bonificacao", bonificacaoOk: false })?.campo).toBe("bonif-autorizado");
});