import type { Worksheet } from "exceljs";

export type CatalogRow = Record<string, unknown>;
export const PRODUCT_FIELDS = ["marca", "linha", "departamento", "categoria", "familia", "grupo", "tipo", "colecao", "sub_colecao", "sub_colecao2", "cor_nome", "cor", "estampa", "tamanho_numero", "tamanho_ref", "is_vela_numerica", "numero_vela", "nome_comercial", "nome_completo", "descricao_produto", "meta_descricao", "descricao_colecao", "material_descritivo", "multiplos", "qtd_kit", "preco_atacado", "preco_varejo", "preco_site", "canal_venda", "material", "tipo_embalagem", "peso_g", "altura_cm", "largura_cm", "profundidade_cm"] as const;
export type ProductField = typeof PRODUCT_FIELDS[number];
export const READ_FIELDS = ["cod_cadastro", "sku", "ean", "dun", "fase", "ncm", "cest", "origem_fisc", "origem_prod"];
export const FIELD_LABELS: Record<string, string> = { cod_cadastro: "Código de cadastro", sku: "SKU", ean: "EAN", dun: "DUN", fase: "Fase", marca: "Marca", linha: "Linha", departamento: "Departamento", categoria: "Categoria", familia: "Família", grupo: "Grupo", tipo: "Tipo", colecao: "Coleção", sub_colecao: "Subcoleção", sub_colecao2: "Subcoleção 2", cor_nome: "Nome da cor", cor: "Cor", estampa: "Estampa", tamanho_numero: "Tamanho / número", tamanho_ref: "Referência de tamanho", is_vela_numerica: "Vela numérica", numero_vela: "Número da vela", nome_comercial: "Nome comercial", nome_completo: "Nome completo", descricao_produto: "Descrição do produto", meta_descricao: "Meta descrição", descricao_colecao: "Descrição da coleção", material_descritivo: "Material descritivo", multiplos: "Múltiplos", qtd_kit: "Quantidade do kit", preco_atacado: "Preço atacado", preco_varejo: "Preço varejo", preco_site: "Preço site", canal_venda: "Canal de venda", ncm: "NCM", cest: "CEST", origem_fisc: "Origem fiscal", origem_prod: "Origem do produto", peso_g: "Peso (g)", altura_cm: "Altura (cm)", largura_cm: "Largura (cm)", profundidade_cm: "Profundidade (cm)", material: "Material", tipo_embalagem: "Tipo de embalagem" };
export const normalizeName = (value: unknown) => String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
export interface Dimension { id: string; nome: string; categoria_id?: string }
export interface CatalogLists { grupo: Dimension[]; colecao: Dimension[]; cor: Dimension[]; canais: string[]; categorias: Dimension[] }
export type DimensionKind = "grupo" | "colecao" | "cor";
export interface NewValue { key: string; kind: DimensionKind; nome: string; categoriaId?: string }
export interface Change { field: ProductField; before: unknown; after: unknown; newKey?: string }
export interface PreviewProduct { row: number; product: CatalogRow; changes: Change[] }
export interface SheetError { row: number; code: string; message: string }
export interface SheetPreview { products: PreviewProduct[]; errors: SheetError[]; newValues: NewValue[]; ignoredColumns: number }
export const dimensionFor = (field: string): DimensionKind | undefined => field === "grupo" || field === "colecao" ? field : field === "cor" || field === "cor_nome" ? "cor" : undefined;
export function cellValue(value: unknown): unknown {
  if (value && typeof value === "object") {
    const v = value as { formula?: unknown; sharedFormula?: unknown; richText?: { text: string }[]; text?: string };
    if (v.formula || v.sharedFormula) throw new Error("Fórmulas não são aceitas; use valores nas células");
    if (v.richText) return v.richText.map(x => x.text).join("");
    if (v.text != null) return v.text;
    throw new Error("Tipo de célula não suportado");
  }
  return value;
}
const positiveFields = new Set(["peso_g", "altura_cm", "largura_cm", "profundidade_cm"]);
const numericFields = new Set(["preco_atacado", "preco_varejo", "preco_site", "multiplos", "qtd_kit", "numero_vela", ...positiveFields]);
function numericValue(value: unknown): number {
  const text = String(value).trim();
  return typeof value === "number" ? value : Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
}
export function parseProductValue(field: ProductField, value: unknown): unknown {
  if (field === "is_vela_numerica") {
    if (typeof value === "boolean") return value;
    const v = normalizeName(value);
    if (v === "sim") return true;
    if (v === "nao") return false;
    throw new Error("is_vela_numerica: use Sim ou Não");
  }
  if (numericFields.has(field)) {
    const parsed = numericValue(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${field}: informe número ≥ 0`);
    if (positiveFields.has(field) && parsed <= 0) throw new Error(`${field}: informe número > 0`);
    if ((field === "multiplos" || field === "qtd_kit") && (!Number.isInteger(parsed) || parsed < 1)) throw new Error(`${field}: informe inteiro ≥ 1`);
    if (field === "numero_vela" && !Number.isInteger(parsed)) throw new Error("numero_vela: informe inteiro");
    return parsed;
  }
  return String(value).trim();
}
// Shared normalization includes legacy zero values without accepting new invalid values.
export function comparableProductValue(field: ProductField, value: unknown): unknown {
  if (value == null || String(value).trim() === "") return null;
  if (numericFields.has(field)) { const parsed = numericValue(value); return Number.isFinite(parsed) ? parsed : String(value).trim(); }
  if (field === "is_vela_numerica") { try { return parseProductValue(field, value); } catch { return String(value).trim(); } }
  return dimensionFor(field) ? normalizeName(value) : String(value).trim();
}
export function equalProductValue(field: ProductField, a: unknown, b: unknown) {
  return comparableProductValue(field, a) === comparableProductValue(field, b);
}
export function resolveProductChange(field: ProductField, raw: unknown, product: CatalogRow, lists: CatalogLists, categoriaId?: string): Change | undefined {
  if (raw == null || String(raw).trim() === "" || equalProductValue(field, product[field], raw)) return;
  let after = parseProductValue(field, raw);
  if (field === "canal_venda" && !lists.canais.includes(String(after))) throw new Error(`canal_venda não existe: ${after}`);
  const kind = dimensionFor(field);
  let newKey: string | undefined;
  if (kind) {
    const matches = lists[kind].filter(d => normalizeName(d.nome) === normalizeName(after));
    const match = kind === "grupo" ? matches.find(d => d.categoria_id === categoriaId) ?? matches[0] : matches[0];
    if (match) after = match.nome;
    else newKey = `${kind}:${normalizeName(after)}${kind === "grupo" ? `:${categoriaId ?? ""}` : ""}`;
  }
  if (!equalProductValue(field, product[field], after)) return { field, before: product[field], after, newKey };
}
export function validateSheet(sheet: Worksheet, products: CatalogRow[], lists: CatalogLists): SheetPreview {
  let slugRow = 0;
  for (let i = 1; i <= Math.min(sheet.rowCount, 5); i++) {
    let found = false;
    sheet.getRow(i).eachCell(c => { if (String(c.value).trim() === "cod_cadastro") found = true; });
    if (found) { slugRow = i; break; }
  }
  if (!slugRow) throw new Error("use a planilha baixada nesta aba");
  const columns: { index: number; slug: string }[] = [];
  sheet.getRow(slugRow).eachCell((cell, index) => columns.push({ index, slug: String(cell.value ?? "").trim() }));
  const duplicates = columns.filter((c, i) => columns.findIndex(x => x.slug === c.slug) !== i && (c.slug === "cod_cadastro" || PRODUCT_FIELDS.includes(c.slug as ProductField)));
  if (duplicates.length) throw new Error(`Coluna duplicada: ${duplicates.map(c => c.slug).join(", ")}`);
  const keyCol = columns.find(c => c.slug === "cod_cadastro");
  if (!keyCol) throw new Error("use a planilha baixada nesta aba");
  const result: SheetPreview = { products: [], errors: [], newValues: [], ignoredColumns: columns.filter(c => c.slug !== "_sistema" && c.slug !== "cod_cadastro" && !PRODUCT_FIELDS.includes(c.slug as ProductField)).length };
  const byCode = new Map(products.map(p => [String(p.cod_cadastro), p]));
  const seen = new Set<string>();
  const headerLayout = String(sheet.getRow(slugRow + 1).getCell(1).value ?? "").includes("Identidade");
  const labeledHeader = String(sheet.getRow(slugRow + 1).getCell(keyCol.index).value ?? "").trim() === "Código";
  const start = slugRow + (headerLayout ? 4 : labeledHeader ? 2 : 1);
  for (let i = start; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    if (!row.hasValues) continue;
    let code = "";
    try {
      code = String(cellValue(row.getCell(keyCol.index).value) ?? "").trim();
      if (!code && !columns.some(c => PRODUCT_FIELDS.includes(c.slug as ProductField) && row.getCell(c.index).value != null)) continue;
      const product = byCode.get(code);
      if (!product) throw new Error(`cod_cadastro não existe em products: ${code || "(vazio)"}`);
      if (seen.has(code)) throw new Error(`Código repetido na planilha: ${code}`);
      seen.add(code);
      const changes: Change[] = [];
      const pending: NewValue[] = [];
      const categoryCol = columns.find(c => c.slug === "categoria");
      const category = categoryCol ? cellValue(row.getCell(categoryCol.index).value) || product.categoria : product.categoria;
      const categoriaId = lists.categorias.find(c => normalizeName(c.nome) === normalizeName(category))?.id;
      for (const column of columns) {
        if (!PRODUCT_FIELDS.includes(column.slug as ProductField)) continue;
        const raw = cellValue(row.getCell(column.index).value);
        if (raw == null || String(raw).trim() === "") continue;
        const field = column.slug as ProductField;
        const change = resolveProductChange(field, raw, product, lists, categoriaId);
        if (!change) continue;
        if (change.newKey) {
          const kind = dimensionFor(field);
          if (kind) pending.push({ key: change.newKey, kind, nome: String(change.after), categoriaId });
        }
        changes.push(change);
      }
      const color = changes.find(c => c.field === "cor");
      if (color && !changes.some(c => c.field === "cor_nome") && product.cor_nome !== color.after) {
        changes.push({ ...color, field: "cor_nome", before: product.cor_nome });
      }
      if (changes.length) {
        result.products.push({ row: i, product, changes });
        for (const value of pending) if (changes.some(c => c.newKey === value.key) && !result.newValues.some(v => v.key === value.key)) result.newValues.push(value);
      }
    } catch (error) { result.errors.push({ row: i, code, message: error instanceof Error ? error.message : String(error) }); }
  }
  return result;
}
export function selectedChanges(preview: SheetPreview, selected: Set<string>): PreviewProduct[] {
  return preview.products.map(p => ({ ...p, changes: p.changes.filter(c => !c.newKey || selected.has(c.newKey)) })).filter(p => p.changes.length > 0);
}