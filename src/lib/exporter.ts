// Exportação completa de pedidos — PDF, CSV, JSON, ZIP (lote)
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import FileSaver from "file-saver";
const { saveAs } = FileSaver;
import type { SavedOrder, CartItem } from "@/types";
import { FAIXAS, FRETE_PERCENT } from "@/lib/commercial";
import { usePhotos, getProdutoPhoto } from "@/store/photoStore";

// ===== Helpers de imagem (foto do item no PDF) =====
interface LoadedImage { data: string; w: number; h: number }
type ThumbMap = Map<string, LoadedImage>;

async function urlToDataUrlExp(url: string, maxSize = 200): Promise<LoadedImage | null> {
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
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return { data: canvas.toDataURL("image/jpeg", 0.8), w, h };
  } catch { return null; }
}

async function loadThumbsForItens(itens: { sku: string; colecao: string; corNome: string; grupo: string; numeroVela?: number }[]): Promise<ThumbMap> {
  const photos = usePhotos.getState();
  const seen = new Map<string, string>();
  for (const it of itens) {
    if (!it.colecao) continue;
    const primary = it.grupo === "Talheres" || it.numeroVela != null ? it.corNome : it.sku;
    const url =
      (primary && getProdutoPhoto(photos, it.colecao, primary)) ||
      (it.corNome && getProdutoPhoto(photos, it.colecao, it.corNome)) ||
      undefined;
    if (url) seen.set(it.sku, url);
  }
  const map: ThumbMap = new Map();
  await Promise.all(Array.from(seen.entries()).map(async ([sku, url]) => {
    const img = await urlToDataUrlExp(url);
    if (img) map.set(sku, img);
  }));
  return map;
}

// ===== Tipos =====
export interface ItemExportavel {
  sku: string;
  codCadastro: string;
  ean: string;
  marca: string;
  linha: string;
  categoria: string;
  grupo: string;
  tipo: string;
  colecao: string;
  familia: string;
  nomeComercial: string;
  corNome: string;
  tamanhoNumero: string;
  tamanhoRef: string;
  isVelaNumerica: boolean;
  numeroVela?: number;
  multiplos: number;
  qtdKit: number;
  tipoEmbalagem: string;
  quantidade: number;
  quantidadeCaixas: number;
  precoVarejoUnit: number;
  precoAtacadoUnit: number;
  subtotalBruto: number;
  descontoPercent: number;
  descontoValor: number;
  subtotalLiquido: number;
  ncm: string;
  material: string;
  origemFisc: string;
  pesoG: number;
  larguraCm: number;
  alturaCm: number;
  profundidadeCm: number;
}

export interface PedidoExportavel {
  id: string;
  numeroPedido: string;
  dataHora: string;
  dataISO: string;
  vendedorId: string;
  vendedorNome: string;
  vendedorLogin: string;
  vendedorTipo: "interno" | "representante" | "";
  vendedorRegiao: string;
  vendedorComissaoPercent?: number;
  clienteId: string;
  clienteCnpj: string;
  clienteRazaoSocial: string;
  clienteNomeFantasia: string;
  clienteInscricaoEstadual?: string;
  clienteEmail: string;
  clienteTelefone: string;
  clienteContatoNome: string;
  clienteEnderecoFaturamento: string;
  clienteCidadeEstado: string;
  clienteCep: string;
  clienteEnderecoEntrega: string;
  clienteEnderecoEntregaIgual: boolean;
  faixaId: number;
  faixaNome: string;
  frete: "CIF" | "FOB" | "";
  freteValor: number;
  fretePercent: number;
  freteIsento: boolean;
  descontoCelebraPercent: number;
  descontoNegociacaoPercent: number;
  descontoNegociacaoJustificativa?: string;
  bonusPixPercent: number;
  condicaoPagamentoId: number | null;
  condicaoPagamentoDescricao: string;
  modoNegociacaoUsado: boolean;
  itens: ItemExportavel[];
  totalBrutoAtacado: number;
  totalDescontoCelebra: number;
  totalDescontoNegociacao: number;
  totalDescontoBonusPix: number;
  totalDescontoGeral: number;
  totalDescontoPercentual: number;
  totalLiquido: number;
  totalUnidades: number;
  totalSkus: number;
  comissaoEstimadaValor?: number;
  observacoesVendedor?: string;
  observacoesInternas?: string;
  // V13 — Premissas comerciais homologadas aplicadas
  premissasAplicadas: boolean;
  premissasResumo: string[];
  premissasVigenciaFim: string;
}

