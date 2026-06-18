export interface ModeloPedidoItem {
  sku: string;
  nomeComercial: string;
  quantidade: number;
}

export interface ModeloPedido {
  id: string;
  nome: string;
  descricao?: string;
  itens: ModeloPedidoItem[];
  criadoPorVendedorId: string;
  criadoEm: string;
  atualizadoEm: string;
}

export function rowToModelo(row: Record<string, unknown>): ModeloPedido {
  return {
    id: row.id as string,
    nome: row.nome as string,
    descricao: (row.descricao as string | null) ?? undefined,
    itens: ((row.itens as ModeloPedidoItem[] | null) ?? []),
    criadoPorVendedorId: row.criado_por_vendedor_id as string,
    criadoEm: row.criado_em as string,
    atualizadoEm: row.atualizado_em as string,
  };
}

export function modeloToRow(m: ModeloPedido): Record<string, unknown> {
  return {
    id: m.id,
    nome: m.nome,
    descricao: m.descricao ?? null,
    itens: m.itens,
    criado_por_vendedor_id: m.criadoPorVendedorId,
    criado_em: m.criadoEm,
    atualizado_em: m.atualizadoEm,
  };
}
