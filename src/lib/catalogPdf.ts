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

// Carrega uma imagem para dataURL (jpeg) com tamanho máximo para reduzir peso.
async function urlToDataUrl(url: string, maxSize = 500): Promise<string | null> {
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
    return canvas.toDataURL("image/jpeg", 0.78);
  } catch {
    return null;
  }
}

function variantesDaColecao(products: Product[], colecao: string): Product[] {
  const list = products.filter((p) => p.colecao === colecao && p.ativo !== false);
  const allTalheres = list.length > 0 && list.every((p) => p.grupo === "Talheres");
  const allNumerica = list.length > 0 && list.every((p) => p.numeroVela != null);
  if (allTalheres || allNumerica) {
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
  onProgress?: (pct: number, label: string) => void;
}

export async function buildCatalogPDF(opts: BuildOpts): Promise<Blob> {
  const { products, photos, colecoesSelecionadas, version, onProgress } = opts;
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
    version === "cliente" ? "Edição cliente — preços sugeridos" : "Edição interna — atacado + varejo",
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

    // Carrega capa da coleção
    const capaUrl = getColecaoPhoto(photos, col.nome, col.categoria);
    const capaData = capaUrl ? await urlToDataUrl(capaUrl, 1100) : null;

    // ── PÁGINA DE ABERTURA DA COLEÇÃO ──
    doc.addPage();
    pageNum++;
    if (capaData) {
      try {
        doc.addImage(capaData, "JPEG", 0, 0, pageW, pageH * 0.55, undefined, "FAST");
      } catch {/* ignore */}
    } else {
      doc.setFillColor(COLORS.black);
      doc.rect(0, 0, pageW, pageH * 0.55, "F");
    }
    // overlay textos
    doc.setTextColor(COLORS.gold);
    doc.setFontSize(9);
    doc.text(col.categoria.toUpperCase(), margin, pageH * 0.55 + 14);
    doc.setTextColor(COLORS.black);
    doc.setFontSize(32);
    doc.text(col.nome, margin, pageH * 0.55 + 26);

    const desc = variantes[0]?.descricaoColecao;
    if (desc) {
      doc.setFontSize(10);
      doc.setTextColor(COLORS.muted);
      const lines = doc.splitTextToSize(desc, pageW - margin * 2);
      doc.text(lines.slice(0, 6), margin, pageH * 0.55 + 36);
    }
    doc.setDrawColor(COLORS.gold);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
    doc.setFontSize(7);
    doc.setTextColor(COLORS.muted);
    doc.text(`${variantes.length} produtos`, margin, pageH - 9);
    doc.text("FETÉLY · Catálogo", pageW - margin, pageH - 9, { align: "right" });

    // ── PÁGINAS DE PRODUTOS (6 por página) ──
    for (let i = 0; i < variantes.length; i += cols * rows) {
      doc.addPage();
      pageNum++;
      // header da página
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
      // carrega imagens em paralelo
      const images = await Promise.all(
        slice.map(async (p) => {
          const key = p.grupo === "Talheres" || p.numeroVela != null ? p.corNome : p.sku;
          const url =
            getProdutoPhoto(photos, col.nome, key) ??
            getProdutoPhoto(photos, col.nome, p.corNome);
          return url ? await urlToDataUrl(url, 520) : null;
        }),
      );

      for (let k = 0; k < slice.length; k++) {
        const p = slice[k];
        const row = Math.floor(k / cols);
        const colIdx = k % cols;
        const x = margin + colIdx * cellW;
        const y = gridTop + row * cellH;
        renderProductCell(doc, p, x, y, cellW - 4, cellH - 4, images[k], version);
      }

      // footer
      doc.setFontSize(7);
      doc.setTextColor(COLORS.muted);
      doc.text(`${col.nome} · ${col.categoria}`, margin, pageH - 5);
      doc.text(`pág. ${pageNum}`, pageW - margin, pageH - 5, { align: "right" });
    }
  }

  onProgress?.(1, "Finalizado");
  return doc.output("blob");
}

function renderProductCell(
  doc: jsPDF,
  p: Product,
  x: number,
  y: number,
  w: number,
  h: number,
  img: string | null,
  version: CatalogVersion,
): void {
  // borda sutil
  doc.setDrawColor(COLORS.sep);
  doc.setLineWidth(0.15);
  doc.rect(x, y, w, h);

  // imagem ocupa ~55% da altura
  const imgH = h * 0.55;
  if (img) {
    try {
      doc.addImage(img, "JPEG", x + 2, y + 2, w - 4, imgH - 4, undefined, "FAST");
    } catch {/* ignore */}
  } else {
    doc.setFillColor("#f5f3ef");
    doc.rect(x + 2, y + 2, w - 4, imgH - 4, "F");
    doc.setTextColor(COLORS.muted);
    doc.setFontSize(7);
    doc.text("sem foto", x + w / 2, y + imgH / 2, { align: "center" });
  }

  // bloco texto
  let ty = y + imgH + 4;
  doc.setTextColor(COLORS.gold);
  doc.setFontSize(6);
  doc.text(`${p.grupo.toUpperCase()} · ${p.corNome}`, x + 3, ty);
  ty += 4;

  doc.setTextColor(COLORS.black);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const nome = p.nomeComercial || p.nomeCompleto || p.sku;
  const nomeLines = doc.splitTextToSize(nome, w - 6);
  doc.text(nomeLines.slice(0, 2), x + 3, ty);
  ty += nomeLines.length > 1 ? 7 : 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(COLORS.muted);
  const specs: string[] = [];
  if (p.tamanhoNumero) specs.push(p.tamanhoNumero);
  if (p.material) specs.push(p.material);
  if (p.pesoG) specs.push(`${p.pesoG}g`);
  if (specs.length) {
    doc.text(specs.join(" · "), x + 3, ty);
    ty += 3.5;
  }
  const dims = [p.larguraCm, p.alturaCm, p.profundidadeCm].filter((n) => n);
  if (dims.length) {
    doc.text(`${dims.join(" × ")} cm`, x + 3, ty);
    ty += 3.5;
  }

  doc.setFontSize(5.5);
  doc.text(`SKU ${p.sku}`, x + 3, ty);
  ty += 3;

  // preço (no rodapé da célula)
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
  // múltiplos
  doc.setFontSize(5.5);
  doc.setTextColor(COLORS.muted);
  doc.text(`múlt. ${p.multiplos}`, x + 3, pricesY - 4, { align: "left" });
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
