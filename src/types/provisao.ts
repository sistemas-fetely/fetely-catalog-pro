import type { ClienteSnapshot } from "./cliente";

export type StatusProvisao =
  | "aguardando_estoque"
  | "estoque_liberado"
  | "convertido_em_pedido"
  | "cancelado";

export interface ItemProvisao {
  sku: string;
  nomeComercial: string;
  colecao: string;
  corNome: string;
  tamanhoNumero: string;
  quantidade: number;
  precoAtacadoReferencia: number;
  statusEstoque: string;
  previsaoData: string;
}

export interface ProvisaoFutura {
  id: string;
  criadoEm: string;
  atualizadoEm: string;
  vendedorId: string;
  vendedorNome: string;
  clienteId: string;
  clienteSnapshot: ClienteSnapshot;
  pedidoFirmeId?: string;
  cotacaoOrigemId?: string;
  pedidoConvertidoId?: string;
  status: StatusProvisao;
  itens: ItemProvisao[];
  datasPrevisao: string[];
  proximaPrevisao: string;
  observacoes?: string;
  totalReferencia: number;
  // Reprovação
  reprovado?: boolean;
  reprovadoEm?: string | null;
  reprovadoMotivo?: string | null;
  reprovadoPorId?: string | null;
  reprovadoPorNome?: string | null;
}

export const STATUS_PROVISAO_LABEL: Record<StatusProvisao, string> = {
  aguardando_estoque: "Aguardando estoque",
  estoque_liberado: "Estoque liberado",
  convertido_em_pedido: "Convertido em pedido",
  cancelado: "Cancelado",
};
