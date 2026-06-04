import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Copy, Download, Home, FileClock, Mail, Printer, FileText, FileBarChart, XCircle, Trash2, RotateCcw } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { FRETE_PERCENT } from "@/lib/commercial";
import { useVisibleOrders, useOrder, useCanReprovarOrder } from "@/store/orderStore";
import { useAuth } from "@/store/authStore";
import { useProvisao } from "@/store/provisaoStore";
import type { SavedOrder } from "@/types";
import { ExportModal } from "@/components/export/ExportModal";
import { EnviarEmailDialog } from "@/components/EnviarEmailDialog";
import { ReprovarDialog } from "@/components/ReprovarDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { z } from "zod";

const search = z.object({
  id: z.string().optional(),
  provisaoId: z.string().optional(),
});

export const Route = createFileRoute("/confirmation")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Pedido confirmado — Fetély B2B" },
      { name: "description", content: "Resumo do pedido confirmado." },
    ],
  }),
  component: Confirmation,
});

function formatOrderText(order: SavedOrder): string {
  const lines: string[] = [];
  const sep = "═".repeat(50);
  const sub = "─".repeat(50);
  lines.push(sep);
  lines.push("          FETÉLY B2B ORDERS");
  lines.push("         Resumo do Pedido");
  lines.push(sep);
  lines.push(`Pedido:             ${order.id}`);
  lines.push(`Data:               ${new Date(order.createdAt).toLocaleString("pt-BR")}`);
  lines.push(`Vendedor:           ${order.meta.vendedor}`);
  lines.push(`Cliente / Lojista:  ${order.meta.cliente}`);
  if (order.meta.cnpj) lines.push(`CNPJ:               ${order.meta.cnpj}`);
  lines.push(sep);
  lines.push("PRODUTOS");
  lines.push(sub);

  const byCol = new Map<string, typeof order.items>();
  order.items.forEach((i) => {
    const arr = byCol.get(i.product.colecao) ?? [];
    arr.push(i);
    byCol.set(i.product.colecao, arr);
  });

  byCol.forEach((arr, col) => {
    lines.push(`\n[${col}]`);
    arr.forEach((i) => {
      lines.push(
        `  ${i.quantity.toString().padStart(4, " ")} un · ${i.product.sku} · ${i.product.nomeComercial}`,
      );
      lines.push(
        `       Unit: ${formatBRL(i.product.precoAtacado)}  Sub: ${formatBRL(i.quantity * i.product.precoAtacado)}`,
      );
    });
  });

  lines.push("");
  lines.push(sep);
  lines.push("RESUMO FINANCEIRO");
  lines.push(sub);

  const c = order.commercial;
  if (c) {
    lines.push(`Subtotal bruto (atacado):    ${formatBRL(c.bruto)}`);
    lines.push(
      `Desconto ${c.faixaNome} (${c.descontoCelebraPct}%): – ${formatBRL(c.descontoCelebraValor)}`,
    );
    if (c.descontoMasterPct > 0) {
      lines.push(
        `Desconto negociação (${c.descontoMasterPct}%):    – ${formatBRL(c.descontoMasterValor)}`,
      );
    }
    if (c.aplicouPix) {
      lines.push(`Bônus PIX (2,5%):              – ${formatBRL(c.bonusPixValor)}`);
    }
    if (c.frete === "FOB") {
      const subAposDesc = c.bruto - c.descontoCelebraValor - c.descontoMasterValor;
      const fretePct = c.fretePercent ?? FRETE_PERCENT;
      const freteVal = c.freteValor ?? subAposDesc * (fretePct / 100);
      if (freteVal > 0) {
        lines.push(`Frete FOB (${fretePct.toFixed(1).replace(".", ",")}%):              + ${formatBRL(freteVal)}`);
      }
    }
    lines.push(sub);
    lines.push(`TOTAL FINAL:                   ${formatBRL(c.totalFinal)}`);
    lines.push("");
    lines.push(sep);
    lines.push("CONDIÇÕES COMERCIAIS");
    lines.push(sub);
    lines.push(`Faixa:              ${c.faixaNome}`);
    lines.push(
      `Frete:              ${c.frete === "CIF" ? "CIF — Fetély entrega" : "FOB — por conta do lojista"}`,
    );
    lines.push(`Pagamento:          ${c.condicaoDescricao}`);
    if (c.negociacao) {
      lines.push(`Negociação:         Autorizada — ${c.justificativa || "—"}`);
    }
  } else {
    lines.push(`TOTAL ATACADO: ${formatBRL(order.total)}`);
  }
  if (order.meta.observacoes) {
    lines.push("");
    lines.push(`Observações: ${order.meta.observacoes}`);
  }
  lines.push(sep);
  return lines.join("\n");
}

