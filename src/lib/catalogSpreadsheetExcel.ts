import type { Workbook } from "exceljs";
import { READ_FIELDS, dimensionFor, type CatalogLists, type CatalogRow } from "./catalogSpreadsheet";

const sheetColors = { ink: "243B35", header: "E0ECE8", operations: "E5E7EB", muted: "667085", paper: "FFFFFF" };
const blockColors: Record<string, string> = { Identidade: "DCE6F1", Situação: "FFF2CC", Classificação: "E2EFDA", Comercial: "DDEBF7", "Fiscal e físico": "FCE4D6" };
export const TEMPLATE_COLUMNS = [
  ["Código", "cod_cadastro"], ["SKU", "sku"], ["EAN", "ean"], ["DUN", "dun"], ["Inner", "inner_qtd"], ["Marca", "marca"],
  ["Fase (FOP)", "fase"], ["Fase (SNCF)", "_fase_sncf"], ["Ativo", "_ativo"], ["Canal de venda", "canal_venda"],
  ["Departamento", "departamento"], ["Categoria", "categoria"], ["Linha", "linha"], ["Família", "familia"], ["Grupo", "grupo"], ["Tipo", "tipo"], ["Coleção", "colecao"], ["Subcoleção", "sub_colecao"], ["Subcoleção 2", "sub_colecao2"], ["Nome da cor", "cor_nome"], ["Cor", "cor"], ["Estampa", "estampa"], ["Tamanho", "tamanho_numero"], ["Tamanho ref.", "tamanho_ref"], ["Vela numérica?", "is_vela_numerica"], ["Nº da vela", "numero_vela"],
  ["Nome comercial", "nome_comercial"], ["Nome completo", "nome_completo"], ["Nome operacional (Bling/XPM)", "nome_operacional"], ["Tem descrição?", "_tem_descricao"], ["Tem meta descrição?", "_tem_meta_descricao"], ["Múltiplos", "multiplos"], ["Qtd. kit", "qtd_kit"], ["Material (comercial)", "material_descritivo"], ["Material", "material"], ["Tipo de embalagem", "tipo_embalagem"], ["Peso (g)", "peso_g"], ["Altura (cm)", "altura_cm"], ["Largura (cm)", "largura_cm"], ["Profundidade (cm)", "profundidade_cm"],
  ["NCM", "ncm"], ["CEST", "cest"], ["Origem fiscal", "origem_fisc"], ["Origem produto", "origem_prod"], ["Grupo tributário Bling", "grupo_tributario_bling"],
] as const;
const unavailable = new Set(["inner_qtd", "_fase_sncf", "nome_operacional", "grupo_tributario_bling"]);
const blankZeroFields = new Set(["peso_g", "altura_cm", "largura_cm", "profundidade_cm"]);
const commercial = new Set(["nome_comercial", "nome_completo", "nome_operacional", "_tem_descricao", "_tem_meta_descricao", "multiplos", "qtd_kit"]);
const block = (f: string) => ["cod_cadastro", "sku", "ean", "dun", "inner_qtd"].includes(f) ? "Identidade" : ["fase", "_fase_sncf", "_ativo", "canal_venda"].includes(f) ? "Situação" : ["ncm", "cest", "origem_fisc", "origem_prod", "grupo_tributario_bling"].includes(f) ? "Fiscal e físico" : commercial.has(f) ? "Comercial" : "Classificação";
const readonly = (f: string) => READ_FIELDS.includes(f) || unavailable.has(f) || f.startsWith("_");
const requiredPreSale = new Set(["marca", "departamento", "categoria", "grupo", "colecao", "cor_nome", "nome_comercial", "multiplos", "canal_venda"]);
const owner = (f: string) => f === "fase" || f.startsWith("_") ? "FOP · só consulta" : readonly(f) ? `Operações · ${["cod_cadastro", "sku", "ean", "ncm", "origem_fisc"].includes(f) ? "obrigatório ativo" : "só consulta"}` : `Produto (Thomer) · ${requiredPreSale.has(f) ? "obrigatório pré-venda" : "opcional"}`;
async function workbook() { const { default: ExcelJS } = await import("exceljs"); return new ExcelJS.Workbook(); }
export async function catalogWorkbook(products: CatalogRow[], lists: CatalogLists): Promise<Workbook> {
  const book = await workbook();
  const sheet = book.addWorksheet("Catálogo", { views: [{ state: "frozen", xSplit: 2, ySplit: 4 }] });
  const fields = TEMPLATE_COLUMNS.map(([, slug]) => slug);
  sheet.addRow(fields.map(owner));
  sheet.addRow(fields.map(block));
  sheet.addRow(fields); sheet.getRow(3).hidden = true;
  sheet.addRow(TEMPLATE_COLUMNS.map(([label]) => label));
  for (const p of products) sheet.addRow(fields.map(f => unavailable.has(f) || (blankZeroFields.has(f) && Number(p[f]) === 0) ? "" : f === "_ativo" ? p.ativo == null ? "" : p.ativo ? "Sim" : "Não" : f === "_tem_descricao" || f === "_tem_meta_descricao" ? String(p[f === "_tem_descricao" ? "descricao_produto" : "meta_descricao"] ?? "").trim() ? "Sim" : "Não" : f === "is_vela_numerica" ? p[f] == null ? "" : p[f] ? "Sim" : "Não" : p[f] ?? ""));
  let begin = 1;
  for (let i = 2; i <= fields.length + 1; i++) {
    if (i === fields.length + 1 || block(fields[i - 1] ?? "") !== block(fields[begin - 1] ?? "")) {
      if (i - begin > 1) sheet.mergeCells(2, begin, 2, i - 1);
      begin = i;
    }
  }
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(5, sheet.rowCount), column: fields.length } };
  const listSheet = book.addWorksheet("listas");
  const listValues = [lists.grupo.map(x => x.nome), lists.colecao.map(x => x.nome), lists.cor.map(x => x.nome), lists.canais];
  listSheet.addRow(["Grupo", "Coleção", "Cor", "Canal"]);
  for (let i = 0; i < Math.max(...listValues.map(v => v.length)); i++) listSheet.addRow(listValues.map(v => v[i] ?? ""));
  for (let i = 0; i < listValues.length; i++) {
    const letter = String.fromCharCode(65 + i);
    book.definedNames.add(`'listas'!$${letter}$2:$${letter}$${Math.max(2, (listValues[i]?.length ?? 0) + 1)}`, `lista_${["grupo", "colecao", "cor", "canal"][i]}`);
    listSheet.getColumn(i + 1).width = 32;
  }
  fields.forEach((f, i) => {
    const col = sheet.getColumn(i + 1); col.width = f.includes("descricao") ? 48 : f.includes("nome") ? 36 : 23;
    col.eachCell({ includeEmpty: true }, (cell, row) => {
      cell.font = { name: "Arial", size: row <= 4 ? 10 : 11, color: { argb: readonly(f) ? sheetColors.muted : sheetColors.ink }, bold: row === 2 || row === 4 };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: row === 2 ? blockColors[block(f)] : readonly(f) ? sheetColors.operations : row <= 4 ? sheetColors.header : sheetColors.paper } };
      if (["cod_cadastro", "sku", "ean", "dun"].includes(f)) cell.numFmt = "@";
      if (f.startsWith("preco_")) cell.numFmt = '#,##0.00;(#,##0.00);"-"';
    });
    const kind = dimensionFor(f) ?? (f === "canal_venda" ? "canal" : undefined);
    if (kind) for (let row = 5; row <= Math.max(5, sheet.rowCount); row++) sheet.getCell(row, i + 1).dataValidation = { type: "list", allowBlank: true, formulae: [`lista_${kind}`], showErrorMessage: true, errorStyle: "warning", errorTitle: "Valor fora da lista", error: "Valor novo será revisado na prévia." };
    if (f === "is_vela_numerica") for (let row = 5; row <= Math.max(5, sheet.rowCount); row++) sheet.getCell(row, i + 1).dataValidation = { type: "list", allowBlank: true, formulae: ['"Sim,Não"'], showErrorMessage: true, errorStyle: "warning", error: "Use Sim ou Não." };
  });
  sheet.getRow(1).height = 45; sheet.getRow(2).height = 24; sheet.getRow(4).height = 36;
  return book;
}
export async function reportWorkbook(headers: string[], rows: unknown[][]) {
  const book = await workbook(); const sheet = book.addWorksheet("Relatório", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(headers); rows.forEach(row => sheet.addRow(row));
  sheet.columns.forEach(c => { c.width = 32; });
  sheet.eachRow((row, n) => row.eachCell(c => { c.font = { name: "Arial", size: 11, bold: n === 1 }; c.alignment = { wrapText: true, vertical: "top" }; }));
  sheet.autoFilter = { from: "A1", to: { row: sheet.rowCount, column: headers.length } }; return book;
}
export async function downloadWorkbook(book: Workbook, filename: string) {
  const bytes = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function readWorkbook(file: File) { const book = await workbook(); await book.xlsx.load(await file.arrayBuffer()); return book; }