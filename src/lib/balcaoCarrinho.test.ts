// @ts-expect-error — bun:test is supplied by the existing test runner.
import { expect, test } from "bun:test";
import {
  itensIniciaisDoCarrinho,
  resolverItensDoCarrinho,
  validarItensIniciais,
} from "./balcaoCarrinho";
import type { BalcaoProduto } from "../components/balcao/types";

const produto: BalcaoProduto = {
  sku: "GDNRETGD.AG.20/01472",
  nome: "Produto",
  preco_varejo: 79,
  cod_cadastro: "01472",
  ean: null,
  colecao: "Coleção",
  cor_nome: "Cor",
  disponivel: 10,
};

test("cart projection copies SKU and unit quantity only and leaves the original untouched", () => {
  const items = [
    { sku: produto.sku, quantity: 3, precoB2b: 12 },
    { sku: "PREV", quantity: 2, provisao: true },
  ];
  const original = JSON.stringify(items);
  expect(itensIniciaisDoCarrinho(items)).toEqual([
    { sku: produto.sku, quantidade: 3 },
    { sku: "PREV", quantidade: 2 },
  ]);
  expect(JSON.stringify(items)).toBe(original);
});
test("cart projection ignores zero, negative and nonfinite quantities", () => {
  expect(
    itensIniciaisDoCarrinho(
      [0, -1, NaN, Infinity, 2].map((quantity) => ({ sku: "SKU", quantity })),
    ),
  ).toEqual([{ sku: "SKU", quantidade: 2 }]);
});
test("storage input rejects invalid shapes and nonpositive quantities", () => {
  expect(
    validarItensIniciais([
      { sku: "SKU", quantidade: 2 },
      { sku: "SKU", quantidade: 0 },
      null,
      { sku: 2, quantidade: 1 },
    ]),
  ).toEqual([{ sku: "SKU", quantidade: 2 }]);
  expect(validarItensIniciais({})).toEqual([]);
});
test("resolution uses exact SNCF SKU and retail price with cart quantity", async () => {
  const r = await resolverItensDoCarrinho([{ sku: produto.sku, quantidade: 3 }], async () => [
    { ...produto, sku: "OTHER" },
    produto,
  ]);
  expect(r.itens).toEqual([{ ...produto, quantidade: 3 }]);
  expect(r.indisponiveis).toEqual([]);
});
test("missing, inactive and missing retail price are reported individually", async () => {
  const r = await resolverItensDoCarrinho(
    ["MISSING", "INACTIVE", "NO_PRICE"].map((sku) => ({ sku, quantidade: 1 })),
    async (sku) =>
      sku === "MISSING"
        ? []
        : [
            {
              ...produto,
              sku,
              ativo: sku !== "INACTIVE",
              preco_varejo: sku === "NO_PRICE" ? 0 : 79,
            },
          ],
  );
  expect(r.itens).toEqual([]);
  expect(r.indisponiveis).toEqual(["MISSING", "INACTIVE", "NO_PRICE"]);
});
test("zero or insufficient SNCF stock retains full requested quantity", async () => {
  for (const disponivel of [0, 2]) {
    const r = await resolverItensDoCarrinho([{ sku: produto.sku, quantidade: 3 }], async () => [
      { ...produto, disponivel },
    ]);
    expect(r.itens[0]?.quantidade).toBe(3);
    expect(r.itens[0]?.disponivel).toBe(disponivel);
    expect(r.indisponiveis).toEqual([]);
  }
});
test("one SNCF failure preserves other items and the original error", async () => {
  const r = await resolverItensDoCarrinho(
    [
      { sku: "FAIL", quantidade: 1 },
      { sku: produto.sku, quantidade: 2 },
    ],
    async (sku) => {
      if (sku === "FAIL") throw new Error("SNCF indisponível");
      return [produto];
    },
  );
  expect(r.itens[0]?.sku).toBe(produto.sku);
  expect(r.indisponiveis).toEqual(["FAIL"]);
  expect(r.erros).toEqual(["FAIL: SNCF indisponível"]);
});
