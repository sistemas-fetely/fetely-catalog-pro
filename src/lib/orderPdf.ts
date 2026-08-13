import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CartItem, Product, SavedOrder } from "@/types";
import type { Cotacao } from "@/types/cotacao";
import type { ProvisaoFutura } from "@/types/provisao";
import { FRETE_PERCENT, getBonusPixPercent, formatPercentBR } from "@/lib/commercial";
import { emEstoque } from "@/lib/classifyItem";
import { usePhotos, getProdutoPhoto } from "@/store/photoStore";

type GrupoColecao = { colecao: string; items: CartItem[]; subtotal: number; qtd: number };
type SecaoItens = { tipo: "firme" | "provisao"; titulo: string; grupos: GrupoColecao[]; subtotal: number; qtd: number };

interface LoadedImage { data: string; w: number; h: number }
type ThumbMap = Map<string, LoadedImage>;

async function urlToDataUrl(url: string, maxSize = 200): Promise<LoadedImage | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * ratio);
    const h = Math.round(bitmap.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return { data: canvas.toDataURL("image/jpeg", 0.8), w, h };
  } catch { return null; }
}

async function loadItemThumbs(items: CartItem[]): Promise<ThumbMap> {
  const photos = usePhotos.getState();
  const map: ThumbMap = new Map();
  const seen = new Map<string, string>(); // sku -> url
  for (const it of items) {
    const colecao = it.product.colecao || "";
    const cor = it.product.corNome || "";
    const grupo = (it.product as { grupo?: string }).grupo || "";
    const numeroVela = (it.product as { numeroVela?: number | null }).numeroVela;
    if (!colecao) continue;
    // Mesma lógica do catálogo: talheres e velas numéricas usam corNome como chave,
    // demais produtos usam o SKU. Fallback para corNome se o SKU não tiver foto.
    const primary = grupo === "Talheres" || numeroVela != null ? cor : it.sku;
    const url =
      (primary && getProdutoPhoto(photos, colecao, primary)) ||
      (cor && getProdutoPhoto(photos, colecao, cor)) ||
      undefined;
    if (url) seen.set(it.sku, url);
  }
  await Promise.all(
    Array.from(seen.entries()).map(async ([sku, url]) => {
      const img = await urlToDataUrl(url);
      if (img) map.set(sku, img);
    }),
  );
  return map;
}

// Ordem macro: Mesa Posta → Jogos Americanos → Taças → Velas
function macroRank(p: Product): number {
  const g = (p.grupo || "").toLowerCase();
  if (g === "prato" || g === "guardanapo" || g === "travessa" || g === "talheres") return 1; // Mesa posta
  if (g === "jogo americano") return 2;
  if (g === "copos e taças" || g === "copos e tacas") return 3;
  if (g === "vela") return 4;
  return 5;
}

function normalizeSortKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function looksLikeCandleProduct(p: Product): boolean {
  const text = normalizeSortKey([p.grupo, p.tipo, p.familia, p.nomeComercial, p.nomeCompleto].filter(Boolean).join(" "));
  return text.includes("vela");
}

