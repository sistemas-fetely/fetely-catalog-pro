import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CartItem, Product, SavedOrder } from "@/types";
import type { Cotacao } from "@/types/cotacao";
import type { ProvisaoFutura } from "@/types/provisao";

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

function renderOrderToDoc(doc: jsPDF, order: SavedOrder): void {
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

  // ─── TABELA DE ITENS ───
  const rows = order.items.map((item) => {
    const subtotal = item.product.precoAtacado * item.quantity;
    return [
      item.sku,
      item.product.nomeComercial || item.product.nomeCompleto || "",
      `${item.quantity}`,
      formatBRL(item.product.precoAtacado),
      formatBRL(subtotal),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["SKU", "Descrição", "Qtd", "Unit", "Subtotal"]],
    body: rows,
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
    columnStyles: {
      0: { cellWidth: 28 },
      2: { cellWidth: 12, halign: "right" },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
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
      items.push([`Bônus PIX`, `− ${formatBRL(c.bonusPixValor)}`]);
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

export function generateOrderPDF(order: SavedOrder): OrderPDFResult {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  renderOrderToDoc(doc, order);
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
export function generateOrdersBatchPDF(
  orders: SavedOrder[],
  mode: "completa" | "resumida",
): OrderPDFResult {
  if (mode === "completa") {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    orders.forEach((order, idx) => {
      if (idx > 0) doc.addPage();
      renderOrderToDoc(doc, order);
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

/**
 * Imprime vários pedidos numa única chamada (resumida ou completa).
 */
export function printOrdersBatch(
  orders: SavedOrder[],
  mode: "completa" | "resumida",
): void {
  const { blob } = generateOrdersBatchPDF(orders, mode);
  const url = URL.createObjectURL(blob);

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
  iframe.src = url;
  document.body.appendChild(iframe);

  iframe.addEventListener("load", () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("[printOrdersBatch] print direto falhou, abrindo nova aba:", err);
        window.open(url, "_blank");
      }
    }, 300);
  });

  setTimeout(() => {
    document.getElementById("__print_order_iframe")?.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

export function openOrderPDFInNewTab(order: SavedOrder): void {
  const { blob, filename } = generateOrderPDF(order);
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
export function printOrderPDF(order: SavedOrder): void {
  const { blob } = generateOrderPDF(order);
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
export function generateCotacaoPDF(cotacao: Cotacao): OrderPDFResult {
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
  const result = generateOrderPDF(fakeOrder);
  // Renomeia o arquivo final
  const filename = `Cotacao-${cotacao.id}-${(cotacao.meta.cliente || "cliente").replace(/[^a-zA-Z0-9\-_]/g, "-").slice(0, 40)}.pdf`;
  return { ...result, filename };
}

/**
 * Gera PDF de uma provisão futura. Reaproveita o gerador de pedido para manter
 * o mesmo visual, mas marca claramente como rascunho de provisão (valores de
 * referência, sem compromisso fiscal).
 */
export function generateProvisaoPDF(provisao: ProvisaoFutura): OrderPDFResult {
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

  const result = generateOrderPDF(fakeOrder);
  const filename = `Provisao-${provisao.id}-${(snap.razaoSocial || snap.nomeFantasia || "cliente").replace(/[^a-zA-Z0-9\-_]/g, "-").slice(0, 40)}.pdf`;
  return { ...result, filename };
}
