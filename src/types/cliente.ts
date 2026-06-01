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

  // V15.1 — Cliente internacional (isento de CNPJ)
  isInternacional?: boolean;
  pais?: string;
  documentoTipo?: string;
  documentoNumero?: string;

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

  // V15.2 — Telefones no formato internacional
  telefonesInternacionais?: boolean;

  financeiroNome?: string;
  financeiroEmail?: string;
  financeiroTelefone?: string;

  segmento: SegmentoCliente;
  canal: CanalCliente;
  regiaoAtuacao?: string;
  observacoes?: string;
  tags?: string[];

  ativo: boolean;

  // V13 — Condições comerciais homologadas (opcional)
  premissasComerciais?: PremissasComerciais;
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
  /** V13 — snapshot das premissas vigentes aplicadas no momento do pedido */
  premissasAplicadas?: PremissasComerciais | null;
}

// ============================================================
// V13 — PREMISSAS COMERCIAIS DO CLIENTE
// ============================================================

export interface HistoricoPremissa {
  timestamp: string;
  usuarioNome: string;
  descricao: string;
  camposAlterados: { campo: string; anterior: string; novo: string }[];
}

export interface PremissasComerciais {
  temDescontoHomologado: boolean;
  descontoHomologadoPercent: number;
  /** true=ACUMULA sobre faixa · false=SUBSTITUI faixa */
  descontoHomologadoSobrePos: boolean;
  descontoHomologadoObs?: string;

  bonusPixPersonalizado: boolean;
  bonusPixPercent: number;

  freteFixo: boolean;
  freteTipo: "CIF" | "FOB" | null;
  freteObs?: string;

  temCondicaoPreferencial: boolean;
  condicoesPermitidas: number[];
  condicaoPreferencialId: number | null;

  temFaixaFixa: boolean;
  faixaFixaId: number | null;

  temPedidoMinimoPersonalizado: boolean;
  pedidoMinimoValor: number;

  vigenciaInicio: string;
  vigenciaFim: string | null;
  premissasAtivas: boolean;

  aprovadoPor: string;
  aprovadoEm: string;
  atualizadoPor: string;
  atualizadoEm: string;
  historico: HistoricoPremissa[];
}

export function emptyPremissas(usuario: string): PremissasComerciais {
  const now = new Date().toISOString();
  return {
    temDescontoHomologado: false,
    descontoHomologadoPercent: 0,
    descontoHomologadoSobrePos: false,
    descontoHomologadoObs: "",
    bonusPixPersonalizado: false,
    bonusPixPercent: 2.5,
    freteFixo: false,
    freteTipo: null,
    freteObs: "",
    temCondicaoPreferencial: false,
    condicoesPermitidas: [],
    condicaoPreferencialId: null,
    temFaixaFixa: false,
    faixaFixaId: null,
    temPedidoMinimoPersonalizado: false,
    pedidoMinimoValor: 1500,
    vigenciaInicio: now.slice(0, 10),
    vigenciaFim: null,
    premissasAtivas: false,
    aprovadoPor: usuario,
    aprovadoEm: now,
    atualizadoPor: usuario,
    atualizadoEm: now,
    historico: [],
  };
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

// V15.1 — Lista de países (ISO 3166-1 — nomes em PT-BR, principais)
export const PAISES_LIST: string[] = [
  "Estados Unidos","Portugal","Espanha","França","Itália","Alemanha","Reino Unido",
  "Holanda","Bélgica","Suíça","Áustria","Irlanda","Suécia","Noruega","Dinamarca",
  "Finlândia","Polônia","República Tcheca","Grécia","Turquia",
  "Argentina","Uruguai","Paraguai","Chile","Bolívia","Peru","Equador","Colômbia",
  "Venezuela","México","Costa Rica","Panamá","Cuba","República Dominicana",
  "Canadá","Austrália","Nova Zelândia","África do Sul","Marrocos","Egito",
  "Israel","Emirados Árabes Unidos","Arábia Saudita","Catar","Líbano",
  "Índia","China","Japão","Coreia do Sul","Tailândia","Vietnã","Singapura",
  "Malásia","Indonésia","Filipinas","Hong Kong","Taiwan",
  "Outro",
];

export const DOCUMENTO_TIPOS = ["Passport", "Tax ID", "VAT", "EIN", "Outro"] as const;