export interface ExportOptions {
  incluirVendedor: boolean;
  incluirEnderecoEntrega: boolean;
  incluirEspecsTecnicas: boolean;
  incluirObservacoesInternas: boolean;
  incluirDetalhamentoDescontos: boolean;
}

export const DEFAULT_OPTIONS: ExportOptions = {
  incluirVendedor: true,
  incluirEnderecoEntrega: true,
  incluirEspecsTecnicas: true,
  incluirObservacoesInternas: false,
  incluirDetalhamentoDescontos: true,
};

// ===== Builder =====
export function buildPedidoExportavel(order: SavedOrder): PedidoExportavel {
  const c = order.commercial;
  const snap = order.meta.clienteSnapshot;
  const created = new Date(order.createdAt);
  const dataHora = `${created.toLocaleDateString("pt-BR")} às ${created.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  const dataISO = created.toISOString();

  const totalBruto = c?.bruto ?? order.items.reduce((s, i) => s + i.product.precoAtacado * i.quantity, 0);
  const totalLiquido = c?.totalFinal ?? totalBruto;
  const totalDescontoGeral = totalBruto - totalLiquido;
  const totalDescontoPercentual = totalBruto > 0 ? (totalDescontoGeral / totalBruto) * 100 : 0;

  const itens: ItemExportavel[] = order.items.map((i: CartItem) => {
    const p = i.product;
    const subtotalBruto = p.precoAtacado * i.quantity;
    const descontoValor = subtotalBruto * (totalDescontoPercentual / 100);
    return {
      sku: p.sku,
      codCadastro: p.codCadastro ?? "",
      ean: p.ean ?? "",
      marca: p.marca ?? "",
      linha: p.linha ?? "",
      categoria: p.categoria ?? "",
      grupo: p.grupo ?? "",
      tipo: p.tipo ?? "",
      colecao: p.colecao ?? "",
      familia: p.familia ?? "",
      nomeComercial: p.nomeComercial ?? "",
      corNome: p.corNome ?? "",
      tamanhoNumero: p.tamanhoNumero ?? "",
      tamanhoRef: p.tamanhoRef ?? "",
      isVelaNumerica: !!p.isVelaNumerica,
      numeroVela: p.numeroVela ?? undefined,
      multiplos: p.multiplos ?? 1,
      qtdKit: p.qtdKit ?? 1,
      tipoEmbalagem: p.tipoEmbalagem ?? "",
      quantidade: i.quantity,
      quantidadeCaixas: p.multiplos > 0 ? Math.ceil(i.quantity / p.multiplos) : i.quantity,
      precoVarejoUnit: p.precoVarejo ?? 0,
      precoAtacadoUnit: p.precoAtacado ?? 0,
      subtotalBruto,
      descontoPercent: totalDescontoPercentual,
      descontoValor,
      subtotalLiquido: subtotalBruto - descontoValor,
      ncm: p.ncm ?? "",
      material: p.material ?? "",
      origemFisc: p.origemFisc ?? "",
      pesoG: p.pesoG ?? 0,
      larguraCm: p.larguraCm ?? 0,
      alturaCm: p.alturaCm ?? 0,
      profundidadeCm: p.profundidadeCm ?? 0,
    };
  });

  const faixa = c ? FAIXAS.find((f) => f.id === c.faixaId) : null;

  return {
    id: order.id,
    numeroPedido: `#${order.id}`,
    dataHora,
    dataISO,
    vendedorId: order.vendedorId ?? "",
    vendedorNome: order.vendedorNome ?? order.meta.vendedor ?? "",
    vendedorLogin: order.vendedorLogin ?? "",
    vendedorTipo: order.vendedorTipo ?? "",
    vendedorRegiao: "",
    clienteId: order.meta.clienteId ?? "",
    clienteCnpj: snap?.cnpj ?? order.meta.cnpj ?? "",
    clienteRazaoSocial: snap?.razaoSocial ?? order.meta.cliente ?? "",
    clienteNomeFantasia: snap?.nomeFantasia ?? order.meta.nomeFantasia ?? "",
    clienteInscricaoEstadual: "",
    clienteEmail: snap?.contatoEmail ?? order.meta.email ?? "",
    clienteTelefone: snap?.contatoTelefone ?? order.meta.telefone ?? "",
    clienteContatoNome: snap?.contatoNome ?? "",
    clienteEnderecoFaturamento: [order.meta.logradouro, order.meta.numero, order.meta.bairro].filter(Boolean).join(", "),
    clienteCidadeEstado: snap ? `${snap.cidade}/${snap.estado}` : `${order.meta.municipio ?? ""}/${order.meta.uf ?? ""}`,
    clienteCep: order.meta.cep ?? "",
    clienteEnderecoEntrega: snap?.enderecoEntrega ?? "",
    clienteEnderecoEntregaIgual: true,
    faixaId: c?.faixaId ?? 0,
    faixaNome: c?.faixaNome ?? "—",
    frete: c?.frete ?? "",
    freteValor: c?.freteValor ?? 0,
    fretePercent: c?.fretePercent ?? FRETE_PERCENT,
    freteIsento: c?.freteIsento ?? (c?.frete === "CIF"),
    descontoCelebraPercent: c?.descontoCelebraPct ?? 0,
    descontoNegociacaoPercent: c?.descontoMasterPct ?? 0,
    descontoNegociacaoJustificativa: c?.justificativa,
    bonusPixPercent: c?.aplicouPix ? (faixa?.bonusPix ?? 0) : 0,
    condicaoPagamentoId: c?.condicaoId ?? null,
    condicaoPagamentoDescricao: c?.condicaoDescricao ?? order.meta.condicaoPagamento ?? "",
    modoNegociacaoUsado: !!c?.negociacao,
    itens,
    totalBrutoAtacado: totalBruto,
    totalDescontoCelebra: c?.descontoCelebraValor ?? 0,
    totalDescontoNegociacao: c?.descontoMasterValor ?? 0,
    totalDescontoBonusPix: c?.bonusPixValor ?? 0,
    totalDescontoGeral,
    totalDescontoPercentual,
    totalLiquido,
    totalUnidades: order.items.reduce((s, i) => s + i.quantity, 0),
    totalSkus: order.items.length,
    observacoesVendedor: order.meta.observacoes,
    observacoesInternas: c?.observacaoInterna,
    ...buildPremissasResumo(snap?.premissasAplicadas ?? null, c),
  };
}