function Confirmation() {
  const { id, provisaoId } = Route.useSearch();
  const history = useVisibleOrders({ includeReprovados: true });
  const ordersHidratado = useOrder((s) => s.hidratado);
  const provisoes = useProvisao((s) => s.provisoes);
  const provisoesHidratado = useProvisao((s) => s.hidratado);
  const order = useMemo(() => (id ? history.find((o) => o.id === id) : history[0]), [history, id]);
  const provisao = useMemo(
    () => (provisaoId ? provisoes.find((p) => p.id === provisaoId) : undefined),
    [provisoes, provisaoId],
  );
  const navigate = useNavigate();
  const isMaster = useAuth((s) => s.roles.includes("master"));
  const canReprovar = useCanReprovarOrder(order);
  const reprovarOrder = useOrder((s) => s.reprovarOrder);
  const desfazerReprovacao = useOrder((s) => s.desfazerReprovacao);
  const deleteOrder = useOrder((s) => s.deleteOrder);
  const hydrateOrderById = useOrder((s) => s.hydrateOrderById);
  const [reprovarOpen, setReprovarOpen] = useState(false);

  const [copied, setCopied] = useState(false);
  const [emailDialogAberto, setEmailDialogAberto] = useState(false);
  const [imprimirDialog, setImprimirDialog] = useState(false);
  const [printMode, setPrintMode] = useState<"completo" | "resumo">("completo");
  const [showExport, setShowExport] = useState(false);
  const [loadingPedidoCompleto, setLoadingPedidoCompleto] = useState(false);
  const [pedidoBancoTentadoId, setPedidoBancoTentadoId] = useState<string | null>(null);

  function executarImprimir(modo: "completo" | "resumo") {
    setPrintMode(modo);
    setImprimirDialog(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  }

  useEffect(() => {
    const cleanup = () => setPrintMode("completo");
    window.addEventListener("afterprint", cleanup);
    return () => window.removeEventListener("afterprint", cleanup);
  }, []);

  useEffect(() => {
    if (!id || !ordersHidratado) return;
    const atual = history.find((o) => o.id === id);
    const totalAtualItens = atual?.items.reduce((s, i) => s + i.product.precoAtacado * i.quantity, 0) ?? 0;
    const totalAtualBase = atual?.commercial?.bruto ?? atual?.total ?? 0;
    const precisaBanco = !atual || atual.items.length === 0 || Math.abs(totalAtualItens - totalAtualBase) > 0.05;
    if (!precisaBanco) return;
    if (pedidoBancoTentadoId === id) return;
    let cancelled = false;
    setLoadingPedidoCompleto(true);
    hydrateOrderById(id).finally(() => {
      setPedidoBancoTentadoId(id);
      if (!cancelled) setLoadingPedidoCompleto(false);
    });
    return () => {
      cancelled = true;
    };
  }, [history, hydrateOrderById, id, ordersHidratado, pedidoBancoTentadoId]);

  // Aguarda a hidratação dos stores antes de declarar "não encontrado".
  // Sem isto o usuário via o erro no primeiro clique e precisava retentar.
  const aguardandoHidratacao = !ordersHidratado || loadingPedidoCompleto || (!!id && !order && pedidoBancoTentadoId !== id) || (!!provisaoId && !provisoesHidratado);

  if (!order) {
    if (aguardandoHidratacao) {
      return (
        <main className="mx-auto max-w-2xl px-6 py-24 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
          <p className="mt-4 text-sm uppercase tracking-wider text-text-muted">
            Carregando pedido…
          </p>
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl">Nenhum pedido encontrado</h1>
        <Link
          to="/"
          className="inline-flex mt-6 items-center gap-2 text-gold uppercase tracking-wider text-xs"
        >
          Voltar ao início
        </Link>
      </main>
    );
  }

  const text = formatOrderText(order);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalItensBruto = order.items.reduce((s, i) => s + i.product.precoAtacado * i.quantity, 0);
  const totalBase = order.commercial?.bruto ?? order.total;
  const divergenciaItens = Math.abs(totalItensBruto - totalBase) > 0.05;

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="pedido-print">
      {printMode === "completo" ? (
        <>
          <div className="text-center mb-12">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 text-gold mb-4">
              <Check className="h-8 w-8" />
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Pedido confirmado</div>
            <h1 className="font-display text-5xl mt-2">{order.id}</h1>
            <p className="text-text-secondary text-sm mt-2">
              Gerado em {new Date(order.createdAt).toLocaleString("pt-BR")}
            </p>
          </div>

          {order.reprovado && (
            <div className="mb-6 rounded-lg border border-stock-out/40 bg-stock-out/10 p-4 print-hide">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-stock-out shrink-0 mt-0.5" />
                <div className="flex-1 text-sm">
                  <div className="font-semibold text-stock-out uppercase tracking-wider text-xs">
                    Pedido reprovado
                  </div>
                  <p className="text-text-secondary mt-1">
                    {order.reprovadoMotivo || "Sem motivo informado."}
                  </p>
                  <p className="text-[11px] text-text-muted mt-1">
                    Por {order.reprovadoPorNome ?? "—"} em{" "}
                    {order.reprovadoEm
                      ? new Date(order.reprovadoEm).toLocaleString("pt-BR")
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {(loadingPedidoCompleto || divergenciaItens) && (
            <div className={`mb-6 rounded-lg border p-4 print-hide ${divergenciaItens ? "border-stock-out/40 bg-stock-out/10" : "border-gold/30 bg-gold/10"}`}>
              <div className="text-xs uppercase tracking-wider text-text-secondary">
                {loadingPedidoCompleto ? "Validando pedido completo no banco…" : "Atenção: total dos itens diverge do total do pedido"}
              </div>
              {divergenciaItens && (
                <p className="mt-1 text-sm text-text-muted">
                  Itens somam {formatBRL(totalItensBruto)} e o pedido registra {formatBRL(totalBase)}.
                </p>
              )}
            </div>
          )}



          <div className="rounded-lg gold-border bg-surface p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Cliente" value={order.meta.cliente} />
              <Info label="CNPJ" value={order.meta.cnpj || "—"} />
              <Info label="Pagamento" value={order.meta.condicaoPagamento} />
              <Info label="Vendedor" value={order.meta.vendedor} />
            </div>
            {order.meta.observacoes && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                  Observações
                </div>
                <div className="text-sm text-text-secondary italic">{order.meta.observacoes}</div>
              </div>
            )}

            <pre className="bg-surface-2 rounded-md p-4 text-xs font-mono text-text-secondary overflow-x-auto whitespace-pre-wrap">
{text}
            </pre>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Total</div>
                <div className="font-display text-3xl text-gold">{formatBRL(order.total)}</div>
              </div>
              <div className="flex gap-3 print-hide">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 rounded-md gold-border px-4 py-2 text-xs uppercase tracking-wider text-gold hover:bg-gold/10 transition"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar resumo"}
                </button>
                <button
                  onClick={() => setShowExport(true)}
                  disabled={loadingPedidoCompleto}
                  className="flex items-center gap-2 rounded-md gold-border px-4 py-2 text-xs uppercase tracking-wider text-gold hover:bg-gold/10 transition"
                >
                  <Download className="h-4 w-4" /> Exportar
                </button>
                <button
                  onClick={() => setEmailDialogAberto(true)}
                  className="flex items-center gap-2 rounded-md gold-border px-4 py-2 text-xs uppercase tracking-wider text-gold hover:bg-gold/10 transition"
                >
                  <Mail className="h-4 w-4" /> Email
                </button>
                <button
                  onClick={() => setImprimirDialog(true)}
                  className="flex items-center gap-2 rounded-md gold-border px-4 py-2 text-xs uppercase tracking-wider text-gold hover:bg-gold/10 transition"
                >
                  <Printer className="h-4 w-4" /> Imprimir
                </button>
                {canReprovar && !order.reprovado && (
                  <button
                    onClick={() => setReprovarOpen(true)}
                    className="flex items-center gap-2 rounded-md border border-stock-out/40 px-4 py-2 text-xs uppercase tracking-wider text-stock-out hover:bg-stock-out/10 transition"
                  >
                    <XCircle className="h-4 w-4" /> Reprovar
                  </button>
                )}
                {canReprovar && order.reprovado && (
                  <button
                    onClick={async () => {
                      try {
                        await desfazerReprovacao(order.id);
                        toast.success("Reprovação desfeita");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Erro ao desfazer");
                      }
                    }}
                    className="flex items-center gap-2 rounded-md border border-stock-in/40 px-4 py-2 text-xs uppercase tracking-wider text-stock-in hover:bg-stock-in/10 transition"
                  >
                    <RotateCcw className="h-4 w-4" /> Desfazer reprovação
                  </button>
                )}
                {isMaster && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Deletar definitivamente o pedido ${order.id}? Esta ação não pode ser desfeita.`)) return;
                      try {
                        await deleteOrder(order.id);
                        toast.success("Pedido deletado");
                        navigate({ to: "/orders" });
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Erro ao deletar");
                      }
                    }}
                    className="flex items-center gap-2 rounded-md border border-stock-out/50 px-4 py-2 text-xs uppercase tracking-wider text-stock-out hover:bg-stock-out/15 transition"
                  >
                    <Trash2 className="h-4 w-4" /> Deletar
                  </button>
                )}
                <Link
                  to="/"
                  className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-xs uppercase tracking-wider text-background hover:bg-gold-light"
                >
                  <Home className="h-4 w-4" /> Início
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        <PedidoResumoPrintBlock order={order} />
      )}

      {provisao && (
        <div className="mt-6 rounded-lg border border-stock-pre/40 bg-stock-pre/5 p-6 print-hide">
          <div className="flex items-start gap-3">
            <FileClock className="h-6 w-6 text-stock-pre shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.25em] text-stock-pre font-semibold">
                📋 Provisão futura gerada
              </div>
              <div className="font-display text-2xl mt-1">{provisao.id}</div>
              <p className="text-sm text-text-secondary mt-1">
                {provisao.itens.length} {provisao.itens.length === 1 ? "item" : "itens"} · Prev. {provisao.proximaPrevisao} · Ref. {formatBRL(provisao.totalReferencia)}
              </p>
              <p className="text-xs text-text-muted mt-1">
                Salva como rascunho — você será notificado quando o estoque liberar.
              </p>
              <Link
                to="/provisoes"
                search={{ highlight: provisao.id }}
                className="inline-flex mt-3 items-center gap-2 text-xs uppercase tracking-wider text-stock-pre hover:text-stock-pre/80"
              >
                Ver provisão →
              </Link>
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <ExportModal orders={[order]} onClose={() => setShowExport(false)} />
      )}

      <EnviarEmailDialog
        order={order}
        open={emailDialogAberto}
        onOpenChange={setEmailDialogAberto}
      />

      <ReprovarDialog
        open={reprovarOpen}
        onOpenChange={setReprovarOpen}
        entidade="pedido"
        identificador={order.id}
        onConfirm={async (motivo) => {
          try {
            await reprovarOrder(order.id, motivo);
            toast.success("Pedido reprovado");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro ao reprovar");
          }
        }}
      />


      {/* Modal de escolha de modo de impressão */}
      <Dialog open={imprimirDialog} onOpenChange={setImprimirDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-gold" /> Imprimir {order.id}
            </DialogTitle>
            <DialogDescription>Escolha o modo de impressão</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => executarImprimir("completo")}
              className="group flex flex-col items-center gap-3 rounded-lg border border-border bg-card hover:border-gold hover:bg-gold/5 transition-all px-4 py-6 text-left"
            >
              <FileText className="h-8 w-8 text-gold" />
              <div className="text-center">
                <div className="text-sm font-semibold text-text-primary">Completo</div>
                <div className="text-[11px] text-text-muted mt-1">
                  Lista item por item · pode ocupar várias páginas
                </div>
              </div>
            </button>
            <button
              onClick={() => executarImprimir("resumo")}
              className="group flex flex-col items-center gap-3 rounded-lg border border-border bg-card hover:border-gold hover:bg-gold/5 transition-all px-4 py-6 text-left"
            >
              <FileBarChart className="h-8 w-8 text-gold" />
              <div className="text-center">
                <div className="text-sm font-semibold text-text-primary">Resumo</div>
                <div className="text-[11px] text-text-muted mt-1">
                  1 página · agrupado por coleção
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </main>
  );
}

function PedidoResumoPrintBlock({ order }: { order: SavedOrder }) {
  const c = order.commercial;
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const grupos = (() => {
    const map = new Map<string, { skus: number; qtd: number; valor: number }>();
    for (const item of order.items) {
      const key = item.product.colecao || "—";
      const cur = map.get(key) ?? { skus: 0, qtd: 0, valor: 0 };
      cur.skus += 1;
      cur.qtd += item.quantity;
      cur.valor += item.product.precoAtacado * item.quantity;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([colecao, dados]) => ({ colecao, ...dados }))
      .sort((a, b) => b.valor - a.valor);
  })();

  const totalUnidades = order.items.reduce((s, i) => s + i.quantity, 0);
  const totalSkus = order.items.length;

  return (
    <div style={{ fontSize: "9.5pt", lineHeight: 1.4, color: "#000" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: "8px", marginBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "18pt", fontWeight: 700, letterSpacing: "0.05em" }}>FETÉLY</div>
          <div style={{ fontSize: "8pt", letterSpacing: "0.2em", color: "#555" }}>B2B ORDERS</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "8pt", letterSpacing: "0.2em", color: "#555" }}>PEDIDO</div>
          <div style={{ fontSize: "14pt", fontWeight: 600 }}>{order.id}</div>
          <div style={{ fontSize: "8.5pt", color: "#555" }}>
            {new Date(order.createdAt).toLocaleString("pt-BR")}
          </div>
        </div>
      </div>

      {/* Cliente + Vendedor */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "7.5pt", letterSpacing: "0.15em", color: "#666", marginBottom: "2px" }}>CLIENTE</div>
          <div style={{ fontSize: "11pt", fontWeight: 600 }}>{order.meta.cliente || "—"}</div>
          <div style={{ fontSize: "8.5pt", color: "#444" }}>
            CNPJ {order.meta.cnpj || "—"}
            {order.meta.nomeFantasia ? `   ·   ${order.meta.nomeFantasia}` : ""}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "7.5pt", letterSpacing: "0.15em", color: "#666", marginBottom: "2px" }}>VENDEDOR</div>
          <div style={{ fontSize: "11pt", fontWeight: 600 }}>{order.vendedorNome || order.meta.vendedor || "—"}</div>
        </div>
      </div>

      {/* Condições comerciais */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px", border: "1px solid #ccc", padding: "8px 10px", marginBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "7.5pt", letterSpacing: "0.15em", color: "#666" }}>PAGAMENTO</div>
          <div style={{ fontSize: "9.5pt", fontWeight: 500 }}>{c?.condicaoDescricao || order.meta.condicaoPagamento}</div>
        </div>
        {c && (
          <>
            <div>
              <div style={{ fontSize: "7.5pt", letterSpacing: "0.15em", color: "#666" }}>FRETE</div>
              <div style={{ fontSize: "9.5pt", fontWeight: 500 }}>
                {c.frete}{c.frete === "CIF" ? " — Fetély entrega" : " — Cliente retira"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "7.5pt", letterSpacing: "0.15em", color: "#666" }}>FAIXA</div>
              <div style={{ fontSize: "9.5pt", fontWeight: 500 }}>{c.faixaNome}</div>
            </div>
          </>
        )}
      </div>

      {/* Itens por coleção */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "8pt", letterSpacing: "0.15em", color: "#666", marginBottom: "4px" }}>
          ITENS AGRUPADOS POR COLEÇÃO
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid #000" }}>
              <th style={{ textAlign: "left", padding: "4px 6px" }}>Coleção</th>
              <th style={{ textAlign: "right", padding: "4px 6px", width: "60px" }}>SKUs</th>
              <th style={{ textAlign: "right", padding: "4px 6px", width: "80px" }}>Unidades</th>
              <th style={{ textAlign: "right", padding: "4px 6px", width: "100px" }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <tr key={g.colecao} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "4px 6px" }}>{g.colecao}</td>
                <td style={{ textAlign: "right", padding: "4px 6px" }}>{g.skus}</td>
                <td style={{ textAlign: "right", padding: "4px 6px" }}>{g.qtd}</td>
                <td style={{ textAlign: "right", padding: "4px 6px" }}>{fmt(g.valor)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: "1.5px solid #000", fontWeight: 600 }}>
              <td style={{ padding: "6px" }}>Total bruto</td>
              <td style={{ textAlign: "right", padding: "6px" }}>{totalSkus}</td>
              <td style={{ textAlign: "right", padding: "6px" }}>{totalUnidades}</td>
              <td style={{ textAlign: "right", padding: "6px" }}>{fmt(c?.bruto || order.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Resumo financeiro */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", border: "1px solid #ccc", padding: "10px 12px", marginBottom: "12px" }}>
        <div style={{ fontSize: "9pt" }}>
          {c && c.descontoCelebraValor > 0 && (
            <div>
              Desconto {c.faixaNome} ({c.descontoCelebraPct}%): − {fmt(c.descontoCelebraValor)}
            </div>
          )}
          {c && c.descontoMasterValor > 0 && (
            <div>
              Desconto Master ({c.descontoMasterPct}%): − {fmt(c.descontoMasterValor)}
            </div>
          )}
          {c && c.aplicouPix && c.bonusPixValor > 0 && (
            <div>Bônus PIX: − {fmt(c.bonusPixValor)}</div>
          )}
          {c && c.frete === "FOB" && (() => {
            const subAposDesc = c.bruto - c.descontoCelebraValor - c.descontoMasterValor;
            const fretePct = c.fretePercent ?? FRETE_PERCENT;
            const freteVal = c.freteValor ?? subAposDesc * (fretePct / 100);
            if (freteVal <= 0) return null;
            return (
              <div style={{ fontWeight: 600 }}>
                Frete FOB ({fretePct.toFixed(1).replace(".", ",")}%): + {fmt(freteVal)}
              </div>
            );
          })()}
          {!c && <div>Pagamento: {order.meta.condicaoPagamento}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "8pt", letterSpacing: "0.2em", color: "#666" }}>TOTAL FINAL</div>
          <div style={{ fontSize: "20pt", fontWeight: 700 }}>{fmt(order.total)}</div>
        </div>
      </div>

      {/* Observações */}
      {order.meta.observacoes && (
        <div style={{ fontSize: "9pt", marginBottom: "12px", paddingTop: "8px", borderTop: "1px solid #eee" }}>
          <span style={{ fontWeight: 600 }}>Observações:</span> {order.meta.observacoes}
        </div>
      )}

      {/* Rodapé */}
      <div style={{ borderTop: "1px solid #ccc", paddingTop: "6px", marginTop: "16px", display: "flex", justifyContent: "space-between", fontSize: "7.5pt", color: "#666" }}>
        <div>Documento gerado em {new Date().toLocaleString("pt-BR")}</div>
        <div>fetelycorp.com.br</div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="text-sm text-text-primary mt-0.5">{value}</div>
    </div>
  );
}
