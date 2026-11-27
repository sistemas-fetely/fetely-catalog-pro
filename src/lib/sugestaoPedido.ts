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
  limiteAncoras?: number;
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
  kits: KitSugestao[];
  avisosProfundidade: string[];
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
export interface KitSugestao {
  id: string;
  nome: string;
  grupo: GrupoSugestao;
  colecao: string;
  cor: string;
  itens: ItemSugestao[];
  custo: number;
  score: number;
  recencia: number;
  novidade: boolean;
  afinidades: Record<string, number>;
  motivo: string;
  travado: boolean;
  nivelExtra: number;
}
export interface OpcoesMontagem {
  anteriores?: KitSugestao[];
  regenerar?: boolean;
}
function aleatorio(key: string, seed: number): number {
  let h = (seed ^ 2166136261) >>> 0;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const normalizar = (v: string) => v.trim().toLocaleLowerCase("pt-BR");
function gradeKey(p: Product): string {
  return `${p.linha}|${p.corNome}|${p.tamanhoRef}`;
}
/** Catalog-only kit definition: photos stay in the view's collection-photo store. */
export function montarKits(
  produtos: Product[],
  pref: PreferenciasSugestao = PREFERENCIAS_PADRAO,
  ranking: RankingVenda[] = [],
  afinidades: AfinidadeColecao[] = [],
): KitSugestao[] {
  const historico = new Map(ranking.map((r) => [r.sku, r]));
  const blocos = new Map<string, Product[]>();
  const elegiveis = produtos.filter((p) => elegivelSugestao(p, pref));
  for (const p of elegiveis) {
    const grupo = grupoSugestao(p);
    if (!grupo) continue;
    // When the safe projection has no estampa, the commercial color identifies the print.
    const variacao =
      grupo === "Mesa posta" || grupo === "Infantil"
        ? normalizar(p.estampa || (p.colecao.toLocaleLowerCase().includes("mosa") ? p.corNome : ""))
        : grupo === "Copos e Taças" || grupo === "Talheres"
          ? normalizar(p.corNome)
          : grupo === "Velas" && p.isVelaNumerica
            ? gradeKey(p)
            : "";
    const id = `${grupo}|${p.colecao}|${p.isVelaNumerica ? "grade|" : ""}${variacao}`;
    const bloco = blocos.get(id) ?? [];
    if (!bloco.some((x) => x.sku === p.sku)) bloco.push(p);
    blocos.set(id, bloco);
  }
  const kits: KitSugestao[] = [];
  for (const [id, bloco] of blocos) {
    const primeiro = bloco[0];
    if (!primeiro) continue;
    const grupo = grupoSugestao(primeiro);
    if (!grupo) continue;
    let pecas = [...bloco].sort(
      (a, b) =>
        a.grupo.localeCompare(b.grupo) ||
        a.corNome.localeCompare(b.corNome) ||
        Number(a.tamanhoNumero) - Number(b.tamanhoNumero) ||
        a.sku.localeCompare(b.sku),
    );
    if (primeiro.isVelaNumerica) {
      const grade = Array.from({ length: 10 }, (_, n) =>
        bloco.find((p) => (p.numeroVela ?? Number(p.tamanhoNumero)) === n),
      );
      if (!grade.every((p): p is Product => p !== undefined)) continue;
      pecas = grade;
    }
    const itens = pecas.map((produto) => ({
      produto,
      quantidade: quantidadeSugestao(produto, pref),
      motivo: "",
    }));
    const custo = totalSugestao(itens);
    const score =
      itens.reduce(
        (sum, i) =>
          sum +
          (historico.get(i.produto.sku)?.score_popularidade ?? 4) *
            i.quantidade *
            i.produto.precoAtacado,
        0,
      ) / Math.max(custo, 1);
    const recencia =
      itens.reduce(
        (sum, i) =>
          sum +
          (historico.get(i.produto.sku)?.score_recencia ?? 0) *
            i.quantidade *
            i.produto.precoAtacado,
        0,
      ) / Math.max(custo, 1);
    const novidade = pecas.every((p) => !historico.has(p.sku));
    const motivo = novidade
      ? "Novidade"
      : pref.prontaEntrega
        ? "Pronta entrega"
        : recencia >= 60
          ? "Em alta nos últimos 90 dias"
          : score >= 70
            ? grupo === "Mesa posta"
              ? "Mesa mais vendida"
              : "Entre os mais vendidos"
            : "Escolha das lojas";
    const afinidade: Record<string, number> = {};
    for (const a of afinidades) {
      if (a.colecao_a === primeiro.colecao && pecas.some((p) => p.grupo === a.grupo_a))
        afinidade[a.colecao_b] = Math.max(afinidade[a.colecao_b] ?? 0, a.score_afinidade);
      if (a.colecao_b === primeiro.colecao && pecas.some((p) => p.grupo === a.grupo_b))
        afinidade[a.colecao_a] = Math.max(afinidade[a.colecao_a] ?? 0, a.score_afinidade);
    }
    kits.push({
      id,
      nome: `${grupo === "Mesa posta" ? "Mesa" : grupo} ${primeiro.colecao}${
        grupo === "Copos e Taças" ||
        grupo === "Talheres" ||
        (grupo === "Mesa posta" && id.split("|")[2])
          ? ` · ${primeiro.estampa || primeiro.corNome}`
          : ""
      }`,
      grupo,
      colecao: primeiro.colecao,
      cor: primeiro.corNome,
      itens: itens.map((i) => ({ ...i, motivo })),
      custo,
      score: score * 0.75 + recencia * 0.25,
      recencia,
      novidade,
      afinidades: afinidade,
      motivo,
      travado: false,
      nivelExtra: 0,
    });
  }
  return kits.sort((a, b) => a.id.localeCompare(b.id));
}
export function atualizarKit(kit: KitSugestao, itens: ItemSugestao[]): KitSugestao {
  return { ...kit, itens, custo: totalSugestao(itens) };
}
export function alternativasKit(
  atual: KitSugestao,
  candidatos: KitSugestao[],
  selecionados: KitSugestao[],
  alvo: number,
): KitSugestao[] {
  const totalMantido = selecionados
    .filter((k) => k.id !== atual.id)
    .reduce((s, k) => s + k.custo, 0);
  const usados = new Set(selecionados.map((k) => k.id));
  return candidatos
    .filter(
      (k) => k.grupo === atual.grupo && !usados.has(k.id) && k.custo + totalMantido <= alvo * 1.05,
    )
    .sort(
      (a, b) =>
        Math.abs(Math.log(a.custo / atual.custo)) - Math.abs(Math.log(b.custo / atual.custo)) ||
        b.score - a.score,
    )
    .slice(0, 5);
}
export function montarSugestao(
  produtos: Product[],
  ranking: RankingVenda[],
  afinidades: AfinidadeColecao[],
  pref: PreferenciasSugestao,
  seed = 1,
  opcoes: OpcoesMontagem = {},
): ResultadoSugestao {
  const alvo = Math.max(1000, Math.min(30000, pref.investimento || 2500));
  const candidatos = montarKits(produtos, pref, ranking, afinidades);
  const anteriores = opcoes.anteriores ?? [];
  const antigos = new Set(anteriores.filter((k) => !k.travado).map((k) => k.id));
  const escolhidos: KitSugestao[] = [];
  const usados = new Set<string>();
  const valor = () => escolhidos.reduce((s, k) => s + k.custo, 0);
  const pode = (k: KitSugestao) =>
    !usados.has(k.id) &&
    valor() + k.custo <= alvo &&
    (pref.colecoes !== "espalhar" || !escolhidos.some((x) => x.colecao === k.colecao));
  const adicionar = (k: KitSugestao) => {
    escolhidos.push(k);
    usados.add(k.id);
  };
  const validoAnterior = (k: KitSugestao) => {
    const base = candidatos.find((x) => x.id === k.id);
    return (
      base &&
      k.itens.length > 0 &&
      k.itens.every(
        (i) =>
          base.itens.some((x) => x.produto.sku === i.produto.sku) &&
          i.quantidade <= quantidadeSugestao(i.produto, pref) * 2,
      )
    );
  };
  // Locks survive reshuffling; preference changes keep compatible, non-inflated edits.
  for (const k of [...anteriores].sort((a, b) => Number(b.travado) - Number(a.travado))) {
    if ((!opcoes.regenerar || k.travado) && validoAnterior(k) && pode(k)) adicionar(k);
  }
  const grupos = GRUPOS_SUGESTAO.filter(
    (g) => (pref.grupos[g] ?? 0) > 0 && candidatos.some((k) => k.grupo === g),
  );
  const receitas = new Map(
    grupos.map((g) => [
      g,
      ranking.filter((r) => grupoSugestao(r) === g).reduce((s, r) => s + r.receita, 0),
    ]),
  );
  const soma = [...receitas.values()].reduce((s, v) => s + v, 0);
  const pesos = new Map(
    grupos.map((g) => [
      g,
      (soma ? Math.max((receitas.get(g) ?? 0) / soma, 0.02) : 1) * (pref.grupos[g] ?? 1),
    ]),
  );
  const totalPesos = [...pesos.values()].reduce((s, v) => s + v, 0);
  const ancoras = new Set(escolhidos.filter((k) => k.grupo === "Mesa posta").map((k) => k.colecao));
  const kExpo = pref.estilo === "vendidos" ? 3 : pref.estilo === "equilibrado" ? 1.5 : 0.6;
  let rodada = 0;
  const sortear = (lista: KitSugestao[]) => {
    rodada++;
    const peso = (k: KitSugestao) => {
      let bonus = pref.preferidas.includes(k.colecao) ? 5 : 1;
      const novaColecao = !escolhidos.some((x) => x.colecao === k.colecao);
      const novaCor = !escolhidos.some((x) => x.cor === k.cor);
      if (pref.estilo === "mesclado")
        bonus *= (novaColecao ? 2.5 : 1) * (novaCor ? 1.5 : 1) * (k.novidade ? 3 : 1);
      if (pref.colecoes === "concentrar") {
        if (ancoras.has(k.colecao)) bonus *= 5;
        bonus *= 1 + Math.max(0, ...escolhidos.map((x) => k.afinidades[x.colecao] ?? 0)) / 20;
      }
      if (opcoes.regenerar && antigos.has(k.id)) bonus *= 0.000001;
      return Math.pow(Math.max(k.score, 4), kExpo) * bonus;
    };
    return lista
      .map((k) => ({
        k,
        v: -Math.log(Math.max(1e-9, aleatorio(`${rodada}|${k.id}`, seed))) / peso(k),
      }))
      .sort((a, b) => a.v - b.v || a.k.id.localeCompare(b.k.id))[0]?.k;
  };
  const permitido = (k: KitSugestao) =>
    pode(k) &&
    (pref.colecoes !== "concentrar" ||
      k.grupo !== "Mesa posta" ||
      ancoras.has(k.colecao) ||
      ancoras.size < (pref.limiteAncoras ?? 4));
  // Fill by width, accepting a complete kit up to 25% above its group's share.
  for (const g of grupos) {
    const cota = (alvo * (pesos.get(g) ?? 0)) / Math.max(totalPesos, 1e-9);
    while (true) {
      const gasto = escolhidos.filter((k) => k.grupo === g).reduce((s, k) => s + k.custo, 0);
      const kit = sortear(
        candidatos.filter((k) => k.grupo === g && permitido(k) && gasto + k.custo <= cota * 1.25),
      );
      if (!kit) break;
      adicionar(kit);
      if (g === "Mesa posta") ancoras.add(kit.colecao);
    }
  }
  // Unspent shares are redistributed to additional complete kits, not isolated SKUs.
  while (true) {
    const kit = sortear(candidatos.filter(permitido));
    if (!kit) break;
    const afinidade = escolhidos.find((x) => (kit.afinidades[x.colecao] ?? 0) > 0);
    adicionar(
      afinidade && kit.motivo === "Escolha das lojas"
        ? {
            ...kit,
            motivo: `Combina com ${afinidade.colecao}`,
            itens: kit.itens.map((i) => ({ ...i, motivo: `Combina com ${afinidade.colecao}` })),
          }
        : kit,
    );
    if (kit.grupo === "Mesa posta") ancoras.add(kit.colecao);
  }
  const avisosProfundidade: string[] = [];
  // Only an exhausted eligible mix allows whole-kit depth increases, bounded at 2×.
  const restantes = candidatos.filter(
    (k) =>
      !usados.has(k.id) &&
      (pref.colecoes !== "espalhar" || !escolhidos.some((x) => x.colecao === k.colecao)) &&
      (pref.colecoes !== "concentrar" ||
        k.grupo !== "Mesa posta" ||
        ancoras.has(k.colecao) ||
        ancoras.size < (pref.limiteAncoras ?? 4)),
  );
  if (!restantes.length) {
    const niveis = pref.profundidade === "duas" ? 2 : pref.profundidade === "personalizado" ? Math.max(1, Math.round(pref.caixas)) : 1;
    for (let nivel = 0; nivel < niveis; nivel++) {
      for (let index = 0; index < escolhidos.length; index++) {
        const kit = escolhidos[index];
        if (!kit || kit.travado || valor() >= alvo * 0.95) continue;
        const novos = kit.itens.map((i) => ({
          ...i,
          quantidade:
            i.quantidade +
            (pref.profundidade === "meia" ? halfBox(i.produto.multiplos) : i.produto.multiplos),
        }));
        if (novos.some((i) => i.quantidade > quantidadeSugestao(i.produto, pref) * 2)) continue;
        const novo = atualizarKit(kit, novos);
        if (valor() - kit.custo + novo.custo > alvo) continue;
        escolhidos[index] = { ...novo, nivelExtra: kit.nivelExtra + 1 };
      }
    }
  }
  for (const kit of escolhidos)
    if (kit.nivelExtra > 0)
      avisosProfundidade.push(`Aumentamos a profundidade de ${kit.nome} para fechar o valor`);
  const total = valor();
  const atingiuAlvo = total >= Math.max(1000, alvo * 0.95);
  return {
    kits: escolhidos,
    itens: escolhidos.flatMap((k) => k.itens),
    total,
    atingiuAlvo,
    avisosProfundidade,
    aviso: atingiuAlvo ? null : "Este é o mix completo mais próximo abaixo do seu investimento.",
  };
}
/** Compatibility helper: replace the entire source kit rather than one isolated SKU. */
export function trocarItemSugestao(
  itens: ItemSugestao[],
  sku: string,
  produtos: Product[],
  ranking: RankingVenda[],
  pref: PreferenciasSugestao,
): ItemSugestao[] {
  const atuais = montarKits(
    itens.map((i) => i.produto),
    pref,
    ranking,
  ).map((k) =>
    atualizarKit(
      k,
      k.itens.map((i) => itens.find((x) => x.produto.sku === i.produto.sku) ?? i),
    ),
  );
  const atual = atuais.find((k) => k.itens.some((i) => i.produto.sku === sku));
  if (!atual) return itens;
  const alternativa = alternativasKit(
    atual,
    montarKits(produtos, pref, ranking),
    atuais,
    pref.investimento,
  )[0];
  if (!alternativa) return itens;
  const primeira = atual.itens[0];
  if (!primeira) return itens;
  const razao = primeira.quantidade / quantidadeSugestao(primeira.produto, pref);
  const novo = alternativa.itens.map((i) => ({
    ...i,
    quantidade: Math.max(
      halfBox(i.produto.multiplos),
      Math.round(
        (quantidadeSugestao(i.produto, pref) * Math.min(2, razao)) / halfBox(i.produto.multiplos),
      ) * halfBox(i.produto.multiplos),
    ),
  }));
  return [
    ...itens.filter((i) => !atual.itens.some((x) => x.produto.sku === i.produto.sku)),
    ...novo,
  ];
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