function buildPremissasResumo(
  p: import("@/types/cliente").PremissasComerciais | null,
  c: import("@/types").OrderCommercial | undefined,
): { premissasAplicadas: boolean; premissasResumo: string[]; premissasVigenciaFim: string } {
  const aplicou = !!p && (c?.premissasAplicadas ?? true);
  if (!p || !aplicou) {
    return { premissasAplicadas: false, premissasResumo: [], premissasVigenciaFim: "" };
  }
  const linhas: string[] = [];
  if (p.temDescontoHomologado) {
    linhas.push(
      `Desconto homologado: ${p.descontoHomologadoPercent}% ${p.descontoHomologadoSobrePos ? "(acumula sobre faixa)" : "(substitui faixa)"}`,
    );
  }
  if (p.temFaixaFixa && p.faixaFixaId != null) {
    const faixa = FAIXAS.find((f) => f.id === p.faixaFixaId);
    if (faixa) linhas.push(`Faixa fixa: ${faixa.nome}`);
  }
  if (p.bonusPixPersonalizado) linhas.push(`Bônus PIX personalizado: ${p.bonusPixPercent}%`);
  if (p.freteFixo && p.freteTipo) linhas.push(`Frete fixo: ${p.freteTipo}`);
  if (p.temPedidoMinimoPersonalizado) {
    linhas.push(`Pedido mínimo personalizado: ${fmtBRL(p.pedidoMinimoValor)}`);
  }
  if (p.temCondicaoPreferencial && p.condicaoPreferencialId != null) {
    linhas.push(`Condição preferencial: cond. #${p.condicaoPreferencialId}`);
  }
  if (linhas.length === 0) linhas.push("Premissas vigentes aplicadas.");
  return {
    premissasAplicadas: true,
    premissasResumo: linhas,
    premissasVigenciaFim: p.vigenciaFim
      ? new Date(p.vigenciaFim).toLocaleDateString("pt-BR")
      : "sem expiração",
  };
}

// ===== Helpers =====
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const safeFile = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_");

