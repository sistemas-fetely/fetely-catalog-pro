import jsPDF from "jspdf";
import type { Product } from "@/types";
import { getColecaoPhoto, getProdutoPhoto } from "@/store/photoStore";

const COLORS = {
  black: "#1a1a1a",
  gold: "#b8923a",
  text: "#2a2a2a",
  muted: "#6a6a6a",
  sep: "#e0e0e0",
};

export type CatalogVersion = "cliente" | "interno";

export type CatalogFieldKey =
  | "nomeComercial"
  | "sku"
  | "ean"
  | "codCadastro"
  | "corNome"
  | "cor"
  | "estampa"
  | "tamanho"
  | "referencia"
  | "material"
  | "materialDescritivo"
  | "tipoEmbalagem"
  | "dimensoes"
  | "peso"
  | "multiplos"
  | "qtdKit"
  | "ncm"
  | "cest"
  | "origemFisc"
  | "origemProd"
  | "linha"
  | "categoria"
  | "departamento"
  | "grupo"
  | "tipo"
  | "familia"
  | "subColecao2"
  | "descricaoProduto";

export const CATALOG_FIELDS: { key: CatalogFieldKey; label: string; group: string }[] = [
  { key: "nomeComercial", label: "Nome comercial", group: "Identificação" },
  { key: "sku", label: "SKU", group: "Identificação" },
  { key: "codCadastro", label: "Cód. Cadastro", group: "Identificação" },
  { key: "ean", label: "EAN", group: "Identificação" },
  { key: "linha", label: "Linha", group: "Hierarquia" },
  { key: "categoria", label: "Categoria", group: "Hierarquia" },
  { key: "departamento", label: "Departamento", group: "Hierarquia" },
  { key: "grupo", label: "Grupo", group: "Hierarquia" },
  { key: "tipo", label: "Tipo", group: "Hierarquia" },
  { key: "familia", label: "Família", group: "Hierarquia" },
  { key: "subColecao2", label: "Sub-coleção", group: "Hierarquia" },
  { key: "corNome", label: "Cor (nome)", group: "Atributos" },
  { key: "cor", label: "Cor", group: "Atributos" },
  { key: "estampa", label: "Estampa", group: "Atributos" },
  { key: "tamanho", label: "Tamanho", group: "Atributos" },
  { key: "referencia", label: "Referência", group: "Atributos" },
  { key: "material", label: "Material", group: "Embalagem" },
  { key: "materialDescritivo", label: "Material descritivo", group: "Embalagem" },
  { key: "tipoEmbalagem", label: "Tipo de embalagem", group: "Embalagem" },
  { key: "dimensoes", label: "Dimensões (L×A×P cm)", group: "Embalagem" },
  { key: "peso", label: "Peso (g)", group: "Embalagem" },
  { key: "multiplos", label: "Múltiplos (caixa)", group: "Embalagem" },
  { key: "qtdKit", label: "Qtd. por kit", group: "Embalagem" },
  { key: "ncm", label: "NCM", group: "Fiscal" },
  { key: "cest", label: "CEST", group: "Fiscal" },
  { key: "origemFisc", label: "Origem Fiscal", group: "Fiscal" },
  { key: "origemProd", label: "Origem Produto", group: "Fiscal" },
  { key: "descricaoProduto", label: "Descrição", group: "Descrição" },
];

export const DEFAULT_FIELDS: CatalogFieldKey[] = [
  "nomeComercial",
  "sku",
  "corNome",
  "tamanho",
  "material",
  "dimensoes",
  "multiplos",
];

interface PhotosState {
  colecoes: Record<string, string>;
  produtos: Record<string, string>;
}

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function sanitize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

interface LoadedImage {
  data: string;
  w: number;
  h: number;
}

// Carrega uma imagem e devolve dataURL + dimensões reais para preservar proporção.
async function urlToDataUrl(url: string, maxSize = 500): Promise<LoadedImage | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * ratio);
    const h = Math.round(bitmap.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return { data: canvas.toDataURL("image/jpeg", 0.82), w, h };
  } catch {
    return null;
  }
}

