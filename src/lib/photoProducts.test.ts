// @ts-ignore Bun supplies the test runner
import { expect, test } from "bun:test";
import { photoProducts } from "./photoProducts";

test("photo targets exclude null and empty dimensions without changing catalog rows", () => {
  const valid = { colecao: "Jingle Pop", categoria: "Luz e Momento" };
  const rows = [
    { colecao: null, categoria: "Luz e Momento" },
    { colecao: "Spirale", categoria: null },
    { colecao: "  ", categoria: "Luz e Momento" },
    { colecao: "Spirale", categoria: "" },
    valid,
  ];
  const result = photoProducts(rows);
  expect(result).toEqual([valid]);
  expect(result[0]).toBe(valid);
  expect(rows).toHaveLength(5);
  expect(rows[0]?.colecao).toBeNull();
});

test("photo targets retain the same collection in different categories and original names", () => {
  const rows = [
    { colecao: "Spirale", categoria: "Luz e Momento" },
    { colecao: "Spirale", categoria: "Mesa" },
    { colecao: "Quadrillë", categoria: "Mesa" },
  ];
  expect(photoProducts(rows)).toEqual(rows);
});