// ===== PDF =====
export async function exportarPDF(
  pedido: PedidoExportavel,
  tipo: "cliente" | "interno",
  opts: ExportOptions = DEFAULT_OPTIONS,
): Promise<void> {
  const thumbs = await loadThumbsForItens(pedido.itens);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const GOLD: [number, number, number] = [201, 168, 76];

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("FETÉLY", 105, 20, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text("B2B Orders", 105, 26, { align: "center" });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(15, 30, 195, 30);

  doc.setTextColor(0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`PEDIDO ${pedido.numeroPedido}`, 15, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(pedido.dataHora, 195, 38, { align: "right" });

  // Cliente / Vendedor
  const clienteBlock = [
    pedido.clienteRazaoSocial || "—",
    pedido.clienteCnpj ? `CNPJ: ${pedido.clienteCnpj}` : "",
    pedido.clienteContatoNome ? `Contato: ${pedido.clienteContatoNome}` : "",
    pedido.clienteTelefone,
    pedido.clienteEmail,
  ].filter(Boolean).join("\n");

  const vendedorBlock = opts.incluirVendedor
    ? [
        pedido.vendedorNome || "—",
        pedido.vendedorTipo
          ? `${pedido.vendedorTipo === "representante" ? "Representante" : "Interno"}${pedido.vendedorRegiao ? " · " + pedido.vendedorRegiao : ""}`
          : "",
        pedido.vendedorLogin,
      ].filter(Boolean).join("\n")
    : "—";

  autoTable(doc, {
    startY: 42,
    head: [["CLIENTE", "VENDEDOR"]],
    body: [[clienteBlock, vendedorBlock]],
    headStyles: { fillColor: GOLD, textColor: [0, 0, 0], fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3, valign: "top" },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 90 } },
    margin: { left: 15, right: 15 },
  });

  // Endereço de entrega
  if (opts.incluirEnderecoEntrega && pedido.clienteEnderecoEntrega) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 2,
      head: [["ENTREGA"]],
      body: [[pedido.clienteEnderecoEntrega]],
      headStyles: { fillColor: GOLD, textColor: [0, 0, 0], fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: 15, right: 15 },
    });
  }

  // Itens
  const showVarejo = tipo === "interno";
  const hasThumbs = thumbs.size > 0;
  const head = hasThumbs
    ? (showVarejo
        ? [["#", "Foto", "PRODUTO", "Qtd", "Cx", "Varejo", "Atacado", "Subtotal"]]
        : [["#", "Foto", "PRODUTO", "Qtd", "Cx", "Unit.", "Subtotal"]])
    : (showVarejo
        ? [["#", "PRODUTO", "Qtd", "Cx", "Varejo", "Atacado", "Subtotal"]]
        : [["#", "PRODUTO", "Qtd", "Cx", "Unit.", "Subtotal"]]);

  const skuByRowIdx = new Map<number, string>();
  const rows = pedido.itens.map((item, i) => {
    const desc = [
      item.nomeComercial,
      [item.corNome, item.tamanhoNumero].filter(Boolean).join(" · "),
      `SKU: ${item.sku}${opts.incluirEspecsTecnicas && item.ean ? `  EAN: ${item.ean}` : ""}`,
    ].filter(Boolean).join("\n");
    skuByRowIdx.set(i, item.sku);
    const base: string[] = [String(i + 1)];
    if (hasThumbs) base.push("");
    base.push(desc, String(item.quantidade), String(item.quantidadeCaixas));
    if (showVarejo) base.push(fmtBRL(item.precoVarejoUnit));
    base.push(fmtBRL(item.precoAtacadoUnit), fmtBRL(item.subtotalBruto));
    return base;
  });

  const colStylesNoThumb = showVarejo
    ? { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 78 }, 2: { cellWidth: 12, halign: "center" }, 3: { cellWidth: 12, halign: "center" }, 4: { cellWidth: 22, halign: "right" }, 5: { cellWidth: 22, halign: "right" }, 6: { cellWidth: 26, halign: "right" } }
    : { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 100 }, 2: { cellWidth: 14, halign: "center" }, 3: { cellWidth: 14, halign: "center" }, 4: { cellWidth: 22, halign: "right" }, 5: { cellWidth: 22, halign: "right" } };
  const colStylesWithThumb = showVarejo
    ? { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 18, minCellHeight: 18 }, 2: { cellWidth: 60 }, 3: { cellWidth: 12, halign: "center" }, 4: { cellWidth: 12, halign: "center" }, 5: { cellWidth: 20, halign: "right" }, 6: { cellWidth: 20, halign: "right" }, 7: { cellWidth: 24, halign: "right" } }
    : { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 18, minCellHeight: 18 }, 2: { cellWidth: 82 }, 3: { cellWidth: 14, halign: "center" }, 4: { cellWidth: 14, halign: "center" }, 5: { cellWidth: 22, halign: "right" }, 6: { cellWidth: 22, halign: "right" } };

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4,
    head,
    body: rows,
    headStyles: { fillColor: GOLD, textColor: [0, 0, 0], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    styles: { fontSize: 8, cellPadding: 2.5, valign: "middle" },
    columnStyles: hasThumbs ? colStylesWithThumb : colStylesNoThumb,
    margin: { left: 15, right: 15 },
    didDrawCell: (data) => {
      if (!hasThumbs || data.section !== "body" || data.column.index !== 1) return;
      const sku = skuByRowIdx.get(data.row.index);
      if (!sku) return;
      const img = thumbs.get(sku);
      if (!img) return;
      const bw = data.cell.width - 2;
      const bh = data.cell.height - 2;
      const ratio = img.w / img.h;
      let dw = bw, dh = bw / ratio;
      if (dh > bh) { dh = bh; dw = bh * ratio; }
      const dx = data.cell.x + (data.cell.width - dw) / 2;
      const dy = data.cell.y + (data.cell.height - dh) / 2;
      try { doc.addImage(img.data, "JPEG", dx, dy, dw, dh, undefined, "FAST"); } catch { /* ignore */ }
    },
  });

  // Totais
  const totaisBody: string[][] = [];
  totaisBody.push(["Subtotal bruto (atacado)", fmtBRL(pedido.totalBrutoAtacado)]);
  if (opts.incluirDetalhamentoDescontos) {
    if (pedido.totalDescontoCelebra > 0) {
      totaisBody.push([
        `Desconto ${pedido.faixaNome} (${pedido.descontoCelebraPercent}%)`,
        `– ${fmtBRL(pedido.totalDescontoCelebra)}`,
      ]);
    }
    if (pedido.totalDescontoNegociacao > 0) {
      totaisBody.push([
        `Desconto negociação (${pedido.descontoNegociacaoPercent}%)`,
        `– ${fmtBRL(pedido.totalDescontoNegociacao)}`,
      ]);
    }
    if (pedido.totalDescontoBonusPix > 0) {
      totaisBody.push([`Bônus PIX (${pedido.bonusPixPercent}%)`, `– ${fmtBRL(pedido.totalDescontoBonusPix)}`]);
    }
  }
  // Frete — sempre exibir (cobrado quando FOB, incluso quando CIF)
  if (pedido.freteIsento || pedido.frete === "CIF") {
    totaisBody.push([`Frete CIF (incluso · faixa ${pedido.faixaNome})`, "Grátis"]);
  } else if (pedido.frete === "FOB") {
    totaisBody.push([`Frete FOB`, `+ ${fmtBRL(pedido.freteValor)}`]);
  }
  totaisBody.push(["TOTAL DO PEDIDO", fmtBRL(pedido.totalLiquido)]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4,
    body: totaisBody,
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 130, halign: "right", fontStyle: "normal" },
      1: { cellWidth: 50, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.row.index === totaisBody.length - 1) {
        data.cell.styles.fillColor = GOLD;
        data.cell.styles.textColor = [0, 0, 0];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 12;
      }
    },
    margin: { left: 15, right: 15 },
  });

  // Resumo numérico
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(
    `Unidades: ${pedido.totalUnidades}   ·   SKUs: ${pedido.totalSkus}`,
    105,
    (doc as any).lastAutoTable.finalY + 6,
    { align: "center" },
  );

  // Condições comerciais
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [["CONDIÇÕES COMERCIAIS"]],
    body: [
      [
        `Faixa: ${pedido.faixaNome}  ·  Frete: ${pedido.frete || "—"}  ·  Pgto: ${pedido.condicaoPagamentoDescricao || "—"}`,
      ],
    ],
    headStyles: { fillColor: GOLD, textColor: [0, 0, 0], fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 15, right: 15 },
  });

  // V13 — Condições comerciais homologadas (premissas)
  if (pedido.premissasAplicadas) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 2,
      head: [["✦ CONDIÇÕES COMERCIAIS APLICADAS (HOMOLOGADAS)"]],
      body: [
        [
          [
            ...pedido.premissasResumo.map((l) => `• ${l}`),
            `Vigência até: ${pedido.premissasVigenciaFim}`,
          ].join("\n"),
        ],
      ],
      headStyles: { fillColor: GOLD, textColor: [0, 0, 0], fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: 15, right: 15 },
    });
  }

  if (pedido.observacoesVendedor) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 2,
      head: [["OBSERVAÇÕES"]],
      body: [[pedido.observacoesVendedor]],
      headStyles: { fillColor: GOLD, textColor: [0, 0, 0], fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: 15, right: 15 },
    });
  }

  // Bloco interno
  if (tipo === "interno") {
    const internoLines: string[] = [];
    internoLines.push(
      `Desconto total aplicado: ${pedido.totalDescontoPercentual.toFixed(2)}% (${fmtBRL(pedido.totalDescontoGeral)})`,
    );
    if (pedido.modoNegociacaoUsado) {
      internoLines.push(`Negociação master: ${pedido.descontoNegociacaoPercent}% — ${pedido.descontoNegociacaoJustificativa ?? "—"}`);
    }
    if (pedido.vendedorTipo === "representante" && pedido.comissaoEstimadaValor != null) {
      internoLines.push(
        `Comissão estimada: ${fmtBRL(pedido.comissaoEstimadaValor)} (${pedido.vendedorComissaoPercent ?? 0}%)`,
      );
    }
    if (opts.incluirObservacoesInternas && pedido.observacoesInternas) {
      internoLines.push(`Obs. internas: ${pedido.observacoesInternas}`);
    }
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 4,
      head: [["USO INTERNO — NÃO ENVIAR AO CLIENTE"]],
      body: [[internoLines.join("\n")]],
      headStyles: { fillColor: [80, 30, 30], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3, textColor: [80, 30, 30] },
      margin: { left: 15, right: 15 },
    });
  }

  // Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Fetély B2B Orders · Pedido ${pedido.numeroPedido} · Página ${i} de ${pageCount}`,
      105,
      290,
      { align: "center" },
    );
  }

  const fname = `fetely_pedido_${safeFile(pedido.id)}_${pedido.dataISO.slice(0, 10)}.pdf`;
  doc.save(fname);
}

