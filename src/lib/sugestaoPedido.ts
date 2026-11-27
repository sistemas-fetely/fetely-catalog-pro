import type { Product } from "@/types";
import { halfBox } from "@/lib/format";

export const GRUPOS_SUGESTAO = [
  "Mesa posta",
  "Copos e Taças",
  "Jogo Americano",
  "Talheres",
  "Velas",
  "Infantil",
] as const;
export type GrupoSugestao = (typeof GRUPOS_SUGESTAO)[number];
export interface PreferenciasSugestao {
  investimento: number;
  grupos: Partial<Record<GrupoSugestao, number>>;
  profundidade: "meia" | "uma" | "duas" | "personalizado";
  caixas: number;
  estilo: "vendidos" | "equilibrado" | "mesclado";
  colecoes: "concentrar" | "espalhar";
  preferidas: string[];
  excluidas: string[];
  prontaEntrega: boolean;
}
export interface RankingVenda {
  sku: string;
  colecao: string;
  grupo: string;
  categoria: string;
  pedidos_distintos: number;
  clientes_distintos: number;
  unidades_vendidas: number;
  receita: number;
  caixas_medias_por_pedido: number;
  score_popularidade: number;
  score_recencia: number;
  participacao_receita_grupo: number;
}
export interface AfinidadeColecao {
  colecao_a: string;
  grupo_a: string;
  colecao_b: string;
  grupo_b: string;
  pedidos_juntos: number;
  score_afinidade: number;
}
export interface FaixaSugestao {
  nome: string;
  valor_min: number;
  valor_max: number | null;
  desconto_celebra: number;
  frete: string;
}
export interface ItemSugestao {
  produto: Product;
  quantidade: number;
  motivo: string;
}
export interface OrigemSugestao {
  preferencias: PreferenciasSugestao;
  seed: number;
  skus: string[];
}
export interface ResultadoSugestao {
  itens: ItemSugestao[];
  total: number;
  atingiuAlvo: boolean;
  aviso: string | null;
}
export const PREFERENCIAS_PADRAO: PreferenciasSugestao = {
  investimento: 2500,
  grupos: { "Mesa posta": 1, "Copos e Taças": 1, "Jogo Americano": 1, Talheres: 1, Velas: 1 },
  profundidade: "uma",
  caixas: 1,
  estilo: "equilibrado",
  colecoes: "concentrar",
  preferidas: [],
  excluidas: [],
  prontaEntrega: false,
};
export function grupoSugestao(p: Pick<Product, "categoria" | "grupo">): GrupoSugestao | null {
  if (p.categoria === "Imaginar & Celebrar") return "Infantil";
  if (p.categoria === "Luz e Momento") return "Velas";
  if (p.categoria !== "Celebrar à Mesa") return null;
  if (["Prato", "Bandeja", "Guardanapo"].includes(p.grupo)) return "Mesa posta";
  return GRUPOS_SUGESTAO.find((g) => g === p.grupo) ?? null;
}
export function elegivelSugestao(p: Product, pref: PreferenciasSugestao): boolean {
  const grupo = grupoSugestao(p);
  return (
    p.ativo !== false &&
    Number.isFinite(p.precoAtacado) &&
    p.precoAtacado > 0 &&
    p.statusEstoque?.trim().toLocaleLowerCase("pt-BR") !== "esgotado" &&
    (!pref.prontaEntrega || p.prontaEntrega === true) &&
    !!grupo &&
    (pref.grupos[grupo] ?? 0) > 0 &&
    !pref.excluidas.includes(p.colecao)
  );
}
export function quantidadeSugestao(p: Product, pref: PreferenciasSugestao): number {
  const mult = Math.max(1, Math.round(p.multiplos || 1));
  const step = halfBox(mult);
  if (pref.profundidade === "meia") return step;
  const caixas =
    pref.profundidade === "duas"
      ? 2
      : pref.profundidade === "personalizado"
        ? Math.max(1, Math.round(pref.caixas))
        : 1;
  return Math.ceil((mult * caixas) / step) * step;
}
export function totalSugestao(itens: ItemSugestao[]): number {
  return itens.reduce((s, i) => s + i.quantidade * i.produto.precoAtacado, 0);
}
export function faixaSugestao(valor: number, faixas: FaixaSugestao[]): FaixaSugestao | undefined {
  return [...faixas].sort((a, b) => b.valor_min - a.valor_min).find((f) => valor >= f.valor_min);
}
export function dicaFaixa(
  valor: number,
  faixas: FaixaSugestao[],
): { falta: number; faixa: FaixaSugestao; descontoExtra: number } | null {
  const atual = faixaSugestao(valor, faixas);
  const proxima = [...faixas]
    .sort((a, b) => a.valor_min - b.valor_min)
    .find((f) => f.valor_min > valor);
  return proxima && proxima.valor_min - valor <= proxima.valor_min * 0.15
    ? {
        falta: proxima.valor_min - valor,
        faixa: proxima,
        descontoExtra: proxima.desconto_celebra - (atual?.desconto_celebra ?? 0),
      }
    : null;
}
function jitter(sku: string, seed: number): number {
  let h = seed | 0;
  for (const c of sku) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}
