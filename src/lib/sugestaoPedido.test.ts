import { beforeEach, expect, test } from "vitest";
import type { Product } from "@/types";
import { setQuantidadeLivre, halfBox } from "./format";
import {
  aplicarSugestao,
  dicaFaixa,
  elegivelSugestao,
  grupoSugestao,
  montarSugestao,
  montarKits,
  alternativasKit,
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
test("montagem fica abaixo do alvo sem ultrapassar duas vezes a profundidade", () => {
  for (const profundidade of ["meia", "uma", "duas", "personalizado"] as const) {
    const prefs = pref({ profundidade, caixas: 3 });
    const r = montarSugestao(catalogo, [], [], prefs, 1);
    expect(r.total).toBeLessThanOrEqual(2500 * 1.05);
    expect(r.itens.length).toBeGreaterThan(0);
    for (const i of r.itens) {
      expect(i.quantidade).toBeLessThanOrEqual(quantidadeSugestao(i.produto, prefs) * 2);
      expect(i.quantidade % halfBox(i.produto.multiplos)).toBe(0);
    }
  }
});
test("sem kit acessível devolve resultado abaixo do alvo e informa alternativa", () => {
  const r = montarSugestao(catalogo, [], [], pref({ investimento: 1000 }));
  expect(r.total).toBeLessThanOrEqual(1050);
  if (r.total < 950) expect(r.aviso).not.toBeNull();
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
test("seeds diferentes sorteiam kits diferentes até no estilo mais vendidos", () => {
  const rs = catalogo.map((p) => ranking(p, 50));
  const a = montarSugestao(catalogo, rs, [], pref({ estilo: "vendidos" }), 1);
  const b = montarSugestao(catalogo, rs, [], pref({ estilo: "vendidos" }), 2);
  expect(a.kits.map((k) => k.id)).not.toEqual(b.kits.map((k) => k.id));
});
test("espalhar limita a um kit por coleção, sem cortar suas peças", () => {
  const r = montarSugestao(catalogo, [], [], pref({ colecoes: "espalhar" }));
  expect(new Set(r.kits.map((k) => k.colecao)).size).toBe(r.kits.length);
  expect(r.kits.every((k) => k.itens.length === 3)).toBe(true);
});
test("concentrar permite até quatro âncoras sem prender cada grupo a uma coleção", () => {
  const r = montarSugestao(catalogo, [], [], pref());
  expect(new Set(r.kits.map((k) => k.colecao)).size).toBeLessThanOrEqual(4);
  expect(new Set(r.kits.map((k) => k.colecao)).size).toBeGreaterThanOrEqual(2);
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

test("Mesa inclui todos os tamanhos de prato, guardanapos e bandejas da coleção", () => {
  const pecas = [
    produto("p15", { colecao: "Costa Serena", tamanhoNumero: "15" }),
    produto("p21", { colecao: "Costa Serena", tamanhoNumero: "21" }),
    produto("p27", { colecao: "Costa Serena", tamanhoNumero: "27" }),
    produto("g16", { colecao: "Costa Serena", grupo: "Guardanapo" }),
    produto("b", { colecao: "Costa Serena", grupo: "Bandeja" }),
  ];
  const kits = montarKits(pecas, pref());
  expect(kits).toHaveLength(1);
  expect(kits[0]?.itens.map((i) => i.produto.sku).sort()).toEqual([
    "b",
    "g16",
    "p15",
    "p21",
    "p27",
  ]);
  const r = montarSugestao(pecas, [], [], pref());
  expect(r.itens).toHaveLength(5);
  expect(new Set(r.itens.map((i) => i.quantidade)).size).toBe(1);
  expect(r.itens.every((i) => i.quantidade <= 24)).toBe(true);
});
test("cada estampa Mosaïque é uma mesa completa independente", () => {
  const pecas = ["A", "B"].flatMap((estampa) =>
    ["Prato", "Guardanapo"].map((grupo) =>
      produto(`${estampa}${grupo}`, { colecao: "Mosaïque", grupo, estampa }),
    ),
  );
  const kits = montarKits(pecas, pref());
  expect(kits).toHaveLength(2);
  expect(kits.every((k) => k.itens.length === 2)).toBe(true);
});
test("jogo americano agrupa todas as cores; taças e talheres separam por cor", () => {
  for (const grupo of ["Jogo Americano", "Copos e Taças", "Talheres"] as const) {
    const produtos = ["Azul", "Rosa"].flatMap((corNome) =>
      ["90", "150", "260"].map((tamanhoNumero) =>
        produto(`${corNome}${tamanhoNumero}`, {
          colecao: "Lineare",
          grupo,
          corNome,
          tamanhoNumero,
        }),
      ),
    );
    const kits = montarKits(produtos, pref({ grupos: { [grupo]: 1 } }));
    expect(kits).toHaveLength(grupo === "Jogo Americano" ? 1 : 2);
    expect(kits.every((k) => k.itens.length === (grupo === "Jogo Americano" ? 6 : 3))).toBe(true);
  }
});
test("Infantil reúne todos os itens do tema", () => {
  const kits = montarKits(
    ["Prato", "Copo", "Guardanapo"].map((grupo) =>
      produto(grupo, { grupo, categoria: "Imaginar & Celebrar", colecao: "Dinossauros" }),
    ),
    pref({ grupos: { Infantil: 1 } }),
  );
  expect(kits).toHaveLength(1);
  expect(kits[0]?.itens).toHaveLength(3);
});
test("sorteio nunca corta kits para caber no alvo", () => {
  const prefs = pref({ colecoes: "espalhar" });
  const bases = montarKits(catalogo, prefs);
  const resultado = montarSugestao(catalogo, [], [], prefs, 42);
  for (const k of resultado.kits) {
    const base = bases.find((b) => b.id === k.id);
    expect(k.itens.map((i) => i.produto.sku)).toEqual(base?.itens.map((i) => i.produto.sku));
  }
});
test("kits travados preservam itens e quantidades e outra opção muda pelo menos 40% do restante", () => {
  const prefs = pref({ investimento: 1800, colecoes: "espalhar" });
  const a = montarSugestao(catalogo, [], [], prefs, 10);
  const anteriores = a.kits.map((k, i) => ({ ...k, travado: i === 0 }));
  const b = montarSugestao(catalogo, [], [], prefs, 11, { anteriores, regenerar: true });
  expect(b.kits.find((k) => k.travado)).toEqual(anteriores[0]);
  const livres = anteriores.filter((k) => !k.travado);
  const diferentes = livres.filter((k) => !b.kits.some((x) => x.id === k.id));
  expect(diferentes.length / livres.length).toBeGreaterThanOrEqual(0.4);
});
test("recalcular preferências conserva kits que ainda são válidos", () => {
  const prefs = pref({ investimento: 1800, colecoes: "espalhar" });
  const a = montarSugestao(catalogo, [], [], prefs, 10);
  const b = montarSugestao(catalogo, [], [], { ...prefs, investimento: 2100 }, 10, {
    anteriores: a.kits,
  });
  expect(a.kits.every((k) => b.kits.some((x) => x.id === k.id))).toBe(true);
});
test("profundidade só aumenta em kits inteiros com mix esgotado", () => {
  const produtos = [
    produto("a", { colecao: "Única", precoAtacado: 30 }),
    produto("b", { colecao: "Única", grupo: "Guardanapo", precoAtacado: 30 }),
  ];
  const r = montarSugestao(produtos, [], [], pref({ investimento: 1500 }));
  expect(r.itens.map((i) => i.quantidade)).toEqual([24, 24]);
  expect(r.avisosProfundidade).toHaveLength(1);
  expect(r.total).toBe(1440);
});
test("kit não cresce enquanto existem outros kits elegíveis não selecionados", () => {
  const produtos = [
    produto("barato", { precoAtacado: 10 }),
    produto("caro", { precoAtacado: 1000 }),
  ];
  const r = montarSugestao(produtos, [], [], pref());
  expect(r.itens[0]?.quantidade).toBe(12);
  expect(r.avisosProfundidade).toHaveLength(0);
});
test("alternativas pertencem ao mesmo grupo e respeitam o teto de 105%", () => {
  const bases = montarKits(catalogo, pref());
  const atual = bases[0];
  if (!atual) throw new Error("Fixture sem kit");
  const alternativas = alternativasKit(atual, bases, [atual], 1000);
  expect(alternativas.length).toBeGreaterThanOrEqual(3);
  expect(alternativas.length).toBeLessThanOrEqual(5);
  expect(
    alternativas.every((k) => k.grupo === atual.grupo && k.custo <= 1050 && k.id !== atual.id),
  ).toBe(true);
});

test("Mesa Coordenada limita as âncoras a três coleções", () => {
  const r = montarSugestao(catalogo, [], [], pref({ investimento: 10000, limiteAncoras: 3 }));
  expect(new Set(r.kits.filter((k) => k.grupo === "Mesa posta").map((k) => k.colecao)).size).toBe(
    3,
  );
});
test("cada nível extra de duas caixas e personalizado respeita o dobro para todas as peças", () => {
  const produtos = [
    produto("a", { colecao: "Única", precoAtacado: 30 }),
    produto("b", { colecao: "Única", grupo: "Guardanapo", precoAtacado: 30 }),
  ];
  for (const profundidade of ["duas", "personalizado"] as const) {
    const prefs = pref({
      investimento: profundidade === "duas" ? 3000 : 4400,
      profundidade,
      caixas: 3,
    });
    const r = montarSugestao(produtos, [], [], prefs);
    expect(r.itens.every((i) => i.quantidade === quantidadeSugestao(i.produto, prefs) * 2)).toBe(
      true,
    );
    expect(r.total).toBeLessThanOrEqual(prefs.investimento);
  }
});
test("afinidade da mesa considera pratos e guardanapos, não só a primeira peça", () => {
  const kits = montarKits(
    [produto("b", { colecao: "Mesa A", grupo: "Bandeja" }), produto("p", { colecao: "Mesa A" })],
    pref(),
    [],
    [
      {
        colecao_a: "Mesa A",
        grupo_a: "Prato",
        colecao_b: "Taças B",
        grupo_b: "Copos e Taças",
        pedidos_juntos: 20,
        score_afinidade: 80,
      },
    ],
  );
  expect(kits[0]?.afinidades["Taças B"]).toBe(80);
});
