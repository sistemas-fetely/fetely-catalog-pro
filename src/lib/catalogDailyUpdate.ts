import { supabase } from "@/integrations/supabase/client";
import {
  PRODUCT_FIELDS,
  dimensionFor,
  normalizeName,
  parseProductValue,
  type CatalogLists,
  type CatalogRow,
  type Change,
  type NewValue,
  type ProductField,
  type SheetError,
} from "./catalogSpreadsheet";

const DAILY_FIELDS = PRODUCT_FIELDS.filter(field => !["preco_atacado", "preco_varejo", "preco_site"].includes(field));
export type DailyChoice = "planilha" | "sistema";
export interface DailyItem {
  id: string;
  cod_cadastro: string;
  campo: string;
  valor_base: unknown;
  valor_planilha: unknown;
  valor_sistema: unknown;
  tipo: "mudanca" | "conflito";
}
export interface DailyReading { hora: string; status: string }
export interface DailyData {
  itens: DailyItem[];
  leitura: DailyReading | null;
  semCadastro: string[];
  erros: string[];
}
export interface DailyPrepared {
  item: DailyItem;
  product?: CatalogRow;
  current?: unknown;
  drifted: boolean;
  choice?: DailyChoice;
  change?: Change;
  error?: string;
}

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const textList = (value: unknown): string[] => Array.isArray(value) ? value.map(entry => {
  if (typeof entry === "string") return entry;
  const row = object(entry);
  return [row.cod_cadastro ?? row.codigo, row.campo, row.erro ?? row.error ?? row.mensagem ?? row.message].filter(v => v != null && v !== "").join(" · ") || JSON.stringify(entry);
}) : [];

export function mapDailyResponse(raw: unknown): DailyData {
  const root = object(raw);
  const reading = object(root.leitura ?? root.ultima_leitura);
  const hora = reading.hora ?? reading.lida_em ?? reading.executada_em ?? root.leitura_hora ?? root.hora ?? root.lida_em;
  const status = reading.status ?? root.leitura_status ?? root.status;
  const source = root.mudancas ?? root.pendentes ?? root.itens ?? root.changes;
  const itens = (Array.isArray(source) ? source : []).map((entry, index): DailyItem => {
    const row = object(entry);
    return {
      id: String(row.id ?? `sem-id-${index}`),
      cod_cadastro: String(row.cod_cadastro ?? ""),
      campo: String(row.campo ?? row.slug ?? ""),
      valor_base: row.valor_base ?? null,
      valor_planilha: row.valor_planilha ?? null,
      valor_sistema: row.valor_sistema ?? null,
      tipo: row.tipo === "conflito" ? "conflito" : "mudanca",
    };
  });
  return {
    itens,
    leitura: hora || status ? { hora: String(hora ?? "—"), status: String(status ?? "—") } : null,
    semCadastro: textList(root.sem_cadastro),
    erros: textList(root.erros),
  };
}

function equalValues(a: unknown, b: unknown) {
  if (a == null && b == null) return true;
  if (typeof a === "number" || typeof b === "number") {
    const na = Number(a); const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  }
  return String(a ?? "").trim() === String(b ?? "").trim();
}

export function prepareDailyItems(items: DailyItem[], products: CatalogRow[], lists: CatalogLists, choices: Record<string, DailyChoice>): DailyPrepared[] {
  const byCode = new Map(products.map(product => [String(product.cod_cadastro), product]));
  return items.map(item => {
    const product = byCode.get(item.cod_cadastro);
    const base: DailyPrepared = { item, product, current: product?.[item.campo], drifted: false, choice: choices[item.id] };
    if (!product) return { ...base, error: "Produto inexistente no FOP; o cadastro nasce pela Importação de PI no SNCF" };
    if (!DAILY_FIELDS.includes(item.campo as ProductField)) return { ...base, error: `Campo não gravável pela Atualização do dia: ${item.campo}` };
    const field = item.campo as ProductField;
    const current = product[field];
    const drifted = !equalValues(current, item.valor_sistema);
    const choice = choices[item.id];
    if ((item.tipo === "conflito" || drifted) && !choice) return { ...base, current, drifted };
    if (choice === "sistema") return { ...base, current, drifted };
    if (item.valor_planilha == null || String(item.valor_planilha).trim() === "") return { ...base, current, drifted, error: "Valor da planilha vazio: nada será alterado; use Descartar" };
    try {
      if (equalValues(current, item.valor_planilha)) return { ...base, current, drifted };
      let after = parseProductValue(field, item.valor_planilha);
      if (field === "canal_venda" && !lists.canais.includes(String(after))) throw new Error(`canal_venda não existe: ${after}`);
      const kind = dimensionFor(field);
      let newKey: string | undefined;
      if (kind) {
        const categoriaId = lists.categorias.find(c => normalizeName(c.nome) === normalizeName(product.categoria))?.id;
        const matches = lists[kind].filter(d => normalizeName(d.nome) === normalizeName(after));
        const match = kind === "grupo" ? matches.find(d => d.categoria_id === categoriaId) ?? matches[0] : matches[0];
        if (match) after = match.nome;
        else newKey = `${kind}:${normalizeName(after)}${kind === "grupo" ? `:${categoriaId ?? ""}` : ""}`;
      }
      if (equalValues(current, after)) return { ...base, current, drifted };
      return { ...base, current, drifted, change: { field, before: current, after, newKey } };
    } catch (error) {
      return { ...base, current, drifted, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

export function dailyNewValues(prepared: DailyPrepared[]): NewValue[] {
  const values: NewValue[] = [];
  for (const entry of prepared) {
    const change = entry.change;
    if (!change?.newKey) continue;
    const kind = dimensionFor(change.field)!;
    const categoriaId = kind === "grupo" ? change.newKey.split(":").at(-1) || undefined : undefined;
    if (!values.some(v => v.key === change.newKey)) values.push({ key: change.newKey, kind, nome: String(change.after), categoriaId });
  }
  return values;
}

export function dailyErrors(prepared: DailyPrepared[]): SheetError[] {
  return prepared.filter(p => p.error).map(p => ({ row: 0, code: p.item.cod_cadastro, message: `${p.item.campo}: ${p.error}` }));
}

export async function callCatalogDaily(body: { acao: "pendentes" } | { acao: "confirmar"; ids: string[]; status: "aplicada" | "descartada" | "resolvida"; escolha: DailyChoice }) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error("Sessão ausente; entre novamente");
  const response = await fetch("/api/catalogo-planilha-fop", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) throw new Error(data?.error ?? `Erro HTTP ${response.status}`);
  return data;
}
