export type SegmentoCliente =
  | "boutique_decoracao"
  | "papelaria_atelie"
  | "festa_premium"
  | "ecommerce"
  | "varejo_premium"
  | "buffet_eventos"
  | "floricultura"
  | "outro";

export type CanalCliente =
  | "feira"
  | "indicacao"
  | "instagram"
  | "prospeccao_ativa"
  | "inbound_site"
  | "representante"
  | "outro";

export type SituacaoCadastral =
  | "ativa"
  | "suspensa"
  | "inapta"
  | "baixada"
  | "nula"
  | "desconhecida";

export interface Cliente {
  id: string;
  criadoEm: string;
  atualizadoEm: string;
  cadastradoPorVendedorId: string;
  cadastradoPorVendedorNome: string;

  cnpj: string;
  cnpjFormatado: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual?: string;
  isentoIE?: boolean;
  situacaoCadastral: SituacaoCadastral;

  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;

  enderecoEntregaIgual: boolean;
  entregaLogradouro?: string;
  entregaNumero?: string;
  entregaComplemento?: string;
  entregaBairro?: string;
  entregaCidade?: string;
  entregaEstado?: string;
  entregaCep?: string;

  contatoNome: string;
  contatoEmail: string;
  contatoTelefone: string;
  contatoWhatsapp?: string;

  financeiroNome?: string;
  financeiroEmail?: string;
  financeiroTelefone?: string;

  segmento: SegmentoCliente;
  canal: CanalCliente;
  regiaoAtuacao?: string;
  observacoes?: string;
  tags?: string[];

  ativo: boolean;
}

export interface ClienteSnapshot {
  clienteId: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  cidade: string;
  estado: string;
  contatoNome: string;
  contatoEmail: string;
  contatoTelefone: string;
  enderecoEntrega: string;
}

export const SEGMENTO_LABEL: Record<SegmentoCliente, string> = {
  boutique_decoracao: "Boutique / Decoração",
  papelaria_atelie: "Papelaria & Ateliê",
  festa_premium: "Festa Premium",
  ecommerce: "E-commerce",
  varejo_premium: "Varejo Premium",
  buffet_eventos: "Buffet & Eventos",
  floricultura: "Floricultura",
  outro: "Outro",
};

export const CANAL_LABEL: Record<CanalCliente, string> = {
  feira: "Feira",
  indicacao: "Indicação",
  instagram: "Instagram",
  prospeccao_ativa: "Prospecção Ativa",
  inbound_site: "Inbound Site",
  representante: "Representante",
  outro: "Outro",
};

export const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;