function gradeKey(p: Product): string {
  return `${p.colecao}|${p.linha}|${p.nomeComercial.replace(/\b[0-9]\b/g, "")}|${p.corNome}|${p.tamanhoRef}`;
}
export function montarSugestao(
  produtos: Product[],
  ranking: RankingVenda[],
  afinidades: AfinidadeColecao[],
  pref: PreferenciasSugestao,
  seed = 1,
): ResultadoSugestao {
  const alvo = Math.max(1000, Math.min(30000, pref.investimento || 2500));
  const teto = alvo * 1.05;
  const historico = new Map(ranking.map((r) => [r.sku, r]));
  const elegiveis = produtos.filter((p) => elegivelSugestao(p, pref));
  const grades = new Map<string, Product[]>();
  for (const p of elegiveis.filter((p) => p.isVelaNumerica)) {
    const key = gradeKey(p);
    const arr = grades.get(key) ?? [];
    arr.push(p);
    grades.set(key, arr);
  }
  const candidatos: Product[][] = [];
  const vistos = new Set<string>();
  for (const p of elegiveis) {
    if (!p.isVelaNumerica) {
      candidatos.push([p]);
      continue;
    }
    const key = gradeKey(p);
    if (vistos.has(key)) continue;
    vistos.add(key);
    const arr = grades.get(key) ?? [];
    const grade = Array.from({ length: 10 }, (_, n) =>
      arr.find((x) => (x.numeroVela ?? Number(x.tamanhoNumero)) === n),
    );
    if (grade.every((x): x is Product => !!x)) candidatos.push(grade);
  }
  const score = (ps: Product[]) =>
    ps.reduce((s, p) => s + (historico.get(p.sku)?.score_popularidade ?? 2), 0) / ps.length;
  const custo = (ps: Product[]) =>
    ps.reduce((s, p) => s + p.precoAtacado * quantidadeSugestao(p, pref), 0);
  const grupos = GRUPOS_SUGESTAO.filter(
    (g) =>
      (pref.grupos[g] ?? 0) > 0 && candidatos.some((ps) => ps[0] && grupoSugestao(ps[0]) === g),
  );
  const receitas = new Map(
    grupos.map((g) => [
      g,
      ranking.filter((r) => grupoSugestao(r) === g).reduce((s, r) => s + Number(r.receita), 0),
    ]),
  );
  const somaReceitas = [...receitas.values()].reduce((a, b) => a + b, 0);
  const pesos = new Map(
    grupos.map((g) => [
      g,
      Math.max((receitas.get(g) ?? 0) / Math.max(somaReceitas, 1), 0.02) * (pref.grupos[g] ?? 1),
    ]),
  );
  const somaPesos = [...pesos.values()].reduce((a, b) => a + b, 0);
  const colecoes = new Map<string, number>();
  for (const ps of candidatos) {
    const p = ps[0];
    if (p) colecoes.set(p.colecao, (colecoes.get(p.colecao) ?? 0) + score(ps));
  }
  for (const a of afinidades) {
    if (colecoes.has(a.colecao_a))
      colecoes.set(a.colecao_a, (colecoes.get(a.colecao_a) ?? 0) + a.score_afinidade * 0.2);
    if (colecoes.has(a.colecao_b))
      colecoes.set(a.colecao_b, (colecoes.get(a.colecao_b) ?? 0) + a.score_afinidade * 0.2);
  }
  const rankColecao = (col: string) => {
    const ps = candidatos.filter((arr) => arr[0]?.colecao === col);
    const media = ps.reduce((s, arr) => s + score(arr), 0) / Math.max(ps.length, 1);
    const cobertura = new Set(ps.flatMap((arr) => arr.map((p) => p.grupo))).size;
    const afinidade =
      afinidades
        .filter((a) => a.colecao_a === col || a.colecao_b === col)
        .reduce((s, a) => s + a.score_afinidade, 0) / Math.max(ps.length, 1);
    return (
      media +
      cobertura * 15 +
      afinidade * 0.15 +
      (pref.preferidas.includes(col) ? 1000 : 0) +
      jitter(col, seed) * 15
    );
  };
  const ancoras = [...colecoes.keys()]
    .filter((c) =>
      candidatos.some((ps) => ps[0]?.colecao === c && grupoSugestao(ps[0]) === "Mesa posta"),
    )
    .sort((a, b) => rankColecao(b) - rankColecao(a) || a.localeCompare(b))
    .slice(0, 3);
  const colecaoPorGrupo = new Map<GrupoSugestao, string[]>();
  for (const g of GRUPOS_SUGESTAO) {
    const limite = (alvo * (pesos.get(g) ?? 0)) / Math.max(somaPesos, 1e-9);
    const doGrupo = candidatos.filter((ps) => ps[0] && grupoSugestao(ps[0]) === g);
    const acessiveis = doGrupo.filter((ps) => custo(ps) <= limite);
    const cols = [
      ...new Set((acessiveis.length ? acessiveis : doGrupo).map((ps) => ps[0]?.colecao ?? "")),
    ];
    cols.sort(
      (a, b) =>
        rankColecao(b) +
          (ancoras.includes(b) ? 80 : 0) -
          (rankColecao(a) + (ancoras.includes(a) ? 80 : 0)) || a.localeCompare(b),
    );
    // Mesa coordenada usa até três âncoras; os complementos vêm de uma linha por grupo.
    colecaoPorGrupo.set(g, cols.slice(0, g === "Mesa posta" || g === "Jogo Americano" ? 3 : 1));
  }
  const top10 = new Set(
    [...ranking]
      .sort((a, b) => b.score_popularidade - a.score_popularidade)
      .slice(0, 10)
      .map((r) => r.sku),
  );
  const itens: ItemSugestao[] = [];
  const usados = new Set<string>();
  const porColecao = new Map<string, number>();
  const cores = new Set<string>();
  const pode = (ps: Product[]) => {
    const p = ps[0];
    if (!p || usados.has(p.sku)) return false;
    if (
      pref.colecoes === "concentrar" &&
      !(colecaoPorGrupo.get(grupoSugestao(p) ?? "Mesa posta") ?? []).includes(p.colecao)
    )
      return false;
    // A grade numérica 0–9 é uma unidade indivisível; a exceção ao limite de 2 é exclusiva dela.
    return (
      pref.colecoes !== "espalhar" ||
      (porColecao.get(p.colecao) ?? 0) + (ps.length === 10 ? 1 : ps.length) <= 2
    );
  };
  const ordenar = (lista: Product[][]) =>
    [...lista].sort((a, b) => {
      const val = (ps: Product[]) => {
        const p = ps[0];
        if (!p) return -Infinity;
        const repeticoes = porColecao.get(p.colecao) ?? 0;
        const cor = cores.has(p.corNome) ? 1 : 0;
        let v =
          pref.estilo === "vendidos"
            ? score(ps)
            : pref.estilo === "equilibrado"
              ? score(ps) * 0.7 + 30 / (1 + repeticoes + cor)
              : score(ps) * 0.2 + 80 / (1 + repeticoes + cor);
        v += jitter(p.sku, seed) * (pref.estilo === "vendidos" ? 0.001 : 25);
        if (pref.preferidas.includes(p.colecao)) v += 40;
        if (pref.colecoes === "concentrar" && ancoras.includes(p.colecao)) v += 65;
        if (
          pref.colecoes === "concentrar" &&
          itens.some((i) => i.produto.colecao === p.colecao && i.produto.grupo !== p.grupo)
        )
          v += 25;
        return v;
      };
      return val(b) - val(a) || (a[0]?.sku ?? "").localeCompare(b[0]?.sku ?? "");
    });
  const adicionar = (ps: Product[]) => {
    for (const p of ps) {
      const motivo = top10.has(p.sku)
        ? "Top 10 mais vendido"
        : pref.estilo === "mesclado" && !historico.has(p.sku)
          ? "Novidade"
          : pref.prontaEntrega
            ? "Pronta entrega"
            : ancoras.includes(p.colecao)
              ? `Combina com a coleção ${p.colecao}`
              : "Mais vendido no grupo";
      itens.push({ produto: p, quantidade: quantidadeSugestao(p, pref), motivo });
      usados.add(p.sku);
      cores.add(p.corNome);
    }
    const p = ps[0];
    if (p)
      porColecao.set(
        p.colecao,
        (porColecao.get(p.colecao) ?? 0) + (ps.length === 10 ? 1 : ps.length),
      );
  };
  for (const g of grupos) {
    const limite = (alvo * (pesos.get(g) ?? 0)) / Math.max(somaPesos, 1e-9);
    let gasto = 0;
    while (true) {
      const ps = ordenar(
        candidatos.filter((ps) => ps[0] && grupoSugestao(ps[0]) === g && pode(ps)),
      ).find((ps) => gasto + custo(ps) <= limite && totalSugestao(itens) + custo(ps) <= teto);
      if (!ps) break;
      adicionar(ps);
      gasto += custo(ps);
    }
  }
  // Redistribui as sobras, mantendo profundidade e grade intactas.
  while (totalSugestao(itens) < Math.max(1000, alvo * 0.95)) {
    const ps = ordenar(candidatos.filter(pode)).find(
      (ps) => totalSugestao(itens) + custo(ps) <= teto,
    );
    if (!ps) break;
    adicionar(ps);
  }
  // Com mix restrito, completa as caixas já selecionadas em passos de meia caixa.
  // Grades numéricas recebem o mesmo incremento nos dez números.
  for (
    let tentativa = 0;
    totalSugestao(itens) < Math.max(1000, alvo * 0.95) && tentativa < 10000;
    tentativa++
  ) {
    const blocos = itens.map((i) =>
      i.produto.isVelaNumerica
        ? itens.filter(
            (x) => x.produto.isVelaNumerica && gradeKey(x.produto) === gradeKey(i.produto),
          )
        : [i],
    );
    const deficitGrupo = (bloco: ItemSugestao[]) => {
      const g = bloco[0] && grupoSugestao(bloco[0].produto);
      return g
        ? (alvo * (pesos.get(g) ?? 0)) / Math.max(somaPesos, 1e-9) -
            itens
              .filter((i) => grupoSugestao(i.produto) === g)
              .reduce((s, i) => s + i.quantidade * i.produto.precoAtacado, 0)
        : 0;
    };
    const bloco = blocos
      .filter(
        (b) =>
          totalSugestao(itens) +
            b.reduce((s, i) => s + halfBox(i.produto.multiplos) * i.produto.precoAtacado, 0) <=
          teto,
      )
      .sort((a, b) => deficitGrupo(b) - deficitGrupo(a))[0];
    if (!bloco) break;
    for (const i of bloco) i.quantidade += halfBox(i.produto.multiplos);
  }
  const total = totalSugestao(itens);
  const atingiuAlvo = total >= Math.max(1000, alvo * 0.95) && total <= teto;
  return {
    itens,
    total,
    atingiuAlvo,
    aviso: atingiuAlvo
      ? null
      : "Não foi possível atingir o investimento com este mix e esta profundidade. Ajuste as preferências.",
  };
}
export function trocarItemSugestao(
  itens: ItemSugestao[],
  sku: string,
  produtos: Product[],
  ranking: RankingVenda[],
  pref: PreferenciasSugestao,
): ItemSugestao[] {
  const atual = itens.find((i) => i.produto.sku === sku);
  if (!atual) return itens;
  const removidos = atual.produto.isVelaNumerica
    ? itens.filter(
        (i) => i.produto.isVelaNumerica && gradeKey(i.produto) === gradeKey(atual.produto),
      )
    : [atual];
  const mantidos = itens.filter((i) => !removidos.includes(i));
  const usados = new Set(itens.map((i) => i.produto.sku));
  const ordenados = produtos
    .filter(
      (p) =>
        elegivelSugestao(p, pref) &&
        grupoSugestao(p) === grupoSugestao(atual.produto) &&
        !usados.has(p.sku) &&
        p.isVelaNumerica === atual.produto.isVelaNumerica,
    )
    .sort(
      (a, b) =>
        (ranking.find((r) => r.sku === b.sku)?.score_popularidade ?? 0) -
          (ranking.find((r) => r.sku === a.sku)?.score_popularidade ?? 0) ||
        a.sku.localeCompare(b.sku),
    );
  for (const p of ordenados) {
    const grade = p.isVelaNumerica
      ? Array.from({ length: 10 }, (_, n) =>
          ordenados.find(
            (x) => gradeKey(x) === gradeKey(p) && (x.numeroVela ?? Number(x.tamanhoNumero)) === n,
          ),
        )
      : [p];
    if (!grade.every((x): x is Product => !!x)) continue;
    if (
      pref.colecoes === "espalhar" &&
      mantidos.filter((i) => i.produto.colecao === p.colecao && !i.produto.isVelaNumerica).length +
        (p.isVelaNumerica ? 1 : grade.length) >
        2
    )
      continue;
    return [
      ...mantidos,
      ...grade.map((produto) => ({
        produto,
        quantidade: Math.max(
          halfBox(produto.multiplos),
          Math.round(atual.quantidade / halfBox(produto.multiplos)) * halfBox(produto.multiplos),
        ),
        motivo: `Alternativa em ${produto.grupo}`,
      })),
    ];
  }
  return itens;
}
export function aplicarSugestao(
  cart: Record<string, number>,
  itens: ItemSugestao[],
  substituir: boolean,
): Record<string, number> {
  const next = substituir ? {} : { ...cart };
  for (const i of itens) next[i.produto.sku] = (next[i.produto.sku] ?? 0) + i.quantidade;
  return next;
}
export function criteriosSugestao(p: PreferenciasSugestao): string[] {
  return [
    `Investimento: R$ ${p.investimento.toLocaleString("pt-BR")}`,
    `Mix: ${Object.entries(p.grupos)
      .filter(([, w]) => Number(w) > 0)
      .map(([g, w]) => `${g} (${w === 0.5 ? "Pouco" : w === 2 ? "Muito" : "Equilibrado"})`)
      .join(", ")}`,
    `Profundidade: ${p.profundidade === "meia" ? "Meia caixa" : p.profundidade === "duas" ? "2 caixas" : p.profundidade === "personalizado" ? `${p.caixas} caixas` : "1 caixa"}`,
    `Estilo: ${p.estilo === "vendidos" ? "Só os mais vendidos" : p.estilo === "mesclado" ? "Bem mesclado" : "Equilibrado"}`,
    `Coleções: ${p.colecoes === "concentrar" ? "Concentrar" : "Espalhar"}`,
    `Pronta entrega: ${p.prontaEntrega ? "Sim" : "Não"}`,
    `Preferidas: ${p.preferidas.join(", ") || "Todas"}`,
    `Excluídas: ${p.excluidas.join(", ") || "Nenhuma"}`,
  ];
}
