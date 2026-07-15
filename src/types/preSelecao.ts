export type StatusPreSelecao =
  | "nova"
  | "visualizada"
  | "em_contato"
  | "convertida"
  | "expirada"
  | "descartada";

export type SegmentoCliente =
  | "boutique_decoracao"
  | "papelaria_atelie"
  | "festa_premium"
  | "ecommerce"
  | "varejo_premium"
  | "buffet_eventos"
  | "floricultura"
  | "outro";

export const SEGMENTO_LABEL: Record<SegmentoCliente, string> = {
  boutique_decoracao: "Boutique / Decoração",
  papelaria_atelie: "Papelaria / Ateliê",
  festa_premium: "Festa Premium",
  ecommerce: "E-commerce",
  varejo_premium: "Varejo Premium",
  buffet_eventos: "Buffet & Eventos",
  floricultura: "Floricultura",
  outro: "Outro",
};

export const STATUS_PRE_LABEL: Record<StatusPreSelecao, string> = {
  nova: "Nova",
  visualizada: "Visualizada",
  em_contato: "Em contato",
  convertida: "Convertida",
  expirada: "Expirada",
  descartada: "Descartada",
};

export interface ItemPreSelecao {
  sku: string;
  nomeComercial: string;
  colecao: string;
  grupo: string;
  corNome: string;
  tamanhoNumero: string;
  quantidade: number; // 0 = interesse sem qtd
  precoVarejoUnit: number;
  subtotalVarejo: number;
  temInteresseSemQtd: boolean;
}

export interface PreSelecao {
  id: string; // PS0042
  criadoEm: string;
  expiraEm: string;

  vendedorId: string | null;
  vendedorNome: string | null;

  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  contatoNome: string;
  contatoCargo?: string;
  contatoEmail: string;
  contatoWhatsapp: string;
  cidadeEstado: string;
  segmento: SegmentoCliente;
  observacao?: string;
  aceitaNewsletter: boolean;

  itens: ItemPreSelecao[];

  totalItens: number;
  totalUnidades: number;
  totalVarejoRef: number;

  status: StatusPreSelecao;
  clienteB2bId?: string;
  cotacaoGeradaId?: string;
  pedidoGeradoId?: string;
  atribuidoParaVendedorId?: string;
  visualizadoEm?: string;
  sessaoId?: string;
}

export const EXPIRACAO_PADRAO_HORAS = 72;
