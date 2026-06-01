export type LeadSegmento =
  | "lojista"
  | "decoradora"
  | "cerimonialista"
  | "atacadista"
  | "buffet"
  | "influencer"
  | "consumidor"
  | "outro";

export type LeadPotencial = "alto" | "medio" | "em_desenvolvimento";

export type LeadStatusCrm =
  | "novo"
  | "em_contato"
  | "qualificado"
  | "proposta_enviada"
  | "convertido"
  | "descartado";

export type LeadOrigem =
  | "instagram"
  | "whatsapp"
  | "feira"
  | "indicacao"
  | "site"
  | "google"
  | "outro";

export type LeadFrequencia =
  | "pontual"
  | "mensal"
  | "trimestral"
  | "semestral"
  | "anual";

export type LeadVolumeEstimado =
  | "ate_500"
  | "500_1500"
  | "1500_3000"
  | "ate_2500"
  | "2500_10k"
  | "10k_50k"
  | "acima_50k"
  | "nao_sei";

export interface LeadQualificado {
  id: string;
  criadoEm: string;
  atualizadoEm: string;
  nome: string;
  whatsapp: string;
  instagram: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  segmento: LeadSegmento;
  frequencia: LeadFrequencia | null;
  volumeEstimado: LeadVolumeEstimado | null;
  urgencia: number | null;
  produtosInteresse: string[];
  origem: LeadOrigem;
  observacoes: string | null;
  score: number;
  potencial: LeadPotencial;
  statusCrm: LeadStatusCrm;
  responsavelId: string | null;
  responsavelNome: string | null;
  tags: string[];
  notasInternas: string | null;
  clienteB2bId: string | null;
  cotacaoOrigemId: string | null;
}

export interface LeadHistoricoItem {
  id: string;
  criadoEm: string;
  usuarioNome: string;
  descricao: string;
}

export const SEGMENTO_LABEL: Record<LeadSegmento, string> = {
  lojista: "Lojista",
  decoradora: "Decoradora",
  cerimonialista: "Cerimonialista",
  atacadista: "Atacadista",
  buffet: "Buffet & Eventos",
  influencer: "Influencer / Criador",
  consumidor: "Consumidor / Apaixonado por mesa posta",
  outro: "Outro",
};

export const POTENCIAL_LABEL: Record<LeadPotencial, string> = {
  alto: "Alto",
  medio: "Médio",
  em_desenvolvimento: "Em desenvolvimento",
};

export const STATUS_CRM_LABEL: Record<LeadStatusCrm, string> = {
  novo: "Novo",
  em_contato: "Em contato",
  qualificado: "Qualificado",
  proposta_enviada: "Proposta enviada",
  convertido: "Convertido",
  descartado: "Descartado",
};

export const STATUS_CRM_COLOR: Record<LeadStatusCrm, string> = {
  novo: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  em_contato: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  qualificado: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  proposta_enviada: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  convertido: "bg-gold/15 text-gold border-gold/30",
  descartado: "bg-muted text-muted-foreground border-border",
};

export const ORIGEM_LABEL: Record<LeadOrigem, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  feira: "Feira",
  indicacao: "Indicação",
  site: "Site",
  google: "Google",
  outro: "Outro",
};

export const FREQUENCIA_LABEL: Record<LeadFrequencia, string> = {
  pontual: "Pontual",
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const VOLUME_LABEL: Record<LeadVolumeEstimado, string> = {
  ate_2500: "Até R$ 2.500",
  "2500_10k": "R$ 2.500 a R$ 10k",
  "10k_50k": "R$ 10k a R$ 50k",
  acima_50k: "Acima de R$ 50k",
  nao_sei: "Não sei estimar",
};
