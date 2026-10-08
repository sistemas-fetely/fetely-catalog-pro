// @ts-ignore — bun:test é fornecido pelo runner do Bun
import { describe, expect, test } from "bun:test";
import { motivosRegua, sugerirNegociacao, resumoComercial, type CrmStage } from "./crm";

const st = (nome: string, prazo: number | null, encerrado = false): CrmStage => ({ id: nome, nome, ordem: 1, prazo_max_dias: prazo, encerrado, cor: "#000" });
const HOJE = "2026-10-20";

describe("régua do CRM", () => {
  test("próxima ação antes de hoje = ação vencida", () => {
    expect(motivosRegua({ proxima_acao_data: "2026-10-19", stage_desde: HOJE }, st("Primeiro contato", 10), HOJE)).toEqual(["ação vencida"]);
  });
  test("dias no estágio acima do prazo", () => {
    expect(motivosRegua({ proxima_acao_data: null, stage_desde: "2026-10-08" }, st("Primeiro contato", 10), HOJE)).toEqual(["12d no estágio"]);
  });
  test("no prazo exato não alerta", () => {
    expect(motivosRegua({ proxima_acao_data: HOJE, stage_desde: "2026-10-10" }, st("Primeiro contato", 10), HOJE)).toEqual([]);
  });
  test("Agenda marcada com reunião passada = registrar resultado", () => {
    expect(motivosRegua({ proxima_acao_data: "2026-10-18", stage_desde: "2026-09-01" }, st("Agenda marcada", null), HOJE)).toEqual(["registrar resultado"]);
  });
  test("vários motivos juntos", () => {
    expect(motivosRegua({ proxima_acao_data: "2026-10-01", stage_desde: "2026-10-01" }, st("Apresentado", 7), HOJE)).toEqual(["ação vencida", "19d no estágio"]);
  });
  test("estágio encerrado nunca alerta", () => {
    expect(motivosRegua({ proxima_acao_data: "2026-01-01", stage_desde: "2026-01-01" }, st("Perdido", null, true), HOJE)).toEqual([]);
  });
});

describe("Parte 3 — comercial", () => {
  const stages: CrmStage[] = ["Primeiro contato", "Aguardando data", "Agenda marcada", "Apresentado", "Em negociação", "Cadastro ou amostra"]
    .map((n, i) => ({ id: n, nome: n, ordem: i + 1, prazo_max_dias: null, encerrado: false, cor: "#000" }));
  test("sugere Em negociação só antes do estágio e com cotação aberta", () => {
    expect(sugerirNegociacao(stages[3], stages, true)).toBe(true);
    expect(sugerirNegociacao(stages[4], stages, true)).toBe(false);
    expect(sugerirNegociacao(stages[5], stages, true)).toBe(false);
    expect(sugerirNegociacao(stages[0], stages, false)).toBe(false);
  });
  test("resumo soma pedidos e conta só cotações aberta/em_negociacao", () => {
    const r = resumoComercial({
      pedidos: [{ id: "P1", cliente_id: "c", data: "2026-01-01", status: null, total: 100 }, { id: "P2", cliente_id: "c", data: "2026-02-01", status: null, total: 50 }, { id: "X", cliente_id: "outro", data: "2026-03-01", status: null, total: 999 }],
      cotacoes: [{ id: "C1", cliente_id: "c", data: "2026-01-01", status: "aberta", total: 1 }, { id: "C2", cliente_id: "c", data: "2026-01-02", status: "em_negociacao", total: 1 }, { id: "C3", cliente_id: "c", data: "2026-01-03", status: "perdida", total: 1 }],
    }, "c");
    expect(r.totalPedidos).toBe(150);
    expect(r.ultimoPedido).toBe("2026-02-01");
    expect(r.pedidos[0].id).toBe("P2");
    expect(r.cotacoesAbertas).toBe(2);
  });
});