function inferSequenceNumber(p: Product): number | null {
  if (typeof p.numeroVela === "number" && Number.isFinite(p.numeroVela)) return p.numeroVela;
  const skuLastSegment = String(p.sku ?? "").match(/[.-](\d+)$/);
  if ((p.isVelaNumerica || looksLikeCandleProduct(p)) && skuLastSegment) {
    return Number(skuLastSegment[1]);
  }
  const haystack = [p.nomeComercial, p.nomeCompleto, p.tamanhoNumero, p.tamanhoRef, p.sku]
    .filter(Boolean)
    .join(" ");
  const match =
    haystack.match(/(?:n[º°o]?|num(?:ero)?|número)\s*[.:#-]?\s*(\d+)/i) ||
    haystack.match(/[.-](\d+)\b/);
  return match ? Number(match[1]) : null;
}

function modelKeyForPdf(p: Product): string {
  const base = p.familia || p.tipo || p.grupo || p.nomeComercial || "";
  return normalizeSortKey(base.replace(/(?:n[º°o]?|num(?:ero)?|número)\s*[.:#-]?\s*\d+/gi, ""));
}

function isVelaNumericaForPdf(p: Product): boolean {
  return !!p.isVelaNumerica || (looksLikeCandleProduct(p) && inferSequenceNumber(p) !== null);
}

function compareCartItemsForPdf(a: CartItem, b: CartItem): number {
  const colecaoA = normalizeSortKey(a.product.colecao || "—");
  const colecaoB = normalizeSortKey(b.product.colecao || "—");
  const cmpColecao = colecaoA.localeCompare(colecaoB, "pt-BR", { numeric: true });
  if (cmpColecao !== 0) return cmpColecao;

  const ra = macroRank(a.product);
  const rb = macroRank(b.product);
  if (ra !== rb) return ra - rb;

  const cmpModelo = modelKeyForPdf(a.product).localeCompare(modelKeyForPdf(b.product), "pt-BR", { numeric: true });
  if (cmpModelo !== 0) return cmpModelo;

  const tamA = normalizeSortKey(a.product.tamanhoRef || a.product.tamanhoNumero || "");
  const tamB = normalizeSortKey(b.product.tamanhoRef || b.product.tamanhoNumero || "");
  const cmpTam = tamA.localeCompare(tamB, "pt-BR", { numeric: true });
  if (cmpTam !== 0) return cmpTam;

  const corA = normalizeSortKey(a.product.corNome || a.product.cor || "");
  const corB = normalizeSortKey(b.product.corNome || b.product.cor || "");

  // Velas numéricas precisam sair em sequência completa por cor:
  // Moss Green 0–9, depois Pink Bronze 0–9, sem alternar 0/0, 1/1...
  if (isVelaNumericaForPdf(a.product) || isVelaNumericaForPdf(b.product)) {
    const cmpCorVela = corA.localeCompare(corB, "pt-BR", { numeric: true });
    if (cmpCorVela !== 0) return cmpCorVela;
  }

  const numA = inferSequenceNumber(a.product);
  const numB = inferSequenceNumber(b.product);
  if (numA !== null || numB !== null) {
    if (numA === null) return 1;
    if (numB === null) return -1;
    if (numA !== numB) return numA - numB;
  }

  const cmpCor = corA.localeCompare(corB, "pt-BR", { numeric: true });
  if (cmpCor !== 0) return cmpCor;

  return normalizeSortKey(a.product.nomeComercial || a.product.nomeCompleto || a.sku).localeCompare(
    normalizeSortKey(b.product.nomeComercial || b.product.nomeCompleto || b.sku),
    "pt-BR",
    { numeric: true },
  );
}

function agruparItensPorSecao(items: CartItem[]): SecaoItens[] {
  const firmes: CartItem[] = [];
  const prov: CartItem[] = [];
  for (const it of items) {
    if (emEstoque(it.product)) firmes.push(it);
    else prov.push(it);
  }
  const fazGrupos = (arr: CartItem[]): { grupos: GrupoColecao[]; subtotal: number; qtd: number } => {
    const map = new Map<string, { colecao: string; items: CartItem[] }>();
    for (const it of arr) {
      const colecao = (it.product.colecao || "—").replace(/\s+/g, " ").trim() || "—";
      const k = normalizeSortKey(colecao);
      const group = map.get(k) ?? { colecao, items: [] };
      group.items.push(it);
      map.set(k, group);
    }
    const grupos = Array.from(map.values())
      .map(({ colecao, items }) => {
        const itemsOrdenados = [...items].sort(compareCartItemsForPdf);
        const subtotal = itemsOrdenados.reduce((s, i) => s + i.product.precoAtacado * i.quantity, 0);
        const qtd = itemsOrdenados.reduce((s, i) => s + i.quantity, 0);
        const rankColecao = Math.min(...itemsOrdenados.map((i) => macroRank(i.product)));
        return { colecao, items: itemsOrdenados, subtotal, qtd, rank: rankColecao };
      })
      .sort((a, b) => {
        const cmpColecao = normalizeSortKey(a.colecao).localeCompare(normalizeSortKey(b.colecao), "pt-BR", { numeric: true });
        if (cmpColecao !== 0) return cmpColecao;
        return a.rank - b.rank;
      })
      .map(({ rank: _r, ...g }) => g);
    const subtotal = grupos.reduce((s, g) => s + g.subtotal, 0);
    const qtd = grupos.reduce((s, g) => s + g.qtd, 0);
    return { grupos, subtotal, qtd };
  };
  const secoes: SecaoItens[] = [];
  if (firmes.length) {
    const r = fazGrupos(firmes);
    secoes.push({ tipo: "firme", titulo: "PRONTA ENTREGA", ...r });
  }
  if (prov.length) {
    const r = fazGrupos(prov);
    secoes.push({ tipo: "provisao", titulo: "PROVISÃO FUTURA", ...r });
  }
  return secoes;
}


const COLORS = {
  black: "#1a1a1a",
  gold: "#b8923a",
  textSecondary: "#6a6a6a",
  separator: "#e0e0e0",
};

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function sanitizeFilename(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export interface OrderPDFResult {
  blob: Blob;
  base64: string;
  filename: string;
  dataUrl: string;
}

function renderOrderToDoc(doc: jsPDF, order: SavedOrder, thumbs?: ThumbMap): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // ─── HEADER ───
  doc.setFillColor(COLORS.black);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(COLORS.gold);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(22);
  doc.text("FETÉLY", margin, 17);

  doc.setFontSize(7);
  doc.setTextColor("#cccccc");
  doc.text("B2B ORDERS", margin, 22);

  doc.setTextColor("#ffffff");
  doc.setFontSize(9);
  doc.text("PEDIDO", pageWidth - margin, 14, { align: "right" });
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(order.id, pageWidth - margin, 20, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#cccccc");
  doc.text(
    new Date(order.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
    pageWidth - margin,
    25,
    { align: "right" },
  );

  // ─── BLOCO CLIENTE ───
  let y = 38;
  doc.setTextColor(COLORS.black);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textSecondary);
  doc.text("CLIENTE", margin, y);

  y += 5;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.black);
  doc.text(order.meta.cliente || "—", margin, y);

  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textSecondary);
  const linha1: string[] = [];
  if (order.meta.cnpj) linha1.push(`CNPJ ${order.meta.cnpj}`);
  if (order.meta.nomeFantasia) linha1.push(order.meta.nomeFantasia);
  if (linha1.length) {
    doc.text(linha1.join("   ·   "), margin, y);
    y += 5;
  }

  const linha2: string[] = [];
  if (order.meta.telefone) linha2.push(`Tel ${order.meta.telefone}`);
  if (order.meta.email) linha2.push(order.meta.email);
  if (linha2.length) {
    doc.text(linha2.join("   ·   "), margin, y);
    y += 5;
  }

  const enderecoPartes = [
    [order.meta.logradouro, order.meta.numero].filter(Boolean).join(", "),
    order.meta.bairro,
    [order.meta.municipio, order.meta.uf].filter(Boolean).join(" — "),
    order.meta.cep,
  ].filter(Boolean);
  if (enderecoPartes.length) {
    doc.text(enderecoPartes.join("   ·   "), margin, y);
    y += 5;
  }

  // separador
  y += 2;
  doc.setDrawColor(COLORS.separator);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ─── TABELA DE ITENS (agrupada por seção → coleção) ───
  const secoes = agruparItensPorSecao(order.items);
  const hasThumbs = !!thumbs && thumbs.size > 0;
  const COLS = hasThumbs ? 6 : 5;
  type Row = (string | { content: string; colSpan?: number; styles?: Record<string, unknown> })[];
  const body: Row[] = [];
  const skuByRow = new Map<number, string>();
  for (const sec of secoes) {
    body.push([
      {
        content: `${sec.titulo}  ·  ${sec.qtd} un.  ·  ${formatBRL(sec.subtotal)}`,
        colSpan: COLS,
        styles: {
          fontStyle: "bold",
          fontSize: 9,
          textColor: "#ffffff",
          fillColor: sec.tipo === "firme" ? COLORS.black : COLORS.gold,
          cellPadding: 3,
        },
      },
    ]);
    for (const g of sec.grupos) {
      body.push([
        {
          content: `${g.colecao}  ·  ${g.qtd} un.  ·  ${formatBRL(g.subtotal)}`,
          colSpan: COLS,
          styles: {
            fontStyle: "bold",
            fontSize: 8.5,
            textColor: COLORS.black,
            fillColor: "#f4ecd9",
            cellPadding: 2.5,
          },
        },
      ]);
      for (const item of g.items) {
        const subtotal = item.product.precoAtacado * item.quantity;
        const row: Row = hasThumbs
          ? [
              "",
              item.sku,
              item.product.nomeComercial || item.product.nomeCompleto || "",
              `${item.quantity}`,
              formatBRL(item.product.precoAtacado),
              formatBRL(subtotal),
            ]
          : [
              item.sku,
              item.product.nomeComercial || item.product.nomeCompleto || "",
              `${item.quantity}`,
              formatBRL(item.product.precoAtacado),
              formatBRL(subtotal),
            ];
        skuByRow.set(body.length, item.sku);
        body.push(row);
      }
    }
  }

  const head: Row[] = hasThumbs
    ? [["Foto", "SKU", "Descrição", "Qtd", "Unit", "Subtotal"]]
    : [["SKU", "Descrição", "Qtd", "Unit", "Subtotal"]];

  const columnStyles: Record<number, Record<string, unknown>> = hasThumbs
    ? {
        0: { cellWidth: 18, minCellHeight: 18 },
        1: { cellWidth: 26 },
        3: { cellWidth: 12, halign: "right" },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 26, halign: "right" },
      }
    : {
        0: { cellWidth: 28 },
        2: { cellWidth: 12, halign: "right" },
        3: { cellWidth: 25, halign: "right" },
        4: { cellWidth: 28, halign: "right" },
      };

  autoTable(doc, {
    startY: y,
    head: head as unknown as (string | number)[][],
    body: body as unknown as (string | number)[][],
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: COLORS.black,
      lineColor: COLORS.separator,
      lineWidth: 0.1,
      valign: "middle",
    },
    headStyles: {
      fontStyle: "bold",
      fontSize: 8,
      textColor: COLORS.gold,
      fillColor: false as unknown as undefined,
      lineWidth: { bottom: 0.5 },
      lineColor: COLORS.black,
    },
    columnStyles,
    didDrawCell: (data) => {
      if (!hasThumbs) return;
      if (data.section !== "body" || data.column.index !== 0) return;
      const sku = skuByRow.get(data.row.index);
      if (!sku) return;
      const img = thumbs!.get(sku);
      if (!img) return;
      const pad = 1;
      const bw = data.cell.width - pad * 2;
      const bh = data.cell.height - pad * 2;
      const ratio = img.w / img.h;
      let dw = bw, dh = bw / ratio;
      if (dh > bh) { dh = bh; dw = bh * ratio; }
      const dx = data.cell.x + (data.cell.width - dw) / 2;
      const dy = data.cell.y + (data.cell.height - dh) / 2;
      try {
        doc.addImage(img.data, "JPEG", dx, dy, dw, dh, undefined, "FAST");
      } catch { /* ignore */ }
    },
  });


  let yAfterTable: number = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ─── RESUMO FINANCEIRO ───
  const c = order.commercial;
  const blocoX = pageWidth - margin - 70;

  if (c) {
    const items: Array<[string, string]> = [
      ["Subtotal bruto", formatBRL(c.bruto)],
    ];
    if (c.descontoCelebraValor > 0) {
      items.push([`Desconto ${c.faixaNome} (${c.descontoCelebraPct}%)`, `− ${formatBRL(c.descontoCelebraValor)}`]);
    }
    if (c.descontoMasterValor > 0) {
      items.push([`Desconto Master (${c.descontoMasterPct}%)`, `− ${formatBRL(c.descontoMasterValor)}`]);
    }
    if (c.aplicouPix && c.bonusPixValor > 0) {
      items.push([`Bônus PIX (${formatPercentBR(getBonusPixPercent(c))}%)`, `− ${formatBRL(c.bonusPixValor)}`]);
    }

    // Frete — sempre exibir (cobrado quando FOB, cortesia/incluso quando CIF)
    const fretePctStr = (c.fretePercent ?? FRETE_PERCENT).toFixed(1).replace(".", ",");
    if (c.freteIsento || c.frete === "CIF") {
      items.push([`Frete CIF (incluso · faixa ${c.faixaNome})`, "Grátis"]);
    } else {
      items.push([`Frete FOB (${fretePctStr}%)`, `+ ${formatBRL(c.freteValor ?? 0)}`]);
    }
    if ((c.acrescimoIsentoIEValor ?? 0) > 0.01) {
      items.push([
        `Acréscimo isento de IE (${c.acrescimoIsentoIEPercent ?? 15}%)`,
        `+ ${formatBRL(c.acrescimoIsentoIEValor ?? 0)}`,
      ]);
    }

    // Provisão futura (referência) — diferença entre total salvo e totalFinal comercial
    const provisaoRef = Math.max(0, (order.total ?? 0) - (c.totalFinal ?? 0));
    if (provisaoRef > 0.01) {
      items.push(["Subtotal pronta entrega", formatBRL(c.totalFinal)]);
      items.push(["Provisão futura (ref.)", `+ ${formatBRL(provisaoRef)}`]);
    }

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    for (const [label, valor] of items) {
      doc.setTextColor(COLORS.textSecondary);
      doc.text(label, blocoX, yAfterTable);
      doc.setTextColor(COLORS.black);
      doc.text(valor, pageWidth - margin, yAfterTable, { align: "right" });
      yAfterTable += 5;
    }

    yAfterTable += 2;
    doc.setDrawColor(COLORS.black);
    doc.setLineWidth(0.3);
    doc.line(blocoX, yAfterTable, pageWidth - margin, yAfterTable);

    yAfterTable += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.black);
    doc.text("TOTAL FINAL", blocoX, yAfterTable);
    doc.setFontSize(13);
    doc.setTextColor(COLORS.gold);
    doc.text(formatBRL(order.total), pageWidth - margin, yAfterTable, { align: "right" });
    yAfterTable += 10;
  } else {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.black);
    doc.text("TOTAL", blocoX, yAfterTable);
    doc.setFontSize(13);
    doc.setTextColor(COLORS.gold);
    doc.text(formatBRL(order.total), pageWidth - margin, yAfterTable, { align: "right" });
    yAfterTable += 10;
  }

  // ─── CONDIÇÕES COMERCIAIS ───
  doc.setDrawColor(COLORS.separator);
  doc.setLineWidth(0.2);
  doc.line(margin, yAfterTable, pageWidth - margin, yAfterTable);
  yAfterTable += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textSecondary);
  doc.text("CONDIÇÕES COMERCIAIS", margin, yAfterTable);
  yAfterTable += 5;

  const cond: Array<[string, string]> = [];
  if (c) {
    cond.push(["Faixa", c.faixaNome]);
    cond.push(["Frete", `${c.frete}${c.frete === "CIF" ? " — Fetély entrega" : " — Cliente retira"}`]);
    cond.push(["Pagamento", c.condicaoDescricao || order.meta.condicaoPagamento]);
  } else {
    cond.push(["Pagamento", order.meta.condicaoPagamento]);
  }
  cond.push(["Vendedor", order.vendedorNome || order.meta.vendedor]);

  doc.setFontSize(9);
  for (const [label, valor] of cond) {
    doc.setTextColor(COLORS.textSecondary);
    doc.text(label, margin, yAfterTable);
    doc.setTextColor(COLORS.black);
    doc.text(valor, margin + 30, yAfterTable);
    yAfterTable += 4.5;
  }

  // ─── OBSERVAÇÕES DO CLIENTE (visíveis para o cliente) ───
  const obsCliente = order.meta.observacoesCliente;
  if (obsCliente) {
    yAfterTable += 4;
    doc.setFontSize(8);
    doc.setTextColor(COLORS.textSecondary);
    doc.text("OBSERVAÇÕES", margin, yAfterTable);
    yAfterTable += 5;
    doc.setFontSize(9);
    doc.setTextColor(COLORS.black);
    const splitObs = doc.splitTextToSize(obsCliente, contentWidth);
    doc.text(splitObs, margin, yAfterTable);
    yAfterTable += splitObs.length * 4.5;
  }

  // ─── RODAPÉ ───
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(COLORS.textSecondary);
  doc.text(
    `Documento gerado em ${new Date().toLocaleString("pt-BR")}`,
    margin,
    pageHeight - 10,
  );
  doc.text("fetelycorp.com.br", pageWidth - margin, pageHeight - 10, { align: "right" });
}

