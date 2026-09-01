// Helpers compartilhados pelos relatórios/dashboards.
//
// Regra de negócio (fonte única de verdade dos números da empresa):
// só entram nos relatórios os pedidos que são VENDA REAL:
//   - status_pedido = 'confirmado'
//   - reprovado = false
//   - sncf_status_sync = 'enviado'  (efetivamente sincronizado com o SNCF)
//   - bonificado = false            (bonificação não é faturamento)

const PAGE_SIZE = 1000;

/**
 * PostgREST devolve no máximo 1000 linhas por requisição.
 * Esta função pagina até trazer tudo (a query deve ter um .order() estável).
 */
export async function fetchAllPaged<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  makeQuery: () => any,
  maxPages = 60,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

/** Filtros de "venda válida" aplicados na própria tabela orders. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyVendaValida<T>(q: T, opts?: { incluirBonificados?: boolean }): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r = (q as any)
    .eq("status_pedido", "confirmado")
    .eq("reprovado", false)
    .eq("sncf_status_sync", "enviado");
  if (!opts?.incluirBonificados) r = r.eq("bonificado", false);
  return r as T;
}

/** Mesmos filtros, mas via embed `orders!inner(...)` em order_items. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyVendaValidaEmbed<T>(q: T, opts?: { incluirBonificados?: boolean }): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r = (q as any)
    .eq("orders.status_pedido", "confirmado")
    .eq("orders.reprovado", false)
    .eq("orders.sncf_status_sync", "enviado");
  if (!opts?.incluirBonificados) r = r.eq("orders.bonificado", false);
  return r as T;
}

export interface VendaValidaFlags {
  status_pedido?: string | null;
  reprovado?: boolean | null;
  sncf_status_sync?: string | null;
  bonificado?: boolean | null;
}

/** Checagem defensiva no cliente (embeds do PostgREST podem ser inconsistentes). */
export function isVendaValida(o: VendaValidaFlags | null | undefined, incluirBonificados = false) {
  if (!o) return false;
  return (
    o.status_pedido === "confirmado" &&
    o.reprovado !== true &&
    o.sncf_status_sync === "enviado" &&
    (incluirBonificados || o.bonificado !== true)
  );
}
