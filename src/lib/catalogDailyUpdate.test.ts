// @ts-ignore Bun supplies the test runner
import { describe, expect, test } from "bun:test";
import { mapDailyResponse, prepareDailyItems } from "./catalogDailyUpdate";
import type { CatalogLists } from "./catalogSpreadsheet";

const lists: CatalogLists = { grupo: [], colecao: [], cor: [], canais: ["b2b", "b2c", "ambos"], categorias: [] };

describe("Atualização diária do catálogo", () => {
  test("mapeia leitura, slug, pendências, sem cadastro e erros", () => {
    const data = mapDailyResponse({ leitura: { hora: "2026-11-08T06:30:00Z", status: "concluida" }, mudancas: [{ id: "a1", cod_cadastro: "02160", slug: "material", valor_base: "A", valor_planilha: "Vidro", valor_sistema: "B", tipo: "conflito" }], sem_cadastro: [{ cod_cadastro: "99999" }], erros: ["Linha 8: valor inválido"] });
    expect(data.leitura?.hora).toBe("2026-11-08T06:30:00Z");
    expect(data.itens[0]).toMatchObject({ id: "a1", campo: "material", tipo: "conflito", valor_planilha: "Vidro" });
    expect(data.semCadastro[0]).toContain("99999");
    expect(data.erros).toEqual(["Linha 8: valor inválido"]);
  });

  test("usa o FOP vivo e transforma divergência posterior em conflito", () => {
    const [entry] = prepareDailyItems([{ id: "1", cod_cadastro: "1", campo: "material", valor_base: "A", valor_planilha: "Novo", valor_sistema: "Antigo", tipo: "mudanca" }], [{ cod_cadastro: "1", material: "Editado no FOP" }], lists, {});
    expect(entry.current).toBe("Editado no FOP");
    expect(entry.drifted).toBe(true);
    expect(entry.change).toBeUndefined();
  });

  test("escolha sistema resolve sem patch e planilha usa a validação do importador", () => {
    const item = { id: "1", cod_cadastro: "1", campo: "peso_g", valor_base: 100, valor_planilha: "120,5", valor_sistema: 100, tipo: "conflito" as const };
    const products = [{ cod_cadastro: "1", peso_g: 100 }];
    expect(prepareDailyItems([item], products, lists, { "1": "sistema" })[0]?.change).toBeUndefined();
    expect(prepareDailyItems([item], products, lists, { "1": "planilha" })[0]?.change?.after).toBe(120.5);
    expect(prepareDailyItems([item], products, lists, { "1": "planilha" })[0]?.change?.field).toBe("peso_g");
  });

  test("não cria produto e recusa fase, ativo, SKU e valor vazio", () => {
    const base = { id: "1", cod_cadastro: "1", campo: "fase", valor_base: "ativo", valor_planilha: "inativo", valor_sistema: "ativo", tipo: "mudanca" as const };
    expect(prepareDailyItems([base], [{ cod_cadastro: "1", fase: "ativo" }], lists, {})[0]?.error).toContain("não gravável");
    expect(prepareDailyItems([{ ...base, cod_cadastro: "404" }], [], lists, {})[0]?.error).toContain("Importação de PI");
    expect(prepareDailyItems([{ ...base, campo: "material", valor_planilha: "" }], [{ cod_cadastro: "1", material: "A" }], lists, { "1": "planilha" })[0]?.error).toContain("vazio");
  });
});
