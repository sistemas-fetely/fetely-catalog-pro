import { beforeEach, expect, test } from "vitest";
import type { Product } from "@/types";
import { setQuantidadeLivre, halfBox } from "./format";
import {
  aplicarSugestao,
  dicaFaixa,
  elegivelSugestao,
  grupoSugestao,
  montarSugestao,
  PREFERENCIAS_PADRAO,
  quantidadeSugestao,
  trocarItemSugestao,
  type PreferenciasSugestao,
  type RankingVenda,
} from "./sugestaoPedido";

const produto = (sku: string, patch: Partial<Product> = {}): Product => ({
  sku,
  codCadastro: sku,
  ean: "",
  marca: "",
  linha: "",
  categoria: "Celebrar à Mesa",
  grupo: "Prato",
  tipo: "",
  familia: "",
  colecao: `Coleção ${sku}`,
  corNome: "Azul",
  cor: "Azul",
  estampa: "",
  tamanhoNumero: "",
  tamanhoRef: "",
  nomeComercial: "Prato",
  material: "",
  materialDescritivo: "",
  pesoG: 0,
  larguraCm: 0,
  alturaCm: 0,
  multiplos: 12,
  qtdKit: 1,
  precoVarejo: 20,
  precoAtacado: 10,
  statusEstoque: "Disponível",
  prontaEntrega: true,
  isVelaNumerica: false,
  ativo: true,
  ...patch,
});
const pref = (patch: Partial<PreferenciasSugestao> = {}): PreferenciasSugestao => ({
  ...PREFERENCIAS_PADRAO,
  grupos: { "Mesa posta": 1 },
  ...patch,
});
const ranking = (p: Product, score: number, receita = 100): RankingVenda => ({
  sku: p.sku,
  colecao: p.colecao,
  grupo: p.grupo,
  categoria: p.categoria,
  pedidos_distintos: 1,
  clientes_distintos: 1,
  unidades_vendidas: 12,
  receita,
  caixas_medias_por_pedido: 1,
  score_popularidade: score,
  score_recencia: 100,
  participacao_receita_grupo: 1,
});
const catalogo = Array.from({ length: 60 }, (_, i) =>
  produto(`P${String(i).padStart(2, "0")}`, {
    colecao: `Coleção ${Math.floor(i / 3)}`,
    corNome: `Cor ${i % 3}`,
  }),
);
beforeEach(() => setQuantidadeLivre(false));
test("preferências iniciais são R$ 2.500, uma caixa e todos os grupos menos Infantil", () => {
  expect(PREFERENCIAS_PADRAO.investimento).toBe(2500);
  expect(PREFERENCIAS_PADRAO.profundidade).toBe("uma");
  expect(Object.keys(PREFERENCIAS_PADRAO.grupos)).toHaveLength(5);
  expect(PREFERENCIAS_PADRAO.grupos.Infantil).toBeUndefined();
});
test("nunca inclui inativo, esgotado ou sem preço atacado", () => {
  expect(elegivelSugestao(produto("a", { ativo: false }), pref())).toBe(false);
  expect(elegivelSugestao(produto("b", { statusEstoque: "Esgotado" }), pref())).toBe(false);
  expect(elegivelSugestao(produto("c", { precoAtacado: 0 }), pref())).toBe(false);
});
test("pronta entrega só filtra quando marcada", () => {
  const p = produto("a", { prontaEntrega: false });
  expect(elegivelSugestao(p, pref())).toBe(true);
  expect(elegivelSugestao(p, pref({ prontaEntrega: true }))).toBe(false);
});
test("coleção excluída nunca entra mesmo se preferida", () =>
  expect(
    elegivelSugestao(produto("a"), pref({ excluidas: ["Coleção a"], preferidas: ["Coleção a"] })),
  ).toBe(false));
test("Mesa posta não inclui pratos infantis", () =>
  expect(grupoSugestao(produto("a", { categoria: "Imaginar & Celebrar" }))).toBe("Infantil"));
