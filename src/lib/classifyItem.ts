import type { Product } from "@/types";

export function classificarItem(statusEstoque: string): "firme" | "provisao" {
  const s = (statusEstoque || "").toLowerCase().trim();
  if (s === "em estoque") return "firme";
  return "provisao";
}

type ProdutoEstoque = Pick<Product, "estoqueDisponivel" | "statusEstoque" | "prontaEntrega"> & { colecao?: string };

/**
 * Coleções de velas liberadas para venda firme mesmo com estoque zero
 * (decisão Thomer 28/10/2026). Jingle Pop fica de fora e segue a regra normal.
 */
export const COLECOES_LIBERADAS_SEM_ESTOQUE = [
  "classique", "fine pure", "le moment", "dots doux", "spirale",
  "twist", "lumi star", "pattern", "amour",
];
const SALDO_LIBERADO = 999999;

export function colecaoLiberada(colecao?: string): boolean {
  return COLECOES_LIBERADAS_SEM_ESTOQUE.includes((colecao || "").trim().toLowerCase());
}

/** Estoque numérico do SNCF é a autoridade da venda firme, salvo coleções liberadas. */
export function disponivelParaVenda(product: ProdutoEstoque): number {
  if (colecaoLiberada(product.colecao)) return SALDO_LIBERADO;
  const q = Number(product.estoqueDisponivel ?? 0);
  return Number.isFinite(q) && q > 0 ? q : 0;
}

export function vendaBloqueada(product: ProdutoEstoque): boolean {
  return disponivelParaVenda(product) === 0 && !(product.statusEstoque || "").trim().toLowerCase().startsWith("prev");
}

export function emEstoque(product: ProdutoEstoque): boolean {
  return disponivelParaVenda(product) > 0;
}

/**
 * Divide uma quantidade solicitada entre venda firme e provisão respeitando o
 * estoque disponível. Não altera o produto — apenas calcula.
 */
export function roteamentoQtd(
  product: ProdutoEstoque,
  quantidade: number,
): { firme: number; provisao: number } {
  const qtd = Math.max(0, Math.floor(quantidade));
  if (vendaBloqueada(product)) return { firme: 0, provisao: 0 };
  const disp = disponivelParaVenda(product);
  const firme = Math.min(qtd, disp);
  return { firme, provisao: qtd - firme };
}


const MES_ORDEM: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

/** Extrai "Jun 2026" de "Prev. Jun 2026" — devolve o status original se não casar. */
export function extrairDataPrevisao(status: string): string {
  const m = (status || "").match(/([A-Za-zçÇ]{3,})\.?\s+(\d{4})/);
  if (!m) return status || "—";
  const mes = m[1].slice(0, 3);
  const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1).toLowerCase();
  return `${mesCap} ${m[2]}`;
}

/** Ordena strings tipo "Jun 2026" cronologicamente. */
export function compararPrevisao(a: string, b: string): number {
  const pa = a.toLowerCase().match(/([a-zçç]{3})\s+(\d{4})/);
  const pb = b.toLowerCase().match(/([a-zçç]{3})\s+(\d{4})/);
  if (!pa || !pb) return a.localeCompare(b);
  const ya = parseInt(pa[2], 10);
  const yb = parseInt(pb[2], 10);
  if (ya !== yb) return ya - yb;
  return (MES_ORDEM[pa[1]] ?? 99) - (MES_ORDEM[pb[1]] ?? 99);
}
