import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, Download, Home, FileClock, Mail, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { formatBRL } from "@/lib/format";
import { useVisibleOrders } from "@/store/orderStore";
import { useProvisao } from "@/store/provisaoStore";
import type { SavedOrder } from "@/types";
import { ExportModal } from "@/components/export/ExportModal";
import { EnviarEmailDialog } from "@/components/EnviarEmailDialog";

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
  const history = useVisibleOrders();
  const provisoes = useProvisao((s) => s.provisoes);
  const order = useMemo(() => history.find((o) => o.id === id) ?? history[0], [history, id]);
  const provisao = useMemo(
    () => (provisaoId ? provisoes.find((p) => p.id === provisaoId) : undefined),
    [provisoes, provisaoId],
  );

  const [copied, setCopied] = useState(false);
  const [emailDialogAberto, setEmailDialogAberto] = useState(false);

  if (!order) {
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
  const [showExport, setShowExport] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
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

        <pre className="bg-surface-2 rounded-md p-4 text-xs font-mono text-text-secondary overflow-x-auto whitespace-pre-wrap max-h-96 scrollbar-thin">
{text}
        </pre>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Total</div>
            <div className="font-display text-3xl text-gold">{formatBRL(order.total)}</div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 rounded-md gold-border px-4 py-2 text-xs uppercase tracking-wider text-gold hover:bg-gold/10 transition"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar resumo"}
            </button>
            <button
              onClick={() => setShowExport(true)}
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
              onClick={() => printOrderPDF(order)}
              className="flex items-center gap-2 rounded-md gold-border px-4 py-2 text-xs uppercase tracking-wider text-gold hover:bg-gold/10 transition"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </button>
            <Link
              to="/"
              className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-xs uppercase tracking-wider text-background hover:bg-gold-light"
            >
              <Home className="h-4 w-4" /> Início
            </Link>
          </div>
        </div>
      </div>

      {provisao && (
        <div className="mt-6 rounded-lg border border-stock-pre/40 bg-stock-pre/5 p-6">
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
    </main>
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
