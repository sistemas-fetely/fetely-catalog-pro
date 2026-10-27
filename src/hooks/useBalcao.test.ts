// @ts-ignore — bun:test é fornecido pelo runner do Bun
import { expect, test } from "bun:test";
import { salvarAlteracaoBalcao, type AlteracaoBalcao } from "./useBalcao";

const base: AlteracaoBalcao = { fop_profile_id: "vendedor", pedido_id: "pedido", motivo: "Ajuste", cliente: {}, pedidoAlterado: false, meioAlterado: false, itens: [{ sku: "01887", quantidade: 2 }], entrega: { modo: "retirada", centro_codigo: "SHOW-ROOM" }, observacao: "", meio: "cartao" };
function recorder() {
  const calls: { tipo: string; body: Record<string, unknown> }[] = [];
  return { calls, chamar: async (tipo: string, body: Record<string, unknown>) => { calls.push({ tipo, body }); return { ok: true }; } };
}
test("motivo exige ao menos 3 caracteres antes de qualquer chamada", async () => {
  const r = recorder();
  await expect(salvarAlteracaoBalcao({ ...base, motivo: "ab", pedidoAlterado: true }, r.chamar)).rejects.toThrow("mín. 3 caracteres");
  expect(r.calls).toHaveLength(0);
});
test("cliente primeiro, depois edição única com itens e meio", async () => {
  const r = recorder();
  await salvarAlteracaoBalcao({ ...base, cliente: { telefone: "11999999999" }, pedidoAlterado: true, meioAlterado: true }, r.chamar);
  expect(r.calls.map(c => c.tipo)).toEqual(["balcao_cliente_atualizar", "balcao_editar"]);
  expect(r.calls[0]?.body.cliente).toEqual({ telefone: "11999999999" });
  expect(r.calls[1]?.body).toMatchObject({ fop_profile_id: "vendedor", pedido_id: "pedido", meio: "cartao", itens: base.itens, entrega: base.entrega });
});
test("somente meio usa trocar meio", async () => {
  const r = recorder();
  await salvarAlteracaoBalcao({ ...base, meioAlterado: true, meio: "cartao_maquininha" }, r.chamar);
  expect(r.calls.map(c => c.tipo)).toEqual(["balcao_trocar_meio"]);
  expect(r.calls[0]?.body.meio).toBe("cartao_maquininha");
});
test("cliente e meio juntos não usam troca isolada", async () => {
  const r = recorder();
  await salvarAlteracaoBalcao({ ...base, cliente: { email: "novo@example.com" }, meioAlterado: true }, r.chamar);
  expect(r.calls.map(c => c.tipo)).toEqual(["balcao_cliente_atualizar", "balcao_editar"]);
});
test("edição sem troca preserva meio com null", async () => {
  const r = recorder();
  await salvarAlteracaoBalcao({ ...base, pedidoAlterado: true }, r.chamar);
  expect(r.calls[0]?.body.meio).toBeNull();
});
test("erro no cliente interrompe edição e preserva mensagem", async () => {
  const calls: string[] = [];
  await expect(salvarAlteracaoBalcao({ ...base, cliente: { cpf: "123" }, pedidoAlterado: true }, async tipo => { calls.push(tipo); throw new Error("CPF não pode ser trocado"); })).rejects.toThrow("CPF não pode ser trocado");
  expect(calls).toEqual(["balcao_cliente_atualizar"]);
});