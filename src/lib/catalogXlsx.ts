import ExcelJS from "exceljs";
import type { Product } from "@/types";
import { getProdutoPhoto } from "@/store/photoStore";
import {
  CATALOG_FIELDS,
  type CatalogFieldKey,
  type CatalogVersion,
} from "./catalogPdf";

interface PhotosState {
  colecoes: Record<string, string>;
  produtos: Record<string, string>;
}

interface LoadedImage {
  base64: string;
  ext: "jpeg" | "png";
}

async function urlToBase64(url: string, maxSize = 320): Promise<LoadedImage | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * ratio));
    const h = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    return { base64: dataUrl.split(",")[1], ext: "jpeg" };
  } catch {
    return null;
  }
}

function fieldValue(p: Product, key: CatalogFieldKey): string | number | null {
  switch (key) {
    case "nomeComercial": return p.nomeComercial || p.nomeCompleto || null;
    case "sku": return p.sku || null;
    case "ean": return p.ean || null;
    case "codCadastro": return p.codCadastro || null;
    case "corNome": return p.corNome || null;
    case "cor": return p.cor || null;
    case "estampa": return p.estampa || null;
    case "tamanho": return p.tamanhoNumero || null;
    case "referencia": return p.tamanhoRef || null;
    case "material": return p.material || null;
    case "materialDescritivo": return p.materialDescritivo || null;
    case "tipoEmbalagem": return p.tipoEmbalagem || null;
    case "dimensoes": {
      const d = [p.larguraCm, p.alturaCm, p.profundidadeCm].filter((n) => n);
      return d.length ? `${d.join(" × ")} cm` : null;
    }
    case "peso": return p.pesoG ? `${p.pesoG} g` : null;
    case "multiplos": return p.multiplos ?? null;
    case "qtdKit": return p.qtdKit ?? null;
    case "ncm": return p.ncm || null;
    case "cest": return p.cest || null;
    case "origemFisc": return p.origemFisc || null;
    case "origemProd": return p.origemProd || null;
    case "linha": return p.linha || null;
    case "categoria": return p.categoria || null;
    case "departamento": return p.departamento || null;
    case "grupo": return p.grupo || null;
    case "tipo": return p.tipo || null;
    case "familia": return p.familia || null;
    case "subColecao2": return p.subColecao2 || null;
    case "descricaoProduto": return p.descricaoProduto || null;
  }
}

function variantesDaColecao(products: Product[], colecao: string): Product[] {
  const list = products.filter((p) => p.colecao === colecao && p.ativo !== false);
  const allTalheres = list.length > 0 && list.every((p) => p.grupo === "Talheres");
  if (allTalheres) {
    const seen = new Set<string>();
    return list.filter((p) => {
      if (seen.has(p.corNome)) return false;
      seen.add(p.corNome);
      return true;
    });
  }
  // Velas numéricas e demais: uma linha por SKU (cor + número + tamanho)
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
  includePhotos: boolean;
  onProgress?: (pct: number, label: string) => void;
}

