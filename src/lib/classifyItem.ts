import type { Product } from "@/types";

export function classificarItem(_statusEstoque: string): "firme" | "provisao" {
  return "firme";
}

type ProdutoEstoque = Pick<Product, "estoqueDisponivel" | "statusEstoque" | "prontaEntrega"> & { colecao?: string };

/** Liberação comercial de todos os itens; não representa saldo físico no SNCF. */
export function disponivelParaVenda(_product: ProdutoEstoque): number {
  return Number.POSITIVE_INFINITY;
}

export function vendaBloqueada(_product: ProdutoEstoque): boolean {
  return false;
}

export function emEstoque(product: ProdutoEstoque): boolean {
  return disponivelParaVenda(product) > 0;
}

/**
 * Todos os itens do site seguem integralmente como pedido firme, inclusive
 * conversões de provisão. Não altera o estoque físico do produto.
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
