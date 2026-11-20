// @ts-expect-error — bun:test is supplied by the existing test runner.
import { expect, test } from "bun:test";
import {
  CD_SITE_SP,
  cobreEmAlgumCd,
  linhaSaldoBusca,
  saldoScDo,
  seloSaldoB2c,
  type BalcaoProduto,
} from "./types";

const produto = (campos: Partial<BalcaoProduto> = {}): BalcaoProduto => ({
  sku: "100",
  cod_cadastro: "100",
  ean: null,
  nome: "Vela",
  preco_varejo: 10,
  disponivel: 0,
  disponivel_site_sp: 0,
  disponivel_sc: 0,
  colecao: "Velas",
  cor_nome: "Branco",
  ...campos,
});

test("cobreEmAlgumCd accepts the CD balance or the XPM SC balance", () => {
  expect(cobreEmAlgumCd(produto({ disponivel: 5, disponivel_sc: 0 }), 5)).toBe(true);
  expect(cobreEmAlgumCd(produto({ disponivel: 0, disponivel_sc: 5 }), 5)).toBe(true);
  expect(cobreEmAlgumCd(produto({ disponivel: 4, disponivel_sc: 4 }), 5)).toBe(false);
  expect(cobreEmAlgumCd(produto({ disponivel: 2 }), 1)).toBe(true);
});

test("missing disponivel_sc is read as zero and never breaks the check", () => {
  const p = produto();
  delete p.disponivel_sc;
  expect(saldoScDo(p)).toBe(0);
  expect(cobreEmAlgumCd(p, 1)).toBe(false);
});

test("Site SP badge: green when SP covers, blue when only SC covers, yellow when neither", () => {
  expect(
    seloSaldoB2c(produto({ disponivel: 6, disponivel_sc: 0 }), 5, CD_SITE_SP, "Site SP"),
  ).toEqual({ rotulo: "SP: 6 disp.", classe: "border-success/40 bg-success/10 text-success" });
  expect(
    seloSaldoB2c(produto({ disponivel: 2, disponivel_sc: 9 }), 5, CD_SITE_SP, "Site SP"),
  ).toEqual({
    rotulo: "Sem saldo em SP — SC cobre (9)",
    classe: "border-info/40 bg-info/10 text-info",
  });
  expect(
    seloSaldoB2c(produto({ disponivel: 0, disponivel_sc: 1 }), 5, CD_SITE_SP, "Site SP"),
  ).toEqual({
    rotulo: "Sem saldo em SP e SC",
    classe: "border-warning/50 bg-warning/10 text-warning",
  });
});

test("Show Room and Evento keep only the selected CD balance", () => {
  expect(
    seloSaldoB2c(produto({ disponivel: 3, disponivel_sc: 99 }), 5, "SHOW-ROOM", "Show Room"),
  ).toEqual({
    rotulo: "Sem saldo no Show Room",
    classe: "border-warning/50 bg-warning/10 text-warning",
  });
  expect(seloSaldoB2c(produto({ disponivel: 5, disponivel_sc: 0 }), 5, "EVENTO", "Evento")).toEqual(
    { rotulo: "Evento: 5 disp.", classe: "border-success/40 bg-success/10 text-success" },
  );
});

test("search list shows both balances only for Site SP", () => {
  expect(linhaSaldoBusca(produto({ disponivel: 4, disponivel_sc: 7 }), CD_SITE_SP, "Site SP")).toBe(
    "SP: 4 · SC: 7 disp.",
  );
  expect(linhaSaldoBusca(produto({ disponivel: 4, disponivel_sc: 7 }), "EVENTO", "Evento")).toBe(
    "Evento: 4 disp.",
  );
});
