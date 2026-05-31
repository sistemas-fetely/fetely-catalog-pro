import type { CartItem, OrderCommercial, OrderMeta } from "@/types";

export type TipoRegistro = "pedido" | "cotacao";

export type StatusCotacao =
  | "aberta"
  | "em_negociacao"
  | "aprovada"
  | "convertida"
  | "expirada"
  | "perdida";

export type MotivoPerdaCotacao =
  | "preco"
  | "concorrente"
  | "sem_budget"
  | "timing"
  | "produto_indisponivel"
  | "sem_retorno"
  | "outro";

export const STATUS_COTACAO_LABEL: Record<StatusCotacao, string> = {
  aberta: "Aberta",
  em_negociacao: "Em negociação",
  aprovada: "Aprovada",
  convertida: "Convertida",
  expirada: "Expirada",
  perdida: "Perdida",
};

export const MOTIVO_PERDA_LABEL: Record<MotivoPerdaCotacao, string> = {
  preco: "Preço",
  concorrente: "Concorrente",
  sem_budget: "Sem budget",
  timing: "Timing",
  produto_indisponivel: "Produto indisponível",
  sem_retorno: "Sem retorno do cliente",
  outro: "Outro",
};

export interface Cotacao {
  id: string; // C0001
  criadoEm: string;
  atualizadoEm: string;
  validoAte: string;

  vendedorId: string;
  vendedorNome: string;
  vendedorLogin?: string;

  items: CartItem[];
  meta: OrderMeta;
  total: number;
  commercial?: OrderCommercial;

  status: StatusCotacao;
  pedidoConvertidoId?: string;
  motivoPerda?: MotivoPerdaCotacao;
  motivoPerdaObs?: string;
}

export const COTACAO_VALIDADE_DIAS = 15;