export async function buildCatalogXLSX(opts: BuildOpts): Promise<Blob> {
  const {
    products,
    photos,
    colecoesSelecionadas,
    version,
    fields,
    includePhotos,
    onProgress,
  } = opts;
  const fieldSet = new Set<CatalogFieldKey>(fields);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Fetély B2B";
  wb.created = new Date();
  const ws = wb.addWorksheet("Catálogo", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const orderedFields = CATALOG_FIELDS
    .map((f) => f.key)
    .filter((k) => fieldSet.has(k));

  // Cabeçalho
  const headers: string[] = [];
  if (includePhotos) headers.push("Foto");
  headers.push("Coleção", "Categoria");
  for (const k of orderedFields) {
    const def = CATALOG_FIELDS.find((f) => f.key === k);
    headers.push(def?.label ?? k);
  }
  headers.push("Previsão");
  if (version === "cliente") {
    headers.push("Preço varejo (R$)");
  } else {
    headers.push("Preço atacado (R$)", "Preço varejo (R$)");
  }
  ws.addRow(headers);

  // Larguras
  const widths: number[] = [];
  if (includePhotos) widths.push(16);
  widths.push(22, 18);
  for (const k of orderedFields) {
    const w =
      k === "nomeComercial" || k === "descricaoProduto" || k === "materialDescritivo"
        ? 34
        : k === "ean" || k === "sku" || k === "codCadastro"
          ? 18
          : 14;
    widths.push(w);
  }
  widths.push(16); // Previsão
  widths.push(16);
  if (version === "interno") widths.push(16);
  ws.columns = widths.map((w) => ({ width: w }));


  // Style do cabeçalho
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1A1A1A" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 26;

  const photoColIdx = includePhotos ? 1 : 0; // 1-based, ou 0 quando ausente
  const photoRowHeightPt = 70; // ~93 px
  const photoCellPx = 84;

  let currentRow = 2;
  const total = Math.max(1, colecoesSelecionadas.length);

  for (let ci = 0; ci < colecoesSelecionadas.length; ci++) {
    const col = colecoesSelecionadas[ci];
    onProgress?.(ci / total, `Coleção ${col.nome}`);

    const variantes = variantesDaColecao(products, col.nome);
    if (variantes.length === 0) continue;

    // Linha de seção
    const sectionRow = ws.addRow([`${col.categoria} · ${col.nome} (${variantes.length})`]);
    ws.mergeCells(currentRow, 1, currentRow, headers.length);
    sectionRow.font = { bold: true, color: { argb: "FFB8923A" }, size: 11 };
    sectionRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFAF6EC" },
    };
    sectionRow.alignment = { vertical: "middle", horizontal: "left" };
    sectionRow.height = 20;
    currentRow++;

    // Pré-carrega fotos da fatia
    const images = includePhotos
      ? await Promise.all(
          variantes.map(async (p) => {
            const key = p.grupo === "Talheres" || p.numeroVela != null ? p.corNome : p.sku;
            const url =
              getProdutoPhoto(photos, col.nome, key) ??
              getProdutoPhoto(photos, col.nome, p.corNome);
            return url ? await urlToBase64(url, 320) : null;
          }),
        )
      : variantes.map(() => null);

    for (let pi = 0; pi < variantes.length; pi++) {
      const p = variantes[pi];
      const row: (string | number | null)[] = [];
      if (includePhotos) row.push(null);
      row.push(col.nome, col.categoria);
      for (const k of orderedFields) row.push(fieldValue(p, k));
      row.push(p.statusEstoque || "—");
      if (version === "cliente") {
        row.push(p.precoVarejo ?? null);
      } else {
        row.push(p.precoAtacado ?? null, p.precoVarejo ?? null);
      }

      const r = ws.addRow(row);
      r.alignment = { vertical: "middle", wrapText: true };
      r.font = { size: 9 };

      // Formato moeda
      const priceColStart = headers.length - (version === "interno" ? 1 : 0);
      if (version === "cliente") {
        const c = r.getCell(headers.length);
        c.numFmt = '"R$" #,##0.00';
        c.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        const c1 = r.getCell(headers.length - 1);
        const c2 = r.getCell(headers.length);
        c1.numFmt = '"R$" #,##0.00';
        c2.numFmt = '"R$" #,##0.00';
        c1.alignment = { horizontal: "right", vertical: "middle" };
        c2.alignment = { horizontal: "right", vertical: "middle" };
      }
      void priceColStart;

      if (includePhotos) {
        r.height = photoRowHeightPt;
        const img = images[pi];
        if (img) {
          const imageId = wb.addImage({ base64: img.base64, extension: img.ext });
          ws.addImage(imageId, {
            tl: { col: photoColIdx - 1 + 0.1, row: currentRow - 1 + 0.1 },
            ext: { width: photoCellPx, height: photoCellPx },
            editAs: "oneCell",
          });
        }
      }

      currentRow++;
    }
  }

  onProgress?.(1, "Finalizado");

  // Filtros automáticos no header
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadCatalogXLSX(blob: Blob, version: CatalogVersion): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `catalogo-fetely-${version}-${date}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
