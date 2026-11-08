import type { DailyPrepared } from "./catalogDailyUpdate";
import { FIELD_LABELS, normalizeName } from "./catalogSpreadsheet";
import { TEMPLATE_COLUMNS } from "./catalogSpreadsheetExcel";

export type DailyFilterType = "todos" | "mudanca" | "conflito" | "erro";
export const DAILY_PAGE_SIZE = 25;
const templateLabels = new Map<string, string>(TEMPLATE_COLUMNS.map(([label, field]) => [field, label]));
export const dailyFieldLabel = (field: string) => templateLabels.get(field) ?? FIELD_LABELS[field] ?? "Campo não reconhecido";
export function dailyFieldBlock(field: string) {
  if (["cod_cadastro", "sku", "ean", "dun", "inner_qtd"].includes(field)) return "Identidade";
  if (["fase", "_fase_sncf", "_ativo", "canal_venda"].includes(field)) return "Situação";
  if (["ncm", "cest", "origem_fisc", "origem_prod", "grupo_tributario_bling"].includes(field)) return "Fiscal e físico";
  if (["nome_comercial", "nome_completo", "nome_operacional", "descricao_produto", "meta_descricao", "descricao_colecao", "multiplos", "qtd_kit", "preco_atacado", "preco_varejo", "preco_site"].includes(field)) return "Comercial";
  return "Classificação";
}
export function dailyEntryType(entry: DailyPrepared): Exclude<DailyFilterType, "todos"> {
  return entry.error ? "erro" : entry.drifted || entry.item.tipo === "conflito" ? "conflito" : "mudanca";
}
export function filterDailyEntries(entries: DailyPrepared[], field: string, type: DailyFilterType, search: string) {
  const query = normalizeName(search);
  return entries.filter(entry => (field === "todos" || entry.item.campo === field)
    && (type === "todos" || dailyEntryType(entry) === type)
    && (!query || normalizeName(`${entry.item.cod_cadastro} ${entry.product?.nome_comercial ?? ""}`).includes(query)));
}
export function groupDailyProducts(entries: DailyPrepared[]) {
  const grouped = new Map<string, { code: string; name: string; entries: DailyPrepared[]; cells: Map<string, DailyPrepared[]> }>();
  for (const entry of entries) {
    const code = entry.item.cod_cadastro;
    let product = grouped.get(code);
    if (!product) { product = { code, name: String(entry.product?.nome_comercial ?? "—"), entries: [], cells: new Map() }; grouped.set(code, product); }
    product.entries.push(entry);
    const cell = product.cells.get(entry.item.campo) ?? [];
    cell.push(entry); product.cells.set(entry.item.campo, cell);
  }
  return [...grouped.values()];
}
export function scopedDailySelection(entries: DailyPrepared[], selected: ReadonlySet<string>) {
  return new Set(entries.filter(entry => selected.has(entry.item.id)).map(entry => entry.item.id));
}
export function dailyColumns(entries: DailyPrepared[]) {
  const fields = [...new Set(entries.map(entry => entry.item.campo))];
  const order = new Map<string, number>(TEMPLATE_COLUMNS.map(([, field], index) => [field, index]));
  const blocks = ["Identidade", "Situação", "Classificação", "Comercial", "Fiscal e físico"];
  return fields.sort((a, b) => blocks.indexOf(dailyFieldBlock(a)) - blocks.indexOf(dailyFieldBlock(b)) || (order.get(a) ?? 100) - (order.get(b) ?? 100));
}
export function dailyReadableError(message: string) {
  return Object.keys(FIELD_LABELS).sort((a, b) => b.length - a.length).reduce((text, field) => text.replaceAll(field, dailyFieldLabel(field)), message);
}