// ===== CSV =====
const CSV_HEADERS = [
  "pedido_id","pedido_numero","data","hora",
  "vendedor_nome","vendedor_login","vendedor_tipo","vendedor_regiao",
  "cliente_razao_social","cliente_nome_fantasia","cliente_cnpj","cliente_ie",
  "cliente_contato","cliente_email","cliente_telefone",
  "cliente_endereco_faturamento","cliente_cidade","cliente_estado","cliente_cep",
  "cliente_endereco_entrega",
  "faixa_nome","frete","condicao_pagamento",
  "desconto_celebra_percent","desconto_negociacao_percent","bonus_pix_percent","desconto_total_percent",
  "sku","cod_cadastro","ean",
  "marca","linha","categoria","grupo","tipo","colecao","familia",
  "nome_comercial","cor_nome","tamanho_numero","tamanho_ref",
  "is_vela_numerica","numero_vela",
  "multiplos","qtd_kit","tipo_embalagem",
  "quantidade_unidades","quantidade_caixas",
  "preco_varejo_unit","preco_atacado_unit",
  "subtotal_bruto","desconto_valor","subtotal_liquido",
  "ncm","material","origem_fisc",
  "peso_g","largura_cm","altura_cm","profundidade_cm",
  "total_pedido_bruto","total_pedido_liquido","total_unidades","total_skus",
  "modo_negociacao_usado","negociacao_justificativa",
  "comissao_percent","comissao_estimada_valor",
  "observacoes_vendedor",
  "premissas_aplicadas","premissas_resumo","premissas_vigencia_fim",
];

