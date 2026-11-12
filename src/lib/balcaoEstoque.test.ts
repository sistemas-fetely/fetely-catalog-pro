// @ts-ignore — bun:test é fornecido pelo runner do Bun
import { expect, test } from "bun:test";
import { colecoesEstoque, filtrarEstoque, ordenarEstoque, resumoEstoque, type BalcaoEstoqueLinha } from "./balcaoEstoque";

const linhas: BalcaoEstoqueLinha[] = [
  { sku: "SKU-A", cod_cadastro: "01895", nome: "Vela Árvore", colecao_codigo: "NATAL", colecao: "Jingle Pop", disponivel: 12, reservado: 3, centro: "SITE-SP" },
  { sku: "SKU-B", cod_cadastro: "01896", nome: "Vela Estrela", colecao_codigo: "NATAL", colecao: "Jingle Pop", disponivel: 0, reservado: 5, centro: "SITE-SP" },
  { sku: "SKU-C", cod_cadastro: "00200", nome: "Vela Árvore pequena", colecao_codigo: "CLASSIC", colecao: "Classique", disponivel: 8, reservado: 0, centro: "SITE-SP" },
  { sku: "SKU-D", cod_cadastro: null, nome: "Luminária", colecao_codigo: null, colecao: null, disponivel: 2, reservado: 1, centro: "SITE-SP" },
];

test("coleção e busca combinam por E, com seleção de mais de uma coleção", () => {
  expect(filtrarEstoque(linhas, "arvore", ["codigo:NATAL"]).map((linha) => linha.sku)).toEqual(["SKU-A"]);
  expect(filtrarEstoque(linhas, "arvore", ["codigo:NATAL", "codigo:CLASSIC"]).map((linha) => linha.sku)).toEqual(["SKU-A", "SKU-C"]);
  expect(filtrarEstoque(linhas, "Estrela", ["codigo:CLASSIC"])).toEqual([]);
});

test("busca encontra SKU, código de cadastro e nome sem diferenciar acentos ou caixa", () => {
  expect(filtrarEstoque(linhas, "sku-b", []).map((linha) => linha.sku)).toEqual(["SKU-B"]);
  expect(filtrarEstoque(linhas, "01895", []).map((linha) => linha.sku)).toEqual(["SKU-A"]);
  expect(filtrarEstoque(linhas, " LUMINARIA ", []).map((linha) => linha.sku)).toEqual(["SKU-D"]);
});

test("coleções contam SKUs distintos e preservam linhas apenas reservadas e sem coleção", () => {
  expect(colecoesEstoque([...linhas, linhas[0]]).map((colecao) => [colecao.nome, colecao.quantidade])).toEqual([
    ["Classique", 1], ["Jingle Pop", 2], ["Sem coleção", 1],
  ]);
  expect(filtrarEstoque(linhas, "", ["codigo:NATAL"]).map((linha) => linha.disponivel)).toEqual([12, 0]);
});

test("indicadores refletem somente o recorte filtrado e não somam reservas às unidades disponíveis", () => {
  expect(resumoEstoque(filtrarEstoque(linhas, "", ["codigo:NATAL"]))).toEqual({ skus: 2, unidades: 12 });
  expect(resumoEstoque(filtrarEstoque(linhas, "arvore", []))).toEqual({ skus: 2, unidades: 20 });
  expect(resumoEstoque([])).toEqual({ skus: 0, unidades: 0 });
});

test("ordena numericamente por disponível nas duas direções sem alterar a resposta SNCF", () => {
  expect(ordenarEstoque(linhas, { campo: "disponivel", direcao: "desc" }).map((linha) => linha.disponivel)).toEqual([12, 8, 2, 0]);
  expect(ordenarEstoque(linhas, { campo: "disponivel", direcao: "asc" }).map((linha) => linha.disponivel)).toEqual([0, 2, 8, 12]);
  expect(linhas.map((linha) => linha.disponivel)).toEqual([12, 0, 8, 2]);
});

test("ordena por nome e por coleção", () => {
  expect(ordenarEstoque(linhas, { campo: "nome", direcao: "asc" }).map((linha) => linha.sku)).toEqual(["SKU-D", "SKU-A", "SKU-C", "SKU-B"]);
  expect(ordenarEstoque(linhas, { campo: "colecao", direcao: "desc" }).map((linha) => linha.sku)).toEqual(["SKU-A", "SKU-B", "SKU-C", "SKU-D"]);
});