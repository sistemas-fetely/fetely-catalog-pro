export type SegmentoLead =
  | "boutique_decoracao"
  | "papelaria_atelie"
  | "festa_premium"
  | "ecommerce"
  | "varejo_premium"
  | "buffet_eventos"
  | "floricultura"
  | "decoradora"
  | "representacao"
  | "outro";

export interface Lead {
  id: string;
  criadoEm: string;
  nome: string;
  whatsapp: string;
  email: string;
  segmento: SegmentoLead;
  origem: "feira";
}

export const SEGMENTO_LABEL: Record<SegmentoLead, string> = {
  boutique_decoracao: "Boutique / Decoração",
  papelaria_atelie: "Papelaria & Ateliê",
  festa_premium: "Festa Premium",
  ecommerce: "E-commerce",
  varejo_premium: "Varejo Premium",
  buffet_eventos: "Buffet & Eventos",
  floricultura: "Floricultura",
  decoradora: "Decoradora",
  representacao: "Representação",
  outro: "Outro",
};

const STORAGE_KEY = "fetely_leads_feira";

export function getLeads(): Lead[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Lead[]) : [];
  } catch {
    return [];
  }
}

export function saveLead(lead: Lead): void {
  const list = getLeads();
  list.push(lead);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function maskWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function countDigits(value: string): number {
  return value.replace(/\D/g, "").length;
}

export function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function leadsHoje(leads: Lead[]): number {
  const hoje = new Date().toDateString();
  return leads.filter((l) => new Date(l.criadoEm).toDateString() === hoje).length;
}

export function exportarCSV(leads: Lead[]): void {
  const headers = ["nome", "whatsapp", "email", "segmento", "data", "hora"];
  const rows = leads.map((l) => {
    const d = new Date(l.criadoEm);
    const row = [
      l.nome,
      l.whatsapp,
      l.email,
      SEGMENTO_LABEL[l.segmento] ?? l.segmento,
      d.toLocaleDateString("pt-BR"),
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    ];
    return row
      .map((v) => (v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v))
      .join(",");
  });
  const bom = "\uFEFF";
  const csv = bom + [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fetely_leads_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