export async function generateOrderPDF(order: SavedOrder): Promise<OrderPDFResult> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const thumbs = await loadItemThumbs(order.items);
  renderOrderToDoc(doc, order, thumbs);
  const blob = doc.output("blob");
  const dataUrl = doc.output("datauristring");
  const base64 = dataUrl.split(",")[1];
  const filename = `Pedido-${sanitizeFilename(order.id)}-${sanitizeFilename(order.meta.cliente || "cliente")}.pdf`;
  return { blob, base64, filename, dataUrl };
}

/**
 * Gera um único PDF com vários pedidos.
 * - mode "completa": cada pedido em página(s) próprias, no mesmo layout do PDF individual.
 * - mode "resumida": uma única tabela compacta listando pedido / data / cliente / itens / total.
 */
export async function generateOrdersBatchPDF(
  orders: SavedOrder[],
  mode: "completa" | "resumida",
): Promise<OrderPDFResult> {
  if (mode === "completa") {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const allThumbs = await Promise.all(orders.map((o) => loadItemThumbs(o.items)));
    orders.forEach((order, idx) => {
      if (idx > 0) doc.addPage();
      renderOrderToDoc(doc, order, allThumbs[idx]);
    });
    const blob = doc.output("blob");
    const dataUrl = doc.output("datauristring");
    const base64 = dataUrl.split(",")[1];
    return {
      blob,
      base64,
      dataUrl,
      filename: `Pedidos-${orders.length}-completo.pdf`,
    };
  }

  // ─── RESUMIDA ───
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header
  doc.setFillColor(COLORS.black);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(COLORS.gold);
  doc.setFontSize(22);
  doc.text("FETÉLY", margin, 17);
  doc.setFontSize(7);
  doc.setTextColor("#cccccc");
  doc.text("B2B ORDERS", margin, 22);
  doc.setTextColor("#ffffff");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("PEDIDOS — RESUMO", pageWidth - margin, 17, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#cccccc");
  doc.text(
    new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
    pageWidth - margin,
    23,
    { align: "right" },
  );

  const totalGeral = orders.reduce((s, o) => s + o.total, 0);
  const totalItens = orders.reduce(
    (s, o) => s + o.items.reduce((ss, i) => ss + i.quantity, 0),
    0,
  );

  const rows = orders.map((o) => {
    const qty = o.items.reduce((s, i) => s + i.quantity, 0);
    return [
      o.id,
      new Date(o.createdAt).toLocaleDateString("pt-BR"),
      o.meta.cliente || "—",
      o.meta.cnpj || "—",
      o.vendedorNome || o.meta.vendedor || "—",
      `${qty}`,
      formatBRL(o.total),
    ];
  });

  autoTable(doc, {
    startY: 36,
    head: [["Pedido", "Data", "Cliente", "CNPJ", "Vendedor", "Itens", "Total"]],
    body: rows,
    foot: [["", "", "", "", "TOTAL", `${totalItens}`, formatBRL(totalGeral)]],
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: COLORS.black,
      lineColor: COLORS.separator,
      lineWidth: 0.1,
    },
    headStyles: {
      fontStyle: "bold",
      fontSize: 8,
      textColor: COLORS.gold,
      fillColor: false as unknown as undefined,
      lineWidth: { bottom: 0.5 },
      lineColor: COLORS.black,
    },
    footStyles: {
      fontStyle: "bold",
      fontSize: 9,
      textColor: COLORS.black,
      fillColor: false as unknown as undefined,
      lineWidth: { top: 0.5 },
      lineColor: COLORS.black,
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 20 },
      5: { cellWidth: 14, halign: "right" },
      6: { cellWidth: 28, halign: "right" },
    },
  });

  // Rodapé
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(COLORS.textSecondary);
    doc.text(`Página ${i} de ${pageCount}`, margin, pageHeight - 10);
    doc.text("fetelycorp.com.br", pageWidth - margin, pageHeight - 10, { align: "right" });
  }

  const blob = doc.output("blob");
  const dataUrl = doc.output("datauristring");
  const base64 = dataUrl.split(",")[1];
  return {
    blob,
    base64,
    dataUrl,
    filename: `Pedidos-${orders.length}-resumido.pdf`,
  };
}

