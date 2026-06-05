import type {
  LeadFrequencia,
  LeadPotencial,
  LeadSegmento,
  LeadVolumeEstimado,
} from "@/types/lead";

const SCORE_SEGMENTO: Record<LeadSegmento, number> = {
  atacadista: 30,
  lojista: 28,
  decoradora: 22,
  cerimonialista: 22,
  buffet: 18,
  influencer: 12,
  representacao: 26,
  consumidor: 8,
  outro: 5,
};

const SCORE_VOLUME: Record<LeadVolumeEstimado, number> = {
  acima_50k: 30,
  "10k_50k": 24,
  "2500_10k": 16,
  ate_2500: 8,
  "1500_3000": 6,
  "500_1500": 4,
  ate_500: 2,
  nao_sei: 4,
};

const SCORE_FREQUENCIA: Record<LeadFrequencia, number> = {
  mensal: 20,
  trimestral: 16,
  semestral: 10,
  anual: 6,
  pontual: 4,
};

export function calcularScoreLead(input: {
  segmento: LeadSegmento;
  frequencia: LeadFrequencia | null;
  volumeEstimado: LeadVolumeEstimado | null;
  urgencia: number | null;
}): { score: number; potencial: LeadPotencial } {
  const seg = SCORE_SEGMENTO[input.segmento] ?? 5;
  const vol = input.volumeEstimado ? SCORE_VOLUME[input.volumeEstimado] : 0;
  const freq = input.frequencia ? SCORE_FREQUENCIA[input.frequencia] : 0;
  const urg = input.urgencia ? input.urgencia * 4 : 0; // 0-20

  const score = Math.min(100, seg + vol + freq + urg);
  const potencial: LeadPotencial =
    score >= 70 ? "alto" : score >= 45 ? "medio" : "em_desenvolvimento";
  return { score, potencial };
}