test("profundidades seguem meia caixa, 1 caixa, 2 caixas e caixas personalizadas", () => {
  const p = produto("a");
  expect(quantidadeSugestao(p, pref({ profundidade: "meia" }))).toBe(6);
  expect(quantidadeSugestao(p, pref())).toBe(12);
  expect(quantidadeSugestao(p, pref({ profundidade: "duas" }))).toBe(24);
  expect(quantidadeSugestao(p, pref({ profundidade: "personalizado", caixas: 3 }))).toBe(36);
});
test("meia caixa ímpar segue halfBox sem quantidade fracionária", () =>
  expect(quantidadeSugestao(produto("a", { multiplos: 5 }), pref({ profundidade: "meia" }))).toBe(
    5,
  ));
test("seed e preferências iguais produzem a mesma sugestão", () =>
  expect(montarSugestao(catalogo, [], [], pref(), 4)).toEqual(
    montarSugestao(catalogo, [], [], pref(), 4),
  ));
test("orçamento padrão alcança 95–105% de R$ 2.500 com quantidades válidas", () => {
  const r = montarSugestao(catalogo, [], [], pref(), 1);
  expect(r.atingiuAlvo).toBe(true);
  expect(r.total).toBeGreaterThanOrEqual(2375);
  expect(r.total).toBeLessThanOrEqual(2625);
  expect(r.itens.every((i) => i.quantidade % halfBox(i.produto.multiplos) === 0)).toBe(true);
});
test("pedido mínimo não fica abaixo de R$ 1.000 quando há mix possível", () => {
  const r = montarSugestao(catalogo, [], [], pref({ investimento: 1000 }));
  expect(r.total).toBeGreaterThanOrEqual(1000);
  expect(r.total).toBeLessThanOrEqual(1050);
});
test("mix impossível sinaliza inviabilidade sem inventar itens", () => {
  const r = montarSugestao(
    [produto("a", { precoAtacado: 500 })],
    [],
    [],
    pref({ investimento: 1000 }),
  );
  expect(r.atingiuAlvo).toBe(false);
  expect(r.itens).toHaveLength(0);
  expect(r.aviso).not.toBeNull();
});
test("mais vendidos prioriza score de popularidade", () => {
  const rs = catalogo.map((p, i) => ranking(p, i));
  const r = montarSugestao(catalogo, rs, [], pref({ estilo: "vendidos", colecoes: "espalhar" }));
  expect(r.itens[0]?.produto.sku).toBe("P59");
});
test("espalhar limita a dois SKUs não numéricos por coleção", () => {
  const r = montarSugestao(catalogo, [], [], pref({ colecoes: "espalhar" }));
  const counts = new Map<string, number>();
  for (const i of r.itens) counts.set(i.produto.colecao, (counts.get(i.produto.colecao) ?? 0) + 1);
  expect([...counts.values()].every((n) => n <= 2)).toBe(true);
  expect(counts.size).toBeGreaterThan(1);
});
test("coleções preferidas recebem prioridade em concentrar", () => {
  const r = montarSugestao(catalogo, [], [], pref({ preferidas: ["Coleção 12"] }));
  expect(r.itens.slice(0, 3).some((i) => i.produto.colecao === "Coleção 12")).toBe(true);
});
test("concentrar mantém mesa em até três coleções âncora", () => {
  const r = montarSugestao(catalogo, [], [], pref());
  expect(new Set(r.itens.map((i) => i.produto.colecao)).size).toBeLessThanOrEqual(3);
  expect(r.total).toBeGreaterThanOrEqual(2375);
});
test("âncora de velas cabe no orçamento do grupo sem descartar todas as velas", () => {
  const numericas = Array.from({ length: 10 }, (_, n) =>
    produto(`V${n}`, {
      nomeComercial: `Vela ${n}`,
      categoria: "Luz e Momento",
      grupo: "Vela",
      colecao: "Grade cara",
      isVelaNumerica: true,
      numeroVela: n,
      precoAtacado: 50,
    }),
  );
  const simples = produto("Decorativa", {
    categoria: "Luz e Momento",
    grupo: "Vela",
    colecao: "Linha acessível",
    precoAtacado: 10,
  });
  const todos = [...catalogo, ...numericas, simples];
  const rs = todos.map((p) => ranking(p, p.isVelaNumerica ? 100 : 10));
  const r = montarSugestao(todos, rs, [], pref({ grupos: { "Mesa posta": 1, Velas: 1 } }));
  expect(r.itens.some((i) => i.produto.sku === "Decorativa")).toBe(true);
});
test("troca normaliza quantidade à meia caixa do próximo produto", () => {
  const a = produto("a");
  const b = produto("b", { multiplos: 10 });
  const next = trocarItemSugestao(
    [{ produto: a, quantidade: 12, motivo: "Top" }],
    "a",
    [a, b],
    [],
    pref(),
  );
  expect((next[0]?.quantidade ?? 1) % 5).toBe(0);
});
test("receita histórica e peso Muito distribuem mais orçamento para o grupo", () => {
  const mesa = catalogo.slice(0, 30);
  const copos = catalogo.slice(30).map((p) => ({ ...p, grupo: "Copos e Taças" }));
  const rs = [...mesa.map((p) => ranking(p, 50, 100)), ...copos.map((p) => ranking(p, 50, 300))];
  const r = montarSugestao(
    [...mesa, ...copos],
    rs,
    [],
    pref({ grupos: { "Mesa posta": 0.5, "Copos e Taças": 2 } }),
  );
  const valor = (g: string) =>
    r.itens
      .filter((i) => i.produto.grupo === g)
      .reduce((s, i) => s + i.quantidade * i.produto.precoAtacado, 0);
  expect(valor("Copos e Taças")).toBeGreaterThan(valor("Prato"));
});
test("velas numéricas entram com grade completa 0–9", () => {
  const velas = Array.from({ length: 10 }, (_, n) =>
    produto(`V${n}`, {
      nomeComercial: `Vela ${n}`,
      categoria: "Luz e Momento",
      grupo: "Vela",
      colecao: "Jingle Pop",
      isVelaNumerica: true,
      numeroVela: n,
      precoAtacado: 10,
    }),
  );
  const r = montarSugestao(velas, [], [], pref({ investimento: 1200, grupos: { Velas: 1 } }));
  expect(r.itens.map((i) => i.produto.numeroVela).sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(r.total).toBe(1200);
});
test("grade incompleta nunca sugere números soltos", () => {
  const velas = Array.from({ length: 9 }, (_, n) =>
    produto(`V${n}`, {
      categoria: "Luz e Momento",
      grupo: "Vela",
      colecao: "Jingle Pop",
      isVelaNumerica: true,
      numeroVela: n,
    }),
  );
  expect(montarSugestao(velas, [], [], pref({ grupos: { Velas: 1 } })).itens).toHaveLength(0);
});
test("produto sem histórico é marcado Novidade no mesclado", () =>
  expect(
    montarSugestao(catalogo, [], [], pref({ estilo: "mesclado" })).itens.every(
      (i) => i.motivo === "Novidade",
    ),
  ).toBe(true));
test("somar sugestão preserva carrinho atual sem mutação", () => {
  const cart = { a: 6, b: 3 };
  const itens = [{ produto: produto("a"), quantidade: 12, motivo: "Top" }];
  expect(aplicarSugestao(cart, itens, false)).toEqual({ a: 18, b: 3 });
  expect(cart).toEqual({ a: 6, b: 3 });
});
test("substituir elimina itens anteriores e mantém quantidades da sugestão", () =>
  expect(
    aplicarSugestao({ b: 10 }, [{ produto: produto("a"), quantidade: 12, motivo: "Top" }], true),
  ).toEqual({ a: 12 }));
test("trocar mantém grupo e quantidade e evita SKU já escolhido", () => {
  const a = produto("a");
  const b = produto("b");
  const c = produto("c", { grupo: "Talheres" });
  const itens = [{ produto: a, quantidade: 24, motivo: "Top" }];
  const next = trocarItemSugestao(itens, "a", [a, b, c], [ranking(b, 100)], pref());
  expect(next[0]?.produto.sku).toBe("b");
  expect(next[0]?.quantidade).toBe(24);
});
test("dica aparece até 15% abaixo da próxima faixa e mostra desconto incremental", () => {
  const faixas = [
    { nome: "Convidado", valor_min: 1000, valor_max: 4999.99, desconto_celebra: 0, frete: "FOB" },
    { nome: "Anfitrião", valor_min: 5000, valor_max: 9999.99, desconto_celebra: 3, frete: "FOB" },
  ];
  expect(dicaFaixa(4250, faixas)).toMatchObject({ falta: 750, descontoExtra: 3 });
  expect(dicaFaixa(4249, faixas)).toBeNull();
});