function escapeHtml(s: string | undefined | null): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderOrderBlockHTML(order: SavedOrder): string {
  const secoes = agruparItensPorSecao(order.items);
  const itensRows = secoes
    .map((sec) => {
      const secCls = sec.tipo === "firme" ? "sec-firme" : "sec-prov";
      const head = `<tr class="sec ${secCls}"><td colspan="5">${escapeHtml(sec.titulo)} · ${sec.qtd} un. · ${formatBRL(sec.subtotal)}</td></tr>`;
      const grupos = sec.grupos
        .map((g) => {
          const gh = `<tr class="grp"><td colspan="5">${escapeHtml(g.colecao)} · ${g.qtd} un. · ${formatBRL(g.subtotal)}</td></tr>`;
          const linhas = g.items
            .map((it) => {
              const subtotal = it.product.precoAtacado * it.quantity;
              return `
        <tr>
          <td class="mono">${escapeHtml(it.sku)}</td>
          <td>${escapeHtml(it.product.nomeComercial || it.product.nomeCompleto || "")}</td>
          <td class="r">${it.quantity}</td>
          <td class="r">${formatBRL(it.product.precoAtacado)}</td>
          <td class="r">${formatBRL(subtotal)}</td>
        </tr>`;
            })
            .join("");
          return gh + linhas;
        })
        .join("");
      return head + grupos;
    })
    .join("");


  const c = order.commercial;
  const linhasFin: string[] = [];
  if (c) {
    linhasFin.push(`<div><span>Subtotal bruto</span><b>${formatBRL(c.bruto)}</b></div>`);
    if (c.descontoCelebraValor > 0)
      linhasFin.push(`<div><span>Desconto ${escapeHtml(c.faixaNome)} (${c.descontoCelebraPct}%)</span><b>− ${formatBRL(c.descontoCelebraValor)}</b></div>`);
    if (c.descontoMasterValor > 0)
      linhasFin.push(`<div><span>Desconto Master (${c.descontoMasterPct}%)</span><b>− ${formatBRL(c.descontoMasterValor)}</b></div>`);
    if (c.aplicouPix && c.bonusPixValor > 0)
      linhasFin.push(`<div><span>Bônus PIX (${formatPercentBR(getBonusPixPercent(c))}%)</span><b>− ${formatBRL(c.bonusPixValor)}</b></div>`);

    const fretePctStr = (c.fretePercent ?? FRETE_PERCENT).toFixed(1).replace(".", ",");
    if (c.freteIsento || c.frete === "CIF") {
      linhasFin.push(`<div><span>Frete CIF (incluso · faixa ${escapeHtml(c.faixaNome)})</span><b>Grátis</b></div>`);
    } else {
      linhasFin.push(`<div><span>Frete FOB (${fretePctStr}%)</span><b>+ ${formatBRL(c.freteValor ?? 0)}</b></div>`);
    }
    if ((c.acrescimoIsentoIEValor ?? 0) > 0.01) {
      linhasFin.push(`<div><span>Acréscimo isento de IE (${c.acrescimoIsentoIEPercent ?? 15}%)</span><b>+ ${formatBRL(c.acrescimoIsentoIEValor ?? 0)}</b></div>`);
    }
    const provisaoRefHTML = Math.max(0, (order.total ?? 0) - (c.totalFinal ?? 0));
    if (provisaoRefHTML > 0.01) {
      linhasFin.push(`<div><span>Subtotal pronta entrega</span><b>${formatBRL(c.totalFinal)}</b></div>`);
      linhasFin.push(`<div><span>Provisão futura (ref.)</span><b>+ ${formatBRL(provisaoRefHTML)}</b></div>`);
    }
  }



  const cond: Array<[string, string]> = [];
  if (c) {
    cond.push(["Faixa", c.faixaNome]);
    cond.push(["Frete", `${c.frete}${c.frete === "CIF" ? " — Fetély entrega" : " — Cliente retira"}`]);
    cond.push(["Pagamento", c.condicaoDescricao || order.meta.condicaoPagamento]);
  } else {
    cond.push(["Pagamento", order.meta.condicaoPagamento]);
  }
  cond.push(["Vendedor", order.vendedorNome || order.meta.vendedor]);

  const endereco = [
    [order.meta.logradouro, order.meta.numero].filter(Boolean).join(", "),
    order.meta.bairro,
    [order.meta.municipio, order.meta.uf].filter(Boolean).join(" — "),
    order.meta.cep,
  ].filter(Boolean).join("  ·  ");

  return `
  <section class="order">
    <header class="ohead">
      <div>
        <div class="brand">FETÉLY</div>
        <div class="tag">B2B ORDERS</div>
      </div>
      <div class="r">
        <div class="lbl">PEDIDO</div>
        <div class="oid">${escapeHtml(order.id)}</div>
        <div class="dt">${new Date(order.createdAt).toLocaleString("pt-BR")}</div>
      </div>
    </header>

    <div class="cli">
      <div class="lbl">CLIENTE</div>
      <div class="nm">${escapeHtml(order.meta.cliente || "—")}</div>
      <div class="sub">${[order.meta.cnpj ? "CNPJ " + order.meta.cnpj : "", order.meta.nomeFantasia].filter(Boolean).map(escapeHtml).join("  ·  ")}</div>
      <div class="sub">${[order.meta.telefone ? "Tel " + order.meta.telefone : "", order.meta.email].filter(Boolean).map(escapeHtml).join("  ·  ")}</div>
      <div class="sub">${escapeHtml(endereco)}</div>
    </div>

    <table class="items">
      <thead>
        <tr><th>SKU</th><th>Descrição</th><th class="r">Qtd</th><th class="r">Unit</th><th class="r">Subtotal</th></tr>
      </thead>
      <tbody>${itensRows}</tbody>
    </table>

    <div class="totais">
      <div class="fin">${linhasFin.join("")}</div>
      <div class="grand"><span>TOTAL</span><b>${formatBRL(order.total)}</b></div>
    </div>

    <div class="cond">
      <div class="lbl">CONDIÇÕES COMERCIAIS</div>
      ${cond.map(([k, v]) => `<div><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join("")}
    </div>

    ${order.meta.observacoesCliente ? `<div class="obs"><div class="lbl">OBSERVAÇÕES</div><div>${escapeHtml(order.meta.observacoesCliente).replace(/\n/g, "<br/>")}</div></div>` : ""}
  </section>`;
}

function renderOrderResumoHTML(order: SavedOrder): string {
  const c = order.commercial;
  const fmt = (n: number) => formatBRL(n);

  const map = new Map<string, { skus: number; qtd: number; valor: number }>();
  for (const item of order.items) {
    const key = item.product.colecao || "—";
    const cur = map.get(key) ?? { skus: 0, qtd: 0, valor: 0 };
    cur.skus += 1;
    cur.qtd += item.quantity;
    cur.valor += item.product.precoAtacado * item.quantity;
    map.set(key, cur);
  }
  const grupos = Array.from(map.entries())
    .map(([colecao, d]) => ({ colecao, ...d }))
    .sort((a, b) => b.valor - a.valor);

  const totalUnidades = order.items.reduce((s, i) => s + i.quantity, 0);
  const totalSkus = order.items.length;

  const gruposRows = grupos
    .map(
      (g) => `<tr class="rg">
        <td>${escapeHtml(g.colecao)}</td>
        <td class="r">${g.skus}</td>
        <td class="r">${g.qtd}</td>
        <td class="r">${fmt(g.valor)}</td>
      </tr>`,
    )
    .join("");

  const linhasFin: string[] = [];
  if (c) {
    if (c.descontoCelebraValor > 0)
      linhasFin.push(`<div>Desconto ${escapeHtml(c.faixaNome)} (${c.descontoCelebraPct}%): − ${fmt(c.descontoCelebraValor)}</div>`);
    if (c.descontoMasterValor > 0)
      linhasFin.push(`<div>Desconto Master (${c.descontoMasterPct}%): − ${fmt(c.descontoMasterValor)}</div>`);
    if (c.aplicouPix && c.bonusPixValor > 0)
      linhasFin.push(`<div>Bônus PIX (${formatPercentBR(getBonusPixPercent(c))}%): − ${fmt(c.bonusPixValor)}</div>`);

    if (c.frete === "FOB") {
      const subAposDesc = c.bruto - c.descontoCelebraValor - c.descontoMasterValor;
      const fretePct = c.fretePercent ?? FRETE_PERCENT;
      const freteVal = c.freteValor ?? subAposDesc * (fretePct / 100);
      if (freteVal > 0) {
        linhasFin.push(
          `<div class="b">Frete FOB (${fretePct.toFixed(1).replace(".", ",")}%): + ${fmt(freteVal)}</div>`,
        );
      }
    }
  } else {
    linhasFin.push(`<div>Pagamento: ${escapeHtml(order.meta.condicaoPagamento)}</div>`);
  }

  const condRight = c
    ? `<div class="cbox"><div class="lbl">FRETE</div><div class="v">${escapeHtml(c.frete)}${c.frete === "CIF" ? " — Fetély entrega" : " — Cliente retira"}</div></div>
       <div class="cbox"><div class="lbl">FAIXA</div><div class="v">${escapeHtml(c.faixaNome)}</div></div>`
    : "";

  return `
  <section class="ordR">
    <header class="rhead">
      <div>
        <div class="brand">FETÉLY</div>
        <div class="tag">B2B ORDERS</div>
      </div>
      <div class="r">
        <div class="lbl">PEDIDO</div>
        <div class="oid">${escapeHtml(order.id)}</div>
        <div class="dt">${new Date(order.createdAt).toLocaleString("pt-BR")}</div>
      </div>
    </header>

    <div class="rcli">
      <div>
        <div class="lbl">CLIENTE</div>
        <div class="nm">${escapeHtml(order.meta.cliente || "—")}</div>
        <div class="sub">CNPJ ${escapeHtml(order.meta.cnpj || "—")}${order.meta.nomeFantasia ? "   ·   " + escapeHtml(order.meta.nomeFantasia) : ""}</div>
      </div>
      <div>
        <div class="lbl">VENDEDOR</div>
        <div class="nm">${escapeHtml(order.vendedorNome || order.meta.vendedor || "—")}</div>
      </div>
    </div>

    <div class="rcond">
      <div class="cbox"><div class="lbl">PAGAMENTO</div><div class="v">${escapeHtml(c?.condicaoDescricao || order.meta.condicaoPagamento)}</div></div>
      ${condRight}
    </div>

    <div class="lbl rttl">ITENS AGRUPADOS POR COLEÇÃO</div>
    <table class="rgrp">
      <thead>
        <tr><th>Coleção</th><th class="r">SKUs</th><th class="r">Unidades</th><th class="r">Subtotal</th></tr>
      </thead>
      <tbody>
        ${gruposRows}
        <tr class="rtot"><td>Total bruto</td><td class="r">${totalSkus}</td><td class="r">${totalUnidades}</td><td class="r">${fmt(c?.bruto || order.total)}</td></tr>
      </tbody>
    </table>

    <div class="rfin">
      <div class="rfinL">${linhasFin.join("")}</div>
      <div class="rfinR">
        <div class="lbl">TOTAL FINAL</div>
        <div class="rtotalv">${fmt(order.total)}</div>
      </div>
    </div>

    ${order.meta.observacoesCliente ? `<div class="robs"><b>Observações:</b> ${escapeHtml(order.meta.observacoesCliente).replace(/\n/g, "<br/>")}</div>` : ""}

    <div class="rfoot">
      <span>Documento gerado em ${new Date().toLocaleString("pt-BR")}</span>
      <span>fetelycorp.com.br</span>
    </div>
  </section>`;
}

function buildPrintHTML(orders: SavedOrder[], mode: "completa" | "resumida"): string {
  const style = `
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;font-size:11px}
    .wrap{padding:14mm}
    .mono{font-family:ui-monospace,Menlo,Consolas,monospace}
    .r{text-align:right}
    .lbl{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#6a6a6a}
    table{width:100%;border-collapse:collapse}
    th,td{padding:5px 6px;border-bottom:1px solid #e0e0e0;vertical-align:top}
    thead th{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#b8923a;border-bottom:1.5px solid #1a1a1a;text-align:left}
    /* resumida — layout agrupado por coleção, 1 pedido por página */
    .ordR{page-break-after:always;font-size:11px;line-height:1.4;color:#000}
    .ordR:last-child{page-break-after:auto}
    .rhead{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px}
    .rhead .brand{font-size:18pt;font-weight:700;letter-spacing:.05em}
    .rhead .tag{font-size:8pt;letter-spacing:.2em;color:#555}
    .rhead .oid{font-size:14pt;font-weight:600}
    .rhead .dt{font-size:8.5pt;color:#555}
    .rcli{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px}
    .rcli .nm{font-size:11pt;font-weight:600}
    .rcli .sub{font-size:8.5pt;color:#444}
    .rcond{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;border:1px solid #ccc;padding:8px 10px;margin-bottom:12px}
    .rcond .cbox .lbl{font-size:7.5pt;letter-spacing:.15em;color:#666}
    .rcond .cbox .v{font-size:9.5pt;font-weight:500}
    .rttl{font-size:8pt;letter-spacing:.15em;color:#666;margin-bottom:4px}
    .rgrp{width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:12px}
    .rgrp thead tr{border-bottom:1.5px solid #000}
    .rgrp th{text-align:left;padding:4px 6px;color:#000;letter-spacing:0;text-transform:none;border-bottom:0}
    .rgrp th.r{text-align:right}
    .rgrp td{padding:4px 6px;border-bottom:1px solid #eee}
    .rgrp tr.rtot td{border-top:1.5px solid #000;border-bottom:0;font-weight:600;padding:6px}
    .rfin{display:grid;grid-template-columns:1fr 1fr;gap:16px;border:1px solid #ccc;padding:10px 12px;margin-bottom:12px;align-items:center}
    .rfinL{font-size:9pt}
    .rfinL .b{font-weight:600}
    .rfinR{text-align:right}
    .rfinR .lbl{font-size:8pt;letter-spacing:.2em;color:#666}
    .rtotalv{font-size:20pt;font-weight:700}
    .robs{font-size:9pt;margin-bottom:12px;padding-top:8px;border-top:1px solid #eee}
    .rfoot{border-top:1px solid #ccc;padding-top:6px;margin-top:16px;display:flex;justify-content:space-between;font-size:7.5pt;color:#666}
    /* completa */
    .order{page-break-after:always}
    .order:last-child{page-break-after:auto}
    .ohead{background:#1a1a1a;color:#fff;padding:8mm 14mm;margin:-14mm -14mm 6mm -14mm;display:flex;justify-content:space-between;align-items:center}
    .ohead .brand{color:#b8923a;font-size:22px}
    .ohead .tag{color:#ccc;font-size:8px;letter-spacing:.3em}
    .ohead .oid{font-size:14px;font-weight:700}
    .ohead .dt{font-size:9px;color:#ccc;margin-top:2px}
    .ohead .lbl{color:#ccc}
    .cli{margin-bottom:6mm}
    .cli .nm{font-size:13px;font-weight:700;margin-top:2px}
    .cli .sub{color:#6a6a6a;margin-top:2px}
    .items{margin-top:2mm}
    .totais{display:flex;justify-content:flex-end;flex-direction:column;align-items:flex-end;margin-top:5mm;gap:1mm}
    .totais .fin{min-width:70mm}
    .totais .fin div{display:flex;justify-content:space-between;gap:8mm;padding:2px 0;color:#6a6a6a}
    .totais .fin b{color:#1a1a1a;font-weight:600}
    .grand{min-width:70mm;display:flex;justify-content:space-between;border-top:1px solid #1a1a1a;padding-top:3mm;margin-top:2mm;align-items:baseline}
    .grand span{font-size:10px;font-weight:700;letter-spacing:.1em}
    .grand b{color:#b8923a;font-size:14px}
    .cond{margin-top:6mm;border-top:1px solid #e0e0e0;padding-top:3mm}
    .cond div{display:flex;gap:4mm;padding:1px 0}
    .cond span{color:#6a6a6a;min-width:28mm}
    .obs{margin-top:5mm;border-top:1px solid #e0e0e0;padding-top:3mm}
    .items tr.sec td{font-weight:700;font-size:10px;letter-spacing:.1em;padding:6px 8px;color:#fff;border:0}
    .items tr.sec-firme td{background:#1a1a1a}
    .items tr.sec-prov td{background:#b8923a}
    .items tr.grp td{background:#f4ecd9;font-weight:600;font-size:9.5px;color:#1a1a1a;padding:4px 8px;border-bottom:1px solid #e0e0e0}
    @page{size:A4;margin:0}
    @media print{html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  `;

  // "completa" = layout do pedido individual com itens detalhados (1 por página).
  // "resumida" = layout do PED-2014 agrupado por coleção (1 por página).
  const body =
    mode === "completa"
      ? orders.map(renderOrderBlockHTML).join("")
      : orders.map(renderOrderResumoHTML).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Impressão de pedidos</title><style>${style}</style></head><body><div class="wrap">${body}</div></body></html>`;
}

/**
 * Imprime vários pedidos numa única chamada (resumida ou completa).
 * Renderiza HTML em iframe same-origin (via srcdoc) e dispara o diálogo
 * nativo de impressão — evita o bloqueio do Chrome ao imprimir blobs PDF.
 */
export function printOrdersBatch(
  orders: SavedOrder[],
  mode: "completa" | "resumida",
): void {
  const html = buildPrintHTML(orders, mode);

  const old = document.getElementById("__print_order_iframe");
  if (old) old.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__print_order_iframe";
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const triggerPrint = () => {
    try {
      const win = iframe.contentWindow;
      if (!win) throw new Error("iframe sem contentWindow");
      win.focus();
      win.print();
    } catch (err) {
      console.error("[printOrdersBatch] print direto falhou, abrindo nova aba:", err);
      const w = window.open("", "_blank");
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 300);
      }
    }
  };

  iframe.addEventListener("load", () => {
    setTimeout(triggerPrint, 200);
  });
  iframe.srcdoc = html;

  setTimeout(() => {
    document.getElementById("__print_order_iframe")?.remove();
  }, 60_000);
}

export async function openOrderPDFInNewTab(order: SavedOrder): Promise<void> {
  const { blob, filename } = await generateOrderPDF(order);
  const url = URL.createObjectURL(blob);
  const newWindow = window.open(url, "_blank");
  if (!newWindow) {
    // Pop-up bloqueado — fallback download
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Imprime o PDF do pedido direto na impressora física.
 * Gera o PDF em memória, cria iframe escondido, espera load e dispara print().
 * Sem abrir aba nova nem baixar arquivo.
 */
export async function printOrderPDF(order: SavedOrder): Promise<void> {
  const { blob } = await generateOrderPDF(order);
  const url = URL.createObjectURL(blob);

  // Remove iframe anterior se ainda existir (em caso de cliques múltiplos)
  const old = document.getElementById("__print_order_iframe");
  if (old) old.remove();

  // Cria iframe escondido (fora da tela mas no DOM)
  const iframe = document.createElement("iframe");
  iframe.id = "__print_order_iframe";
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  iframe.src = url;
  document.body.appendChild(iframe);

  iframe.addEventListener("load", () => {
    // Delay pequeno pro viewer de PDF do browser inicializar antes do print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("[printOrderPDF] print direto falhou, abrindo nova aba:", err);
        // Fallback: abre em nova aba pro usuário usar o Ctrl+P manual
        window.open(url, "_blank");
      }
    }, 300);
  });

  // Limpeza após 1 minuto (tempo suficiente pro usuário terminar o print)
  setTimeout(() => {
    document.getElementById("__print_order_iframe")?.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

/**
 * Gera PDF de uma cotação. Reaproveita o gerador de pedido, mas troca o
 * cabeçalho/rodapé para refletir o status de cotação (não compromisso).
 */
export async function generateCotacaoPDF(cotacao: Cotacao): Promise<OrderPDFResult> {
  // Monta um SavedOrder fake apenas para reusar a render
  const fakeOrder: SavedOrder = {
    id: cotacao.id,
    createdAt: cotacao.criadoEm,
    items: cotacao.items,
    meta: {
      ...cotacao.meta,
      observacoesCliente: `${cotacao.meta.observacoesCliente ?? cotacao.meta.observacoes ?? ""}\n\nVálida até: ${new Date(cotacao.validoAte).toLocaleDateString("pt-BR")}\nEste documento é uma cotação e não representa compromisso de compra.`.trim(),
    },
    total: cotacao.total,
    commercial: cotacao.commercial,
    vendedorId: cotacao.vendedorId,
    vendedorNome: cotacao.vendedorNome,
    vendedorLogin: cotacao.vendedorLogin,
  };
  const result = await generateOrderPDF(fakeOrder);
  // Renomeia o arquivo final
  const filename = `Cotacao-${cotacao.id}-${(cotacao.meta.cliente || "cliente").replace(/[^a-zA-Z0-9\-_]/g, "-").slice(0, 40)}.pdf`;
  return { ...result, filename };
}

/**
 * Gera PDF de uma provisão futura. Reaproveita o gerador de pedido para manter
 * o mesmo visual, mas marca claramente como rascunho de provisão (valores de
 * referência, sem compromisso fiscal).
 */
export async function generateProvisaoPDF(provisao: ProvisaoFutura): Promise<OrderPDFResult> {
  const items: CartItem[] = provisao.itens.map((i) => {
    const product = {
      sku: i.sku,
      nomeComercial: i.nomeComercial,
      nomeCompleto: i.nomeComercial,
      precoAtacado: i.precoAtacadoReferencia,
      multiplos: 1,
      statusEstoque: i.statusEstoque,
      colecao: i.colecao,
      corNome: i.corNome,
      tamanhoNumero: i.tamanhoNumero,
    } as unknown as Product;
    return { sku: i.sku, product, quantity: i.quantidade };
  });

  const snap = provisao.clienteSnapshot;
  const obsHeader = `PROVISÃO FUTURA — valores de referência, sem compromisso fiscal.\nPróxima previsão: ${provisao.proximaPrevisao}${provisao.datasPrevisao?.length ? ` · Datas: ${provisao.datasPrevisao.join(", ")}` : ""}`;

  const fakeOrder: SavedOrder = {
    id: provisao.id,
    createdAt: provisao.criadoEm,
    items,
    meta: {
      cliente: snap.razaoSocial || snap.nomeFantasia || "—",
      nomeFantasia: snap.nomeFantasia,
      cnpj: snap.cnpj,
      email: snap.contatoEmail,
      telefone: snap.contatoTelefone,
      municipio: snap.cidade,
      uf: snap.estado,
      condicaoPagamento: "—",
      vendedor: provisao.vendedorNome,
      observacoes: "",
      observacoesCliente: `${obsHeader}${provisao.observacoes ? `\n\n${provisao.observacoes}` : ""}`.trim(),
    },
    total: provisao.totalReferencia,
    vendedorId: provisao.vendedorId,
    vendedorNome: provisao.vendedorNome,
  };

  const result = await generateOrderPDF(fakeOrder);
  const filename = `Provisao-${provisao.id}-${(snap.razaoSocial || snap.nomeFantasia || "cliente").replace(/[^a-zA-Z0-9\-_]/g, "-").slice(0, 40)}.pdf`;
  return { ...result, filename };
}