const csvEscape = (val: unknown): string => {
  const str = val == null ? "" : String(val);
  return /[,"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

function rowsForPedido(pedido: PedidoExportavel): string[][] {
  const [data, hora] = pedido.dataHora.split(" às ");
  const cidade = pedido.clienteCidadeEstado.split("/")[0] ?? "";
  const estado = pedido.clienteCidadeEstado.split("/")[1] ?? "";
  return pedido.itens.map((item) => [
    pedido.id, pedido.numeroPedido, data ?? "", hora ?? "",
    pedido.vendedorNome, pedido.vendedorLogin, pedido.vendedorTipo, pedido.vendedorRegiao,
    pedido.clienteRazaoSocial, pedido.clienteNomeFantasia, pedido.clienteCnpj, pedido.clienteInscricaoEstadual ?? "",
    pedido.clienteContatoNome, pedido.clienteEmail, pedido.clienteTelefone,
    pedido.clienteEnderecoFaturamento, cidade, estado, pedido.clienteCep,
    pedido.clienteEnderecoEntrega,
    pedido.faixaNome, pedido.frete, pedido.condicaoPagamentoDescricao,
    String(pedido.descontoCelebraPercent), String(pedido.descontoNegociacaoPercent),
    String(pedido.bonusPixPercent), pedido.totalDescontoPercentual.toFixed(2),
    item.sku, item.codCadastro, item.ean,
    item.marca, item.linha, item.categoria, item.grupo, item.tipo, item.colecao, item.familia,
    item.nomeComercial, item.corNome, item.tamanhoNumero, item.tamanhoRef,
    String(item.isVelaNumerica), item.numeroVela != null ? String(item.numeroVela) : "",
    String(item.multiplos), String(item.qtdKit), item.tipoEmbalagem,
    String(item.quantidade), String(item.quantidadeCaixas),
    item.precoVarejoUnit.toFixed(4), item.precoAtacadoUnit.toFixed(4),
    item.subtotalBruto.toFixed(2), item.descontoValor.toFixed(2), item.subtotalLiquido.toFixed(2),
    item.ncm, item.material, item.origemFisc,
    String(item.pesoG), String(item.larguraCm), String(item.alturaCm), String(item.profundidadeCm),
    pedido.totalBrutoAtacado.toFixed(2), pedido.totalLiquido.toFixed(2),
    String(pedido.totalUnidades), String(pedido.totalSkus),
    String(pedido.modoNegociacaoUsado), pedido.descontoNegociacaoJustificativa ?? "",
    pedido.vendedorComissaoPercent != null ? String(pedido.vendedorComissaoPercent) : "",
    pedido.comissaoEstimadaValor != null ? pedido.comissaoEstimadaValor.toFixed(2) : "",
    pedido.observacoesVendedor ?? "",
    String(pedido.premissasAplicadas),
    pedido.premissasResumo.join(" | "),
    pedido.premissasVigenciaFim,
  ]);
}

export function exportarCSV(pedidos: PedidoExportavel[], header?: string): void {
  const allRows: string[][] = [];
  pedidos.forEach((p) => allRows.push(...rowsForPedido(p)));
  const bom = "\uFEFF";
  const prefixo = header ? header.split("\n").map((l) => `# ${l}`).join("\n") + "\n" : "";
  const csv =
    bom +
    prefixo +
    [CSV_HEADERS, ...allRows].map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const fname =
    pedidos.length === 1
      ? `fetely_pedido_${safeFile(pedidos[0].id)}_${pedidos[0].dataISO.slice(0, 10)}.csv`
      : `fetely_pedidos_lote_${new Date().toISOString().slice(0, 10)}.csv`;
  saveAs(blob, fname);
}

// ===== JSON =====
export function exportarJSON(pedidos: PedidoExportavel[]): void {
  const payload =
    pedidos.length === 1
      ? {
          fetely_export_version: "1.0",
          exportado_em: new Date().toISOString(),
          pedido: pedidos[0],
        }
      : {
          fetely_export_version: "1.0",
          exportado_em: new Date().toISOString(),
          pedidos,
        };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8;" });
  const fname =
    pedidos.length === 1
      ? `fetely_pedido_${safeFile(pedidos[0].id)}_${pedidos[0].dataISO.slice(0, 10)}.json`
      : `fetely_pedidos_lote_${new Date().toISOString().slice(0, 10)}.json`;
  saveAs(blob, fname);
}

// ===== ZIP (lote PDF ou CSV separado) =====
export async function exportarZIP(
  pedidos: PedidoExportavel[],
  formato: "pdf" | "csv",
  opts: ExportOptions = DEFAULT_OPTIONS,
  tipoPdf: "cliente" | "interno" = "cliente",
): Promise<void> {
  const zip = new JSZip();
  for (const pedido of pedidos) {
    if (formato === "pdf") {
      const doc = buildPdfDoc(pedido, tipoPdf, opts);
      const blob = doc.output("blob");
      zip.file(`fetely_pedido_${safeFile(pedido.id)}_${pedido.dataISO.slice(0, 10)}.pdf`, blob);
    } else {
      const bom = "\uFEFF";
      const csv =
        bom +
        [CSV_HEADERS, ...rowsForPedido(pedido)].map((r) => r.map(csvEscape).join(",")).join("\n");
      zip.file(`fetely_pedido_${safeFile(pedido.id)}_${pedido.dataISO.slice(0, 10)}.csv`, csv);
    }
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `fetely_pedidos_lote_${new Date().toISOString().slice(0, 10)}.zip`);
}

// PDF builder retornando doc (para ZIP)
function buildPdfDoc(pedido: PedidoExportavel, tipo: "cliente" | "interno", opts: ExportOptions): jsPDF {
  // Truque: reuso exportarPDF gera download. Para ZIP precisamos do doc sem salvar.
  // Solução simples: replicar inline seria longo — usamos um patch: salvar e capturar não dá.
  // Em vez disso, refatoramos pequena: chamamos uma versão "build" que monta o doc.
  return _buildPdfInternal(pedido, tipo, opts);
}

function _buildPdfInternal(pedido: PedidoExportavel, tipo: "cliente" | "interno", opts: ExportOptions): jsPDF {
  // Versão idêntica a exportarPDF, sem doc.save
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const GOLD: [number, number, number] = [201, 168, 76];
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text("FETÉLY", 105, 20, { align: "center" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(120);
  doc.text("B2B Orders", 105, 26, { align: "center" });
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.line(15, 30, 195, 30);
  doc.setTextColor(0); doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text(`PEDIDO ${pedido.numeroPedido}`, 15, 38);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(pedido.dataHora, 195, 38, { align: "right" });

  const clienteBlock = [
    pedido.clienteRazaoSocial || "—",
    pedido.clienteCnpj ? `CNPJ: ${pedido.clienteCnpj}` : "",
    pedido.clienteContatoNome ? `Contato: ${pedido.clienteContatoNome}` : "",
    pedido.clienteTelefone, pedido.clienteEmail,
  ].filter(Boolean).join("\n");
  const vendedorBlock = opts.incluirVendedor
    ? [pedido.vendedorNome || "—",
       pedido.vendedorTipo ? `${pedido.vendedorTipo === "representante" ? "Representante" : "Interno"}` : "",
       pedido.vendedorLogin].filter(Boolean).join("\n")
    : "—";

  autoTable(doc, {
    startY: 42, head: [["CLIENTE", "VENDEDOR"]], body: [[clienteBlock, vendedorBlock]],
    headStyles: { fillColor: GOLD, textColor: [0,0,0], fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3, valign: "top" },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 90 } },
    margin: { left: 15, right: 15 },
  });

  const showVarejo = tipo === "interno";
  const head = showVarejo
    ? [["#", "PRODUTO", "Qtd", "Cx", "Varejo", "Atacado", "Subtotal"]]
    : [["#", "PRODUTO", "Qtd", "Cx", "Unit.", "Subtotal"]];
  const rows = pedido.itens.map((item, i) => {
    const desc = [
      item.nomeComercial,
      [item.corNome, item.tamanhoNumero].filter(Boolean).join(" · "),
      `SKU: ${item.sku}${opts.incluirEspecsTecnicas && item.ean ? `  EAN: ${item.ean}` : ""}`,
    ].filter(Boolean).join("\n");
    const base = [String(i + 1), desc, String(item.quantidade), String(item.quantidadeCaixas)];
    if (showVarejo) base.push(fmtBRL(item.precoVarejoUnit));
    base.push(fmtBRL(item.precoAtacadoUnit), fmtBRL(item.subtotalBruto));
    return base;
  });
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4, head, body: rows,
    headStyles: { fillColor: GOLD, textColor: [0,0,0], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [250,250,250] },
    styles: { fontSize: 8, cellPadding: 2.5, valign: "top" },
    margin: { left: 15, right: 15 },
  });

  const totaisBody: string[][] = [["Subtotal bruto (atacado)", fmtBRL(pedido.totalBrutoAtacado)]];
  if (pedido.totalDescontoCelebra > 0)
    totaisBody.push([`Desconto ${pedido.faixaNome} (${pedido.descontoCelebraPercent}%)`, `– ${fmtBRL(pedido.totalDescontoCelebra)}`]);
  if (pedido.totalDescontoNegociacao > 0)
    totaisBody.push([`Desconto negociação (${pedido.descontoNegociacaoPercent}%)`, `– ${fmtBRL(pedido.totalDescontoNegociacao)}`]);
  if (pedido.totalDescontoBonusPix > 0)
    totaisBody.push([`Bônus PIX (${pedido.bonusPixPercent}%)`, `– ${fmtBRL(pedido.totalDescontoBonusPix)}`]);
  if (pedido.freteIsento || pedido.frete === "CIF") {
    totaisBody.push([`Frete CIF (incluso · faixa ${pedido.faixaNome})`, "Grátis"]);
  } else if (pedido.frete === "FOB") {
    totaisBody.push([`Frete FOB`, `+ ${fmtBRL(pedido.freteValor)}`]);
  }
  totaisBody.push(["TOTAL DO PEDIDO", fmtBRL(pedido.totalLiquido)]);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4, body: totaisBody,
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 130, halign: "right" }, 1: { cellWidth: 50, halign: "right", fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.row.index === totaisBody.length - 1) {
        data.cell.styles.fillColor = GOLD;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 12;
      }
    },
    margin: { left: 15, right: 15 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`Fetély B2B Orders · Pedido ${pedido.numeroPedido} · Página ${i} de ${pageCount}`, 105, 290, { align: "center" });
  }
  return doc;
}
