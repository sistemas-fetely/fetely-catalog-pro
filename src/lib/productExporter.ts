import type { Product } from "@/types";

// Todas as colunas do cadastro de produto (mesma ordem visual do editor)
const COLUMNS: { key: keyof Product; label: string }[] = [
  { key: "sku", label: "SKU" },
  { key: "codCadastro", label: "Cod. Cadastro" },
  { key: "ean", label: "EAN" },
  { key: "ativo", label: "Ativo" },
  { key: "marca", label: "Marca" },
  { key: "linha", label: "Linha" },
  { key: "categoria", label: "Categoria" },
  { key: "departamento", label: "Departamento" },
  { key: "grupo", label: "Grupo" },
  { key: "tipo", label: "Tipo" },
  { key: "familia", label: "Família" },
  { key: "colecao", label: "Coleção" },
  { key: "subColecao", label: "Sub-coleção" },
  { key: "subColecao2", label: "Sub-coleção 2" },
  { key: "corNome", label: "Cor (nome)" },
  { key: "cor", label: "Cor (hex)" },
  { key: "estampa", label: "Estampa" },
  { key: "tamanhoNumero", label: "Tamanho número" },
  { key: "tamanhoRef", label: "Tamanho ref" },
  { key: "nomeComercial", label: "Nome Comercial" },
  { key: "nomeCompleto", label: "Nome Completo" },
  { key: "metaDescricao", label: "Meta Descrição" },
  { key: "descricaoColecao", label: "Descrição Coleção" },
  { key: "descricaoProduto", label: "Descrição Produto" },
  { key: "ncm", label: "NCM" },
  { key: "cest", label: "CEST" },
  { key: "origemFisc", label: "Origem Fiscal" },
  { key: "origemProd", label: "Origem Produto" },
  { key: "tipoEmbalagem", label: "Tipo Embalagem" },
  { key: "material", label: "Material" },
  { key: "materialDescritivo", label: "Material descritivo" },
  { key: "pesoG", label: "Peso (g)" },
  { key: "larguraCm", label: "Largura (cm)" },
  { key: "alturaCm", label: "Altura (cm)" },
  { key: "profundidadeCm", label: "Profundidade (cm)" },
  { key: "multiplos", label: "Múltiplos" },
  { key: "qtdKit", label: "Qtd. Kit" },
  { key: "precoVarejo", label: "Preço Varejo" },
  { key: "precoAtacado", label: "Preço Atacado" },
  { key: "statusEstoque", label: "Status Estoque" },
  { key: "isVelaNumerica", label: "Vela Numérica" },
  { key: "numeroVela", label: "Número Vela" },
];

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "sim" : "não";
  return String(v);
}

function escapeCSV(v: string): string {
  if (/[",;\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function download(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function exportProductsCSV(products: Product[], sep: "," | ";" = ";") {
  const header = COLUMNS.map((c) => escapeCSV(c.label)).join(sep);
  const rows = products.map((p) =>
    COLUMNS.map((c) => escapeCSV(cell(p[c.key]))).join(sep),
  );
  // BOM para Excel reconhecer UTF-8
  const csv = "\uFEFF" + [header, ...rows].join("\r\n");
  download(`cadastro-produtos-${timestamp()}.csv`, csv, "text/csv;charset=utf-8");
}

export function exportProductsJSON(products: Product[]) {
  const payload = {
    exportadoEm: new Date().toISOString(),
    total: products.length,
    produtos: products,
  };
  download(
    `cadastro-produtos-${timestamp()}.json`,
    JSON.stringify(payload, null, 2),
    "application/json",
  );
}
