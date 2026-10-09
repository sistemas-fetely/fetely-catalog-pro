// @ts-ignore — bun:test é fornecido pelo runner do Bun
import { describe, expect, test } from "bun:test";
import { calcClasse, calcNivel, temperatura, faltaParaAvancar, sugerirTarefa, preencherFrase, alertasLead, type LeadRegras } from "./crmFases";

const base: LeadRegras = {
  cnpj: "12.345.678/0001-90", numero_lojas: null, faturamento_esperado_mes: null, segmento: null, em_que_pe_ficou: null, tier_a: false,
  visita_em: null, catalogo_enviado_em: null, toque_d2_feito: false, valor_estimado: null, comissao_registrada: false, pago_em: null,
  forma_pagamento: null, motivo_nao_agora: null, retomar_em: null, ultimo_toque_em: null, stage_desde: "2026-10-09",
  amostra: false, cadastro_fornecedor: false, cliente_id: null, sell_out_em: null,
};
const HOJE = "2026-10-09";

describe("classe", () => {
  test("3 lojas e R$ 2.000 → A", () => expect(calcClasse(3, 2000, base.cnpj)).toBe("A"));
  test("1 loja e R$ 1.000 → C", () => expect(calcClasse(1, 1000, base.cnpj)).toBe("C"));
  test("sem CNPJ → C", () => expect(calcClasse(5, 9000, null)).toBe("C"));
  test("1 loja e R$ 2.000 → B", () => expect(calcClasse(1, 2000, base.cnpj)).toBe("B"));
  test("a partir de R$ 5.000 → A", () => expect(calcClasse(1, 5000, base.cnpj)).toBe("A"));
});

describe("nível e temperatura", () => {
  test("fase 2 sem ficha = Lead; com ficha = MQL", () => {
    expect(calcNivel("2", base)).toBe("Lead");
    expect(calcNivel("2", { ...base, numero_lojas: 1, segmento: "Empório", faturamento_esperado_mes: 1000, em_que_pe_ficou: "Pediu preço" })).toBe("MQL");
  });
  test("fase 5 pago = CLIENTE; X = NUTRIÇÃO", () => {
    expect(calcNivel("5", { ...base, pago_em: HOJE })).toBe("CLIENTE");
    expect(calcNivel("X", base)).toBe("NUTRIÇÃO");
  });
  test("temperatura: 7d quente, 8d morno, 22d frio", () => {
    expect(temperatura("2026-10-02", HOJE)).toBe("Quente");
    expect(temperatura("2026-10-01", HOJE)).toBe("Morno");
    expect(temperatura("2026-09-17", HOJE)).toBe("Frio");
  });
});

describe("avanço", () => {
  test("fase 4 não avança sem valor estimado", () => {
    expect(faltaParaAvancar("4", { ...base, cliente_id: "c" }, { temPedido: true })).toEqual(["valor estimado"]);
  });
  test("fase 4 em Tier A não avança sem comissão registrada", () => {
    expect(faltaParaAvancar("4", { ...base, tier_a: true, valor_estimado: 3000, cliente_id: "c" }, { temPedido: true })).toEqual(["regra de comissão registrada"]);
    expect(faltaParaAvancar("4", { ...base, tier_a: true, valor_estimado: 3000, comissao_registrada: true, cliente_id: "c" }, { temPedido: true })).toEqual([]);
  });
  test("Não vai agora exige motivo e data", () => {
    expect(faltaParaAvancar("X", base, { temPedido: false })).toEqual(["motivo", "data para retomar"]);
  });
  test("fase 0 exige data da visita", () => {
    expect(faltaParaAvancar("0", base, { temPedido: false })).toEqual(["data e hora da visita"]);
  });
});

describe("sugestões e alertas", () => {
  test("fase 0 sugere Ligar (rep) em 3 dias; fase 2 Enviar catálogo (gestão) hoje", () => {
    expect(sugerirTarefa("0", base, HOJE)).toEqual({ tipo: "Ligar", vence_em: "2026-10-12", responsavel: "Representante" });
    expect(sugerirTarefa("2", base, HOJE)).toEqual({ tipo: "Enviar catálogo", vence_em: HOJE, responsavel: "Gestão" });
  });
  test("pós-venda: Ver gôndola 30 dias após o pagamento", () => {
    expect(sugerirTarefa("6", { ...base, pago_em: "2026-10-01" }, HOJE).vence_em).toBe("2026-10-31");
  });
  test("visita feita há +24h sem ficha gera alerta", () => {
    expect(alertasLead("2", { ...base, stage_desde: "2026-10-08" }, null, HOJE)).toEqual(["visita sem ficha há +24h"]);
  });
  test("tarefa vencida gera alerta", () => {
    expect(alertasLead("3", base, "2026-10-08", HOJE)).toEqual(["tarefa vencida"]);
  });
  test("frase substitui variáveis", () => {
    expect(preencherFrase("Oi [nome], aqui é [rep].", { nome: "Ana", rep: "Lucia" })).toBe("Oi Ana, aqui é Lucia.");
  });
});
