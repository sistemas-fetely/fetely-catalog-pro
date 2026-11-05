import type { Workbook } from "exceljs";
import { FIELD_LABELS, PRODUCT_FIELDS, READ_FIELDS, dimensionFor, type CatalogLists, type CatalogRow } from "./catalogSpreadsheet";

const sheetColors = { ink: "243B35", header: "E0ECE8", operations: "E5E7EB", muted: "667085", paper: "FFFFFF" };
async function workbook() { const { default: ExcelJS } = await import("exceljs"); return new ExcelJS.Workbook(); }
export async function catalogWorkbook(products: CatalogRow[], lists: CatalogLists): Promise<Workbook> {
  const book = await workbook();
  const sheet = book.addWorksheet("Catálogo", { views: [{ state: "frozen", xSplit: 2, ySplit: 4 }] });
  const fields = ["_sistema", ...READ_FIELDS.slice(0, 5), ...PRODUCT_FIELDS, ...READ_FIELDS.slice(5)];
  sheet.addRow(fields); sheet.getRow(1).hidden = true;
  const block = (f: string) => f === "_sistema" || READ_FIELDS.slice(0, 5).includes(f) ? "Identidade" : READ_FIELDS.includes(f) ? "Fiscal e físico" : ["multiplos", "qtd_kit", "preco_atacado", "preco_varejo", "preco_site", "canal_venda"].includes(f) ? "Comercial" : "Classificação";
  sheet.addRow(fields.map(block));
  sheet.addRow(fields.map(f => f === "_sistema" ? "FOP" : `${FIELD_LABELS[f] ?? f} · ${READ_FIELDS.includes(f) ? "Operações (só consulta)" : "Produto"}`));
  sheet.addRow(fields.map(f => `→ ${f === "preco_site" || ["nome_comercial", "nome_completo", "descricao_produto", "meta_descricao"].includes(f) ? "Shopify" : READ_FIELDS.includes(f) ? "SNCF → FOP (consulta)" : "FOP → SNCF"}`));
  for (const p of products) sheet.addRow(fields.map(f => f === "_sistema" ? "FOP" : f === "is_vela_numerica" ? p[f] == null ? "" : p[f] ? "Sim" : "Não" : p[f] ?? ""));
  let begin = 1;
  for (let i = 2; i <= fields.length + 1; i++) {
    if (i === fields.length + 1 || block(fields[i - 1] ?? "") !== block(fields[begin - 1] ?? "")) {
      if (i - begin > 1) sheet.mergeCells(2, begin, 2, i - 1);
      begin = i;
    }
  }
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(5, sheet.rowCount), column: fields.length } };
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
      cell.font = { name: "Arial", size: row <= 4 ? 10 : 11, color: { argb: READ_FIELDS.includes(f) ? sheetColors.muted : sheetColors.ink }, bold: row >= 2 && row <= 3 };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: READ_FIELDS.includes(f) ? sheetColors.operations : row <= 4 ? sheetColors.header : sheetColors.paper } };
      if (["cod_cadastro", "sku", "ean", "dun"].includes(f)) cell.numFmt = "@";
      if (f.startsWith("preco_")) cell.numFmt = '#,##0.00;(#,##0.00);"-"';
    });
    const kind = dimensionFor(f) ?? (f === "canal_venda" ? "canal" : undefined);
    if (kind) for (let row = 5; row <= Math.max(5, sheet.rowCount); row++) sheet.getCell(row, i + 1).dataValidation = { type: "list", allowBlank: true, formulae: [`lista_${kind}`], showErrorMessage: true, errorStyle: "warning", errorTitle: "Valor fora da lista", error: "Valor novo será revisado na prévia." };
    if (f === "is_vela_numerica") for (let row = 5; row <= Math.max(5, sheet.rowCount); row++) sheet.getCell(row, i + 1).dataValidation = { type: "list", allowBlank: true, formulae: ['"Sim,Não"'], showErrorMessage: true, errorStyle: "warning", error: "Use Sim ou Não." };
  });
  sheet.getRow(2).height = 24; sheet.getRow(3).height = 45; sheet.getRow(4).height = 30;
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