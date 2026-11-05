// @ts-ignore Bun supplies the test runner
import { test, expect } from "bun:test";
import ExcelJS from "exceljs";
import { PRODUCT_FIELDS, validateSheet, selectedChanges, type CatalogLists } from "./catalogSpreadsheet";
import { catalogWorkbook } from "./catalogSpreadsheetExcel";
const lists: CatalogLists = { grupo: [{ id: "g", nome: "Velas", categoria_id: "c" }], colecao: [{ id: "co", nome: "Coleção" }], cor: [{ id: "red", nome: "Vermelho" }], canais: ["b2b"], categorias: [{ id: "c", nome: "Festa" }] };
const products = [{ cod_cadastro: "001", nome_comercial: "Vela", fase: "registrado", ativo: false, preco_atacado: 10, multiplos: 6, qtd_kit: 1, grupo: "Velas", colecao: "Coleção", cor: "Vermelho", cor_nome: "Vermelho", categoria: "Festa" }, { cod_cadastro: "002", nome_comercial: "Outra", fase: "ativo", preco_atacado: 20 }];
function sheet(slugs: string[], rows: unknown[][]) { const book = new ExcelJS.Workbook(); const s = book.addWorksheet("teste"); s.addRow(slugs); rows.forEach(r => s.addRow(r)); return s; }
test("Operações, fase e ativo não entram no conjunto gravável", () => {
  for (const f of ["sku", "ean", "dun", "fase", "ativo", "ncm", "cest", "inner_qtd", "nome_operacional", "grupo_tributario_bling"]) expect(PRODUCT_FIELDS.includes(f as never)).toBe(false);
  const p = validateSheet(sheet(["cod_cadastro", "fase", "inner_qtd", "_ativo", "nome_comercial", "desconhecido"], [["001", "ativo", 999, true, "Novo", "x"]]), products, lists);
  expect(p.ignoredColumns).toBe(4); expect(p.products[0]?.changes.map(c => c.field)).toEqual(["nome_comercial"]);
});
test("célula vazia e valores iguais preservam dados atuais", () => {
  expect(validateSheet(sheet(["cod_cadastro", "nome_comercial", "preco_atacado"], [["001", "", 10]]), products, lists).products).toHaveLength(0);
});
test("preços aceitam zero e rejeitam negativos sem impedir outras linhas", () => {
  const p = validateSheet(sheet(["cod_cadastro", "preco_atacado"], [["001", -1], ["002", 0]]), products, lists);
  expect(p.errors).toHaveLength(1); expect(p.errors[0]?.row).toBe(2); expect(p.products[0]?.changes[0]?.after).toBe(0);
});
test("múltiplos e kit exigem inteiro ≥ 1", () => {
  for (const f of ["multiplos", "qtd_kit"]) for (const v of [0, -1, 1.5]) expect(validateSheet(sheet(["cod_cadastro", f], [["001", v]]), products, lists).errors).toHaveLength(1);
});
test("vela numérica aceita Sim e Não", () => {
  expect(validateSheet(sheet(["cod_cadastro", "is_vela_numerica"], [["001", "Sim"]]), products, lists).products[0]?.changes[0]?.after).toBe(true);
  expect(validateSheet(sheet(["cod_cadastro", "is_vela_numerica"], [["001", "Não"]]), products, lists).products[0]?.changes[0]?.after).toBe(false);
  expect(validateSheet(sheet(["cod_cadastro", "is_vela_numerica"], [["001", "Talvez"]]), products, lists).errors).toHaveLength(1);
});
test("canal exige slug existente e código deve existir", () => {
  expect(validateSheet(sheet(["cod_cadastro", "canal_venda"], [["001", "inventado"]]), products, lists).errors).toHaveLength(1);
  expect(validateSheet(sheet(["cod_cadastro", "preco_atacado"], [["999", 1]]), products, lists).errors).toHaveLength(1);
});
test("dimensões casam sem maiúscula e acento e novos valores ficam fora por padrão", () => {
  const p = validateSheet(sheet(["cod_cadastro", "colecao", "cor", "nome_comercial"], [["001", "COLECAO", "Rosa", "Nova vela"]]), products, lists);
  expect(p.newValues).toHaveLength(1); expect(selectedChanges(p, new Set())[0]?.changes.map(c => c.field)).toEqual(["nome_comercial"]);
  expect(selectedChanges(p, new Set(p.newValues.map(v => v.key)))[0]?.changes).toHaveLength(3);
});
test("sem slug tem erro claro; código duplicado não sobrescreve outro", () => {
  expect(() => validateSheet(sheet(["Código"], [["001"]]), products, lists)).toThrow("use a planilha baixada nesta aba");
  expect(validateSheet(sheet(["cod_cadastro", "nome_comercial"], [["001", "A"], ["001", "B"]]), products, lists).errors).toHaveLength(1);
});
test("fórmula não vira gravação silenciosa", () => {
  expect(validateSheet(sheet(["cod_cadastro", "preco_atacado"], [["001", { formula: "1+1", result: 2 }]]), products, lists).errors).toHaveLength(1);
});
test("cor e cor_nome seguem o mesmo valor para resolução de cor_id", () => {
  const p = validateSheet(sheet(["cod_cadastro", "cor"], [["001", "Rosa"]]), products, lists);
  expect(p.products[0]?.changes.map(c => c.field)).toEqual(["cor", "cor_nome"]);
  expect(selectedChanges(p, new Set()).length).toBe(0);
});
test("planilha baixada é relida com os dados a partir da linha 5", async () => {
  const book = await catalogWorkbook(products, lists); const s = book.getWorksheet("Catálogo"); if (!s) throw new Error("sem folha");
  const slugs = s.getRow(3).values as string[]; const col = slugs.indexOf("nome_comercial"); s.getCell(5, col).value = "Revisada";
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await book.xlsx.writeBuffer());
  const read = loaded.getWorksheet("Catálogo"); if (!read) throw new Error("sem folha");
  const p = validateSheet(read, products, lists); expect(p.products).toHaveLength(1); expect(p.products[0]?.row).toBe(5); expect(p.products[0]?.changes[0]?.after).toBe("Revisada");
});
for (const field of ["peso_g", "altura_cm", "largura_cm", "profundidade_cm"]) {
  test(`${field} pertence a Produto e exige número positivo com vírgula decimal`, () => {
    expect(PRODUCT_FIELDS.includes(field as never)).toBe(true);
    expect(validateSheet(sheet(["cod_cadastro", field], [["001", "12,5"]]), products, lists).products[0]?.changes[0]?.after).toBe(12.5);
    for (const value of [0, -1, "abc"]) expect(validateSheet(sheet(["cod_cadastro", field], [["001", value]]), products, lists).errors).toHaveLength(1);
  });
}
for (const field of ["material", "tipo_embalagem"]) {
  test(`${field} aceita texto livre aparado sem criar dimensão`, () => {
    const p = validateSheet(sheet(["cod_cadastro", field], [["001", "  Texto livre  "]]), products, lists);
    expect(p.products[0]?.changes[0]?.after).toBe("Texto livre");
    expect(p.newValues).toHaveLength(0);
    expect(p.errors).toHaveLength(0);
  });
}
test("slugs nas primeiras cinco linhas e layout antigo continuam aceitos", () => {
  for (let n = 1; n <= 5; n++) {
    const s = sheet([], []);
    for (let i = 1; i < n; i++) s.addRow(["cabeçalho"]);
    s.addRow(["cod_cadastro", "material"]); s.addRow(["001", "Cerâmica"]);
    expect(validateSheet(s, products, lists).products[0]?.changes[0]?.after).toBe("Cerâmica");
  }
  const old = sheet(["_sistema", "cod_cadastro", "material"], [["Identidade"], ["FOP", "Código de cadastro"], ["→ FOP"], ["FOP", "001", "Vidro"]]);
  expect(validateSheet(old, products, lists).products[0]?.row).toBe(5);
  const late = sheet([], []); for (let i = 1; i <= 5; i++) late.addRow(["cabeçalho"]);
  late.addRow(["cod_cadastro"]);
  expect(() => validateSheet(late, products, lists)).toThrow("use a planilha baixada nesta aba");
});
test("colunas auxiliares são ignoradas mesmo quando preenchidas", () => {
  const p = validateSheet(sheet(["cod_cadastro", "inner_qtd", "_fase_sncf", "_ativo", "nome_operacional", "grupo_tributario_bling", "_tem_descricao", "material"], [["001", 3, "ativo", true, "X", "Y", true, "Vidro"]]), products, lists);
  expect(p.ignoredColumns).toBe(6); expect(p.products[0]?.changes.map(c => c.field)).toEqual(["material"]);
});