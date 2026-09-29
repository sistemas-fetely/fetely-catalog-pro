import type { Product } from "@/types";

export function classificarItem(statusEstoque: string): "firme" | "provisao" {
  const s = (statusEstoque || "").toLowerCase().trim();
  if (s === "em estoque") return "firme";
  return "provisao";
}

// Titularidade:
// - `statusEstoque`, `prontaEntrega`, `estoqueDisponivel` são espelho do SNCF
//   (job fop-status-estoque a cada 30 min). Disponibilidade física.
// - `liberadoParaPedido` é a liberação comercial do FOP (admin/master). O SNCF
//   nunca escreve nela. É o único override de firme × provisão.
type Disp = Pick<Product, "estoqueDisponivel" | "statusEstoque" | "liberadoParaPedido">;

/**
 * Quantidade do produto que pode ser vendida firme agora.
 * 1) liberadoParaPedido → ilimitado.
 * 2) status com "prev" → 0.
 * 3) estoqueDisponivel > 0 → essa quantidade.
 * 4) fallback textual (em estoque = ilimitado).
 */
export function disponivelParaVenda(product: Disp): number {
  if (product.liberadoParaPedido === true) return Number.POSITIVE_INFINITY;
  const status = (product.statusEstoque || "").toLowerCase().trim();
  if (status.includes("prev")) return 0;
  const q = Number(product.estoqueDisponivel ?? 0);
  if (q > 0) return q;
  if (classificarItem(product.statusEstoque || "") === "firme") return Number.POSITIVE_INFINITY;
  return 0;
}

export function emEstoque(product: Disp): boolean {
  return disponivelParaVenda(product) > 0;
}

/**
 * Divide uma quantidade solicitada entre venda firme e provisão respeitando o
 * estoque disponível. Não altera o produto — apenas calcula.
 */
export function roteamentoQtd(
  product: Disp,
  quantidade: number,
): { firme: number; provisao: number } {
  const qtd = Math.max(0, Math.floor(quantidade));
  const disp = disponivelParaVenda(product);
  if (!Number.isFinite(disp)) return { firme: qtd, provisao: 0 };
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