function variantesDaColecao(products: Product[], colecao: string): Product[] {
  const list = products.filter((p) => p.colecao === colecao && p.ativo !== false);
  const allTalheres = list.length > 0 && list.every((p) => p.grupo === "Talheres");
  const allNumerica = list.length > 0 && list.every((p) => p.numeroVela != null);
  if (allTalheres) {
    // Talheres: uma entrada por cor + tipo de peça (faca, garfo, colher…)
    const seen = new Set<string>();
    return list.filter((p) => {
      const key = `${p.corNome}|${p.tipo ?? ""}|${p.tamanhoRef ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  if (allNumerica) {
    const seen = new Set<string>();
    return list.filter((p) => {
      if (seen.has(p.corNome)) return false;
      seen.add(p.corNome);
      return true;
    });
  }

  const seen = new Set<string>();
  return list.filter((p) => {
    if (seen.has(p.sku)) return false;
    seen.add(p.sku);
    return true;
  });
}

interface BuildOpts {
  products: Product[];
  photos: PhotosState;
  colecoesSelecionadas: { nome: string; categoria: string }[];
  version: CatalogVersion;
  fields: CatalogFieldKey[];
  onProgress?: (pct: number, label: string) => void;
}

// Desenha a imagem mantendo a proporção (contain) dentro da caixa.
function drawContained(
  doc: jsPDF,
  img: LoadedImage,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) {
  const ratio = img.w / img.h;
  let dw = bw;
  let dh = bw / ratio;
  if (dh > bh) {
    dh = bh;
    dw = bh * ratio;
  }
  const dx = bx + (bw - dw) / 2;
  const dy = by + (bh - dh) / 2;
  // fundo neutro para o "letterbox"
  doc.setFillColor("#faf8f3");
  doc.rect(bx, by, bw, bh, "F");
  try {
    doc.addImage(img.data, "JPEG", dx, dy, dw, dh, undefined, "FAST");
  } catch {
    /* ignore */
  }
}

export async function buildCatalogPDF(opts: BuildOpts): Promise<Blob> {
  const { products, photos, colecoesSelecionadas, version, fields, onProgress } = opts;
  const fieldSet = new Set<CatalogFieldKey>(fields);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  // ── CAPA ──
  doc.setFillColor(COLORS.black);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(COLORS.gold);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(48);
  doc.text("FETÉLY", pageW / 2, pageH / 2 - 20, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor("#cccccc");
  doc.text("CATÁLOGO DE PRODUTOS", pageW / 2, pageH / 2 - 8, { align: "center" });
  doc.setFontSize(8);
  doc.text(
    version === "cliente"
      ? "Edição cliente — preços sugeridos"
      : "Edição interna — atacado + varejo",
    pageW / 2,
    pageH / 2 + 2,
    { align: "center" },
  );
  doc.setFontSize(7);
  doc.text(
    new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
    pageW / 2,
    pageH - 20,
    { align: "center" },
  );

  // Grid: 2 colunas × 3 linhas = 6 produtos
  const cols = 2;
  const rows = 3;
  const headerH = 22;
  const footerH = 10;
  const gridTop = headerH + 8;
  const gridBottom = pageH - footerH;
  const cellW = (pageW - margin * 2) / cols;
  const cellH = (gridBottom - gridTop) / rows;

  const total = colecoesSelecionadas.length;
  let pageNum = 0;

  for (let ci = 0; ci < colecoesSelecionadas.length; ci++) {
    const col = colecoesSelecionadas[ci];
    onProgress?.(ci / total, `Coleção ${col.nome}`);

    const variantes = variantesDaColecao(products, col.nome);
    if (variantes.length === 0) continue;

    const capaUrl = getColecaoPhoto(photos, col.nome, col.categoria);
    const capaImg = capaUrl ? await urlToDataUrl(capaUrl, 1200) : null;

    // ── PÁGINA DE ABERTURA DA COLEÇÃO ──
    doc.addPage();
    pageNum++;
    const capaH = pageH * 0.55;
    if (capaImg) {
      drawContained(doc, capaImg, 0, 0, pageW, capaH);
    } else {
      doc.setFillColor(COLORS.black);
      doc.rect(0, 0, pageW, capaH, "F");
    }
    doc.setTextColor(COLORS.gold);
    doc.setFontSize(9);
    doc.text(col.categoria.toUpperCase(), margin, capaH + 14);
    doc.setTextColor(COLORS.black);
    doc.setFontSize(32);
    doc.text(col.nome, margin, capaH + 26);

    const desc = variantes[0]?.descricaoColecao;
    if (desc) {
      doc.setFontSize(10);
      doc.setTextColor(COLORS.muted);
      const lines = doc.splitTextToSize(desc, pageW - margin * 2);
      doc.text(lines.slice(0, 6), margin, capaH + 36);
    }
    doc.setDrawColor(COLORS.gold);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
    doc.setFontSize(7);
    doc.setTextColor(COLORS.muted);
    doc.text(`${variantes.length} produtos`, margin, pageH - 9);
    doc.text("FETÉLY · Catálogo", pageW - margin, pageH - 9, { align: "right" });

    // ── PÁGINAS DE PRODUTOS ──
    for (let i = 0; i < variantes.length; i += cols * rows) {
      doc.addPage();
      pageNum++;
      doc.setTextColor(COLORS.gold);
      doc.setFontSize(7);
      doc.text(col.categoria.toUpperCase(), margin, 12);
      doc.setTextColor(COLORS.black);
      doc.setFontSize(16);
      doc.text(col.nome, margin, 19);
      doc.setDrawColor(COLORS.gold);
      doc.setLineWidth(0.3);
      doc.line(margin, 22, pageW - margin, 22);

      const slice = variantes.slice(i, i + cols * rows);
      const images = await Promise.all(
        slice.map(async (p) => {
          const key = p.grupo === "Talheres" || p.numeroVela != null ? p.corNome : p.sku;
          const url =
            getProdutoPhoto(photos, col.nome, key) ??
            getProdutoPhoto(photos, col.nome, p.corNome);
          return url ? await urlToDataUrl(url, 560) : null;
        }),
      );

      for (let k = 0; k < slice.length; k++) {
        const p = slice[k];
        const row = Math.floor(k / cols);
        const colIdx = k % cols;
        const x = margin + colIdx * cellW;
        const y = gridTop + row * cellH;
        renderProductCell(doc, p, x, y, cellW - 4, cellH - 4, images[k], version, fieldSet);
      }

      doc.setFontSize(7);
      doc.setTextColor(COLORS.muted);
      doc.text(`${col.nome} · ${col.categoria}`, margin, pageH - 5);
      doc.text(`pág. ${pageNum}`, pageW - margin, pageH - 5, { align: "right" });
    }
  }

  onProgress?.(1, "Finalizado");
  return doc.output("blob");
}

function fieldValue(p: Product, key: CatalogFieldKey): string | null {
  switch (key) {
    case "nomeComercial":
      return p.nomeComercial || p.nomeCompleto || null;
    case "sku":
      return p.sku || null;
    case "ean":
      return p.ean || null;
    case "codCadastro":
      return p.codCadastro || null;
    case "corNome":
      return p.corNome || null;
    case "cor":
      return p.cor || null;
    case "estampa":
      return p.estampa || null;
    case "tamanho":
      return p.tamanhoNumero || null;
    case "referencia":
      return p.tamanhoRef || null;
    case "material":
      return p.material || null;
    case "materialDescritivo":
      return p.materialDescritivo || null;
    case "tipoEmbalagem":
      return p.tipoEmbalagem || null;
    case "dimensoes": {
      const d = [p.larguraCm, p.alturaCm, p.profundidadeCm].filter((n) => n);
      return d.length ? `${d.join(" × ")} cm` : null;
    }
    case "peso":
      return p.pesoG ? `${p.pesoG} g` : null;
    case "multiplos":
      return p.multiplos ? String(p.multiplos) : null;
    case "qtdKit":
      return p.qtdKit ? String(p.qtdKit) : null;
    case "ncm":
      return p.ncm || null;
    case "cest":
      return p.cest || null;
    case "origemFisc":
      return p.origemFisc || null;
    case "origemProd":
      return p.origemProd || null;
    case "linha":
      return p.linha || null;
    case "categoria":
      return p.categoria || null;
    case "departamento":
      return p.departamento || null;
    case "grupo":
      return p.grupo || null;
    case "tipo":
      return p.tipo || null;
    case "familia":
      return p.familia || null;
    case "subColecao2":
      return p.subColecao2 || null;
    case "descricaoProduto":
      return p.descricaoProduto || null;
  }
}

function renderProductCell(
  doc: jsPDF,
  p: Product,
  x: number,
  y: number,
  w: number,
  h: number,
  img: LoadedImage | null,
  version: CatalogVersion,
  fields: Set<CatalogFieldKey>,
): void {
  doc.setDrawColor(COLORS.sep);
  doc.setLineWidth(0.15);
  doc.rect(x, y, w, h);

  // Adapta área da foto conforme nº de campos selecionados (menos campos = foto maior)
  const extraCount = Array.from(fields).filter(
    (k) => k !== "nomeComercial" && k !== "descricaoProduto",
  ).length;
  const imgFrac = extraCount > 14 ? 0.3 : extraCount > 8 ? 0.36 : extraCount > 4 ? 0.42 : 0.5;
  const imgH = h * imgFrac;
  const imgBoxX = x + 2;
  const imgBoxY = y + 2;
  const imgBoxW = w - 4;
  const imgBoxH = imgH - 4;
  if (img) {
    drawContained(doc, img, imgBoxX, imgBoxY, imgBoxW, imgBoxH);
  } else {
    doc.setFillColor("#f5f3ef");
    doc.rect(imgBoxX, imgBoxY, imgBoxW, imgBoxH, "F");
    doc.setTextColor(COLORS.muted);
    doc.setFontSize(7);
    doc.text("sem foto", x + w / 2, y + imgH / 2, { align: "center" });
  }

  let ty = y + imgH + 4;
  doc.setTextColor(COLORS.gold);
  doc.setFontSize(6);
  doc.text(`${p.grupo.toUpperCase()} · ${p.corNome}`, x + 3, ty);
  ty += 4;

  if (fields.has("nomeComercial")) {
    doc.setTextColor(COLORS.black);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    const nome = p.nomeComercial || p.nomeCompleto || p.sku;
    const nomeLines = doc.splitTextToSize(nome, w - 6);
    const shown = nomeLines.slice(0, 2);
    doc.text(shown, x + 3, ty);
    ty += shown.length * 3.4 + 1;
  }

  doc.setFont("helvetica", "normal");
  const fontSize = extraCount > 10 ? 5.5 : 6;
  doc.setFontSize(fontSize);
  doc.setTextColor(COLORS.muted);

  const priceBlockTop = y + h - 9;
  const lineH = extraCount > 10 ? 2.7 : 3.1;

  const SHORT_LABELS: Partial<Record<CatalogFieldKey, string>> = {
    sku: "SKU", ean: "EAN", codCadastro: "Cód.", ncm: "NCM", cest: "CEST",
    corNome: "Cor", cor: "Cor cód.", estampa: "Estampa", tamanho: "Tam.",
    referencia: "Ref.", material: "Mat.", materialDescritivo: "Mat. desc.",
    tipoEmbalagem: "Embal.", dimensoes: "Dim.", peso: "Peso", multiplos: "Múlt.",
    qtdKit: "Kit", origemFisc: "Orig. fisc.", origemProd: "Orig. prod.",
    linha: "Linha", categoria: "Cat.", departamento: "Depto.", grupo: "Grupo",
    tipo: "Tipo", familia: "Família", subColecao2: "Sub-col.",
  };

  type Row = { label: string; value: string; long: boolean };
  const rows: Row[] = [];
  for (const f of CATALOG_FIELDS) {
    if (f.key === "nomeComercial" || f.key === "descricaoProduto") continue;
    if (!fields.has(f.key)) continue;
    const v = fieldValue(p, f.key);
    if (!v) continue;
    const label = SHORT_LABELS[f.key] ?? f.label;
    rows.push({ label, value: v, long: v.length > 14 });
  }

  const shortRows = rows.filter((r) => !r.long);
  const longRows = rows.filter((r) => r.long);
  const colW = (w - 6) / 2;

  for (let i = 0; i < shortRows.length; i += 2) {
    if (ty + lineH > priceBlockTop) break;
    const a = shortRows[i];
    const b = shortRows[i + 1];
    doc.setTextColor(COLORS.muted);
    doc.text(`${a.label}:`, x + 3, ty);
    const aLW = doc.getTextWidth(`${a.label}: `);
    doc.setTextColor(COLORS.text);
    doc.text(doc.splitTextToSize(a.value, colW - aLW)[0] ?? a.value, x + 3 + aLW, ty);
    if (b) {
      doc.setTextColor(COLORS.muted);
      doc.text(`${b.label}:`, x + 3 + colW, ty);
      const bLW = doc.getTextWidth(`${b.label}: `);
      doc.setTextColor(COLORS.text);
      doc.text(doc.splitTextToSize(b.value, colW - bLW)[0] ?? b.value, x + 3 + colW + bLW, ty);
    }
    ty += lineH;
  }

  for (const r of longRows) {
    if (ty + lineH > priceBlockTop) break;
    doc.setTextColor(COLORS.muted);
    const labelStr = `${r.label}: `;
    doc.text(labelStr, x + 3, ty);
    const lw = doc.getTextWidth(labelStr);
    doc.setTextColor(COLORS.text);
    const lines = doc.splitTextToSize(r.value, w - 6 - lw);
    for (let i = 0; i < lines.length; i++) {
      if (ty + lineH > priceBlockTop) break;
      doc.text(lines[i], x + 3 + (i === 0 ? lw : 0), ty);
      ty += lineH;
    }
  }

  if (fields.has("descricaoProduto") && p.descricaoProduto && ty + lineH <= priceBlockTop) {
    doc.setFontSize(Math.max(5, fontSize - 0.5));
    doc.setTextColor(COLORS.text);
    const lines = doc.splitTextToSize(p.descricaoProduto, w - 6);
    for (const ln of lines) {
      if (ty + lineH > priceBlockTop) break;
      doc.text(ln, x + 3, ty);
      ty += lineH;
    }
  }

  // Bloco de preço (rodapé da célula)
  const pricesY = y + h - 4;
  doc.setFont("helvetica", "bold");
  if (version === "cliente") {
    doc.setFontSize(10);
    doc.setTextColor(COLORS.black);
    doc.text(formatBRL(p.precoVarejo), x + w - 3, pricesY, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(COLORS.muted);
    doc.text("preço sugerido", x + w - 3, pricesY - 4, { align: "right" });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(COLORS.gold);
    doc.text(formatBRL(p.precoAtacado), x + w - 3, pricesY, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(COLORS.muted);
    doc.text(`varejo ${formatBRL(p.precoVarejo)}`, x + w - 3, pricesY - 4, { align: "right" });
    doc.text("atacado", x + 3, pricesY, { align: "left" });
  }
}

export function downloadCatalogPDF(blob: Blob, version: CatalogVersion) {
  const ts = new Date().toISOString().slice(0, 10);
  const filename = `catalogo-fetely-${version}-${sanitize(ts)}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
