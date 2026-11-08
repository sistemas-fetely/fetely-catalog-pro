import { expect, test } from "bun:test";
import type { DailyPrepared } from "./catalogDailyUpdate";
import { filterDailyEntries, groupDailyProducts, scopedDailySelection, DAILY_PAGE_SIZE } from "./catalogDailyView";

const entries: DailyPrepared[] = [
  { item: { id: "a", cod_cadastro: "02160", campo: "material", tipo: "mudanca", valor_base: "A", valor_sistema: "A", valor_planilha: "B" }, product: { nome_comercial: "Vela Natal" }, drifted: false },
  { item: { id: "b", cod_cadastro: "02160", campo: "peso_g", tipo: "conflito", valor_base: 1, valor_sistema: 2, valor_planilha: 3 }, product: { nome_comercial: "Vela Natal" }, drifted: false },
  { item: { id: "c", cod_cadastro: "02161", campo: "material", tipo: "mudanca", valor_base: "A", valor_sistema: "A", valor_planilha: "" }, product: { nome_comercial: "Vela azul" }, drifted: false, error: "Vazio" },
];
test("seleção por produto contabiliza suas células", () => {
  const products = groupDailyProducts(entries);
  expect(products).toHaveLength(2);
  expect(products[0]?.entries.map(entry => entry.item.id)).toEqual(["a", "b"]);
});
test("filtro de campo restringe IDs enviados às ações", () => {
  const visible = filterDailyEntries(entries, "material", "todos", "");
  expect([...scopedDailySelection(visible, new Set(["a", "b", "c"]))]).toEqual(["a", "c"]);
});
test("filtros de tipo e busca por código/nome restringem células", () => {
  expect(filterDailyEntries(entries, "todos", "conflito", "natal").map(entry => entry.item.id)).toEqual(["b"]);
  expect(filterDailyEntries(entries, "todos", "erro", "02161").map(entry => entry.item.id)).toEqual(["c"]);
});
test("fila de 3400 células e 1200 produtos tem páginas limitadas", () => {
  const large = Array.from({ length: 3400 }, (_, i) => ({ ...entries[0], item: { ...entries[0].item, id: String(i), cod_cadastro: String(i % 1200) } })) as DailyPrepared[];
  const products = groupDailyProducts(large);
  expect(products).toHaveLength(1200);
  expect(products.slice(0, DAILY_PAGE_SIZE)).toHaveLength(25);
  expect(Math.ceil(products.length / DAILY_PAGE_SIZE)).toBe(48);
});