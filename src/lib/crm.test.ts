// @ts-ignore — bun:test é fornecido pelo runner do Bun
import { describe, expect, test } from "bun:test";
import { motivosRegua, type CrmStage } from "./crm";

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
