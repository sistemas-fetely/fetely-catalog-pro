export interface GrupoCliente {
  id: string;
  nome: string;
  descricao?: string;
  cor: string;
  clienteIds: string[];
  criadoPorVendedorId: string;
  criadoEm: string;
  atualizadoEm: string;
  ativo: boolean;
}

export const CORES_GRUPO: { nome: string; valor: string }[] = [
  { nome: "Dourado", valor: "#C9A961" },
  { nome: "Azul", valor: "#3B82F6" },
  { nome: "Verde", valor: "#10B981" },
  { nome: "Roxo", valor: "#8B5CF6" },
  { nome: "Terracota", valor: "#C2410C" },
  { nome: "Rosa", valor: "#EC4899" },
  { nome: "Cinza", valor: "#6B7280" },
];

export function rowToGrupo(row: Record<string, unknown>): GrupoCliente {
  return {
    id: row.id as string,
    nome: row.nome as string,
    descricao: (row.descricao as string | null) ?? undefined,
    cor: (row.cor as string) ?? "#C9A961",
    clienteIds: ((row.cliente_ids as string[] | null) ?? []),
    criadoPorVendedorId: row.criado_por_vendedor_id as string,
    criadoEm: row.criado_em as string,
    atualizadoEm: row.atualizado_em as string,
    ativo: Boolean(row.ativo ?? true),
  };
}

export function grupoToRow(g: GrupoCliente): Record<string, unknown> {
  return {
    id: g.id,
    nome: g.nome,
    descricao: g.descricao ?? null,
    cor: g.cor,
    cliente_ids: g.clienteIds,
    criado_por_vendedor_id: g.criadoPorVendedorId,
    criado_em: g.criadoEm,
    atualizado_em: g.atualizadoEm,
    ativo: g.ativo,
  };
}
