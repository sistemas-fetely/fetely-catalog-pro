import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/store/authStore";
import { useOrder } from "@/store/orderStore";
import { formatBRL } from "@/lib/format";
import { getBonusPixPercent, formatPercentBR } from "@/lib/commercial";

import type { SavedOrder } from "@/types";
import { ExportModal } from "@/components/export/ExportModal";
import { Download, X } from "lucide-react";

export const Route = createFileRoute("/portal/pedidos")({
  component: PortalPedidos,
});

function PortalPedidos() {
  const clienteId = useAuth((s) => s.profile?.cliente_id ?? null);
  const all = useOrder((s) => s.history);
  const meus = useMemo(
    () => all.filter((o) => clienteId && o.meta.clienteId === clienteId),
    [all, clienteId],
  );

  const [periodo, setPeriodo] = useState<"all" | "30" | "90" | "365">("all");
  const [selected, setSelected] = useState<SavedOrder | null>(null);
  const [exporting, setExporting] = useState<SavedOrder | null>(null);

  const filtered = useMemo(() => {
    if (periodo === "all") return meus;
    const days = Number(periodo);
    const cutoff = Date.now() - days * 86400_000;
    return meus.filter((o) => new Date(o.createdAt).getTime() >= cutoff);
  }, [meus, periodo]);

  return (
    <div className="max-w-6xl mx-auto">
      <header className="flex items-baseline justify-between mb-6 pb-4 border-b border-border">
        <h1 className="font-display text-3xl text-text-primary">Meus Pedidos</h1>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as typeof periodo)}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs"
        >
          <option value="all">Todos os períodos</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="365">Último ano</option>
        </select>
      </header>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-border bg-surface/40 px-6 py-12 text-center text-text-muted text-sm">
          Nenhum pedido encontrado.
        </div>
      ) : (
        <div className="rounded-md border border-border bg-surface/40 overflow-hidden">
          <div className="grid grid-cols-[90px_120px_1fr_160px_140px] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-text-muted bg-surface border-b border-border">
            <div>#</div>
            <div>Data</div>
            <div>Pagamento</div>
            <div className="text-right">Valor final</div>
            <div className="text-right">Ações</div>
          </div>
          {filtered.map((p) => {
            const st = p.statusPedido ?? "confirmado";
            const badge =
              st === "pendente_aprovacao"
                ? p.temSolicitacaoAjuste
                  ? { txt: "⚠ Ajuste solicitado", cls: "text-amber-400 border-amber-500/40 bg-amber-500/10" }
                  : { txt: "⏳ Em análise", cls: "text-amber-300 border-amber-500/30 bg-amber-500/5" }
                : st === "recusado"
                  ? { txt: "❌ Não aprovado", cls: "text-stock-out border-stock-out/40 bg-stock-out/10" }
                  : st === "cancelado"
                    ? { txt: "Cancelado", cls: "text-text-muted border-border bg-surface" }
                    : { txt: "✅ Confirmado", cls: "text-stock-in border-stock-in/40 bg-stock-in/10" };
            return (
              <div
                key={p.id}
                className="grid grid-cols-[90px_120px_1fr_160px_140px] gap-3 px-4 py-3 text-xs items-center border-b border-border/40 last:border-b-0 hover:bg-surface-hover transition cursor-pointer"
                onClick={() => setSelected(p)}
              >
                <span className="font-mono text-text-muted">
                  {p.id.replace("PED-", "#")}
                </span>
                <span className="text-text-secondary">
                  {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                </span>
                <span className="text-text-primary truncate">
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider mr-2 ${badge.cls}`}>
                    {badge.txt}
                  </span>
                  {p.commercial?.condicaoDescricao ?? p.meta.condicaoPagamento}
                </span>
                <span className="text-right text-gold font-medium">
                  {formatBRL(p.total)}
                </span>
                <div
                  className="flex justify-end gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setExporting(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wider text-text-secondary hover:text-gold hover:border-gold"
                  >
                    <Download className="h-3 w-3" /> PDF
                  </button>
                </div>
              </div>
            );
          })}

        </div>
      )}

      {selected && (
        <OrderDetailDrawer order={selected} onClose={() => setSelected(null)} />
      )}
      {exporting && (
        <ExportModal orders={[exporting]} onClose={() => setExporting(null)} />
      )}
    </div>
  );
}

function OrderDetailDrawer({ order, onClose }: { order: SavedOrder; onClose: () => void }) {
  const desconto =
    (order.commercial?.descontoCelebraValor ?? 0) +
    (order.commercial?.descontoMasterValor ?? 0);
  const descontoPct =
    (order.commercial?.descontoCelebraPct ?? 0) +
    (order.commercial?.descontoMasterPct ?? 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-background border-l border-border h-full overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted">
              Pedido
            </div>
            <h2 className="font-display text-2xl text-text-primary mt-1">
              {order.id.replace("PED-", "#")}
            </h2>
            <p className="text-xs text-text-secondary mt-1">
              {new Date(order.createdAt).toLocaleString("pt-BR")}
            </p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-gold p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <section className="space-y-2">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
              Itens
            </h3>
            <div className="rounded-md border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_60px_90px_90px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted bg-surface border-b border-border">
                <div>Produto</div>
                <div className="text-right">Qtd</div>
                <div className="text-right">Unit.</div>
                <div className="text-right">Subtotal</div>
              </div>
              {order.items.map((it) => (
                <div
                  key={it.sku}
                  className="grid grid-cols-[1fr_60px_90px_90px] gap-2 px-3 py-2 text-xs border-b border-border/40 last:border-b-0"
                >
                  <div className="text-text-primary truncate">
                    {it.product.nomeComercial}
                    <span className="text-text-muted">
                      {it.product.corNome ? ` · ${it.product.corNome}` : ""}
                      {it.product.tamanhoNumero ? ` · ${it.product.tamanhoNumero}` : ""}
                    </span>
                  </div>
                  <div className="text-right text-text-secondary">{it.quantity}</div>
                  <div className="text-right text-text-secondary">
                    {formatBRL(it.product.precoAtacado)}
                  </div>
                  <div className="text-right text-text-primary">
                    {formatBRL(it.product.precoAtacado * it.quantity)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-border bg-surface/40 p-4 space-y-2">
            {order.commercial && (
              <>
                <Row
                  label="Subtotal"
                  value={formatBRL(order.commercial.bruto)}
                />
                {desconto > 0 && (
                  <Row
                    label={`✦ Desconto especial (${descontoPct}%)`}
                    value={`− ${formatBRL(desconto)}`}
                    highlight
                  />
                )}
                {order.commercial.bonusPixValor > 0 && (
                  <Row
                    label={`Bônus PIX (${formatPercentBR(getBonusPixPercent(order.commercial))}%)`}
                    value={`− ${formatBRL(order.commercial.bonusPixValor)}`}
                  />
                )}

                <Row label="Frete" value={order.commercial.frete} />
                <Row
                  label="Pagamento"
                  value={order.commercial.condicaoDescricao}
                />
              </>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-border">
              <span className="text-xs uppercase tracking-wider text-gold-muted">
                Valor final
              </span>
              <span className="font-display text-2xl text-gold">
                {formatBRL(order.total)}
              </span>
            </div>
          </section>

          {order.meta.clienteSnapshot && (
            <section className="rounded-md border border-border bg-surface/40 p-4 text-xs space-y-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted mb-2">
                Entrega
              </div>
              <p className="text-text-secondary">
                {order.meta.clienteSnapshot.enderecoEntrega}
              </p>
            </section>
          )}

          {order.meta.observacoesCliente && (
            <section className="rounded-md border border-border bg-surface/40 p-4 text-xs">
              <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted mb-2">
                Observações
              </div>
              <p className="text-text-secondary whitespace-pre-wrap">
                {order.meta.observacoesCliente}
              </p>
            </section>
          )}

          <section className="rounded-md border border-border bg-surface/40 p-4 text-[11px] space-y-1 text-text-muted">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted mb-2">
              Histórico
            </div>
            <div>Criado em {new Date(order.createdAt).toLocaleString("pt-BR")}</div>
            {order.vendedorNome && (
              <div>
                Vendedor responsável:{" "}
                <span className="text-text-secondary">{order.vendedorNome}</span>
              </div>
            )}
            {order.aprovadoEm && (
              <div>
                Aprovado em {new Date(order.aprovadoEm).toLocaleString("pt-BR")}
                {order.aprovadoPorNome ? ` por ${order.aprovadoPorNome}` : ""}
              </div>
            )}
            {order.recusadoEmAprovacao && (
              <div className="text-stock-out">
                Recusado em{" "}
                {new Date(order.recusadoEmAprovacao).toLocaleString("pt-BR")}
                {order.recusadoPorNome ? ` por ${order.recusadoPorNome}` : ""}
                {order.recusadoMotivoTexto ? ` — ${order.recusadoMotivoTexto}` : ""}
              </div>
            )}
            {order.ajusteMensagem && (
              <div className="text-amber-400">
                Ajuste solicitado: {order.ajusteMensagem}
              </div>
            )}
            {(order.historico ?? []).map((h, i) => (
              <div key={i}>
                {new Date(h.em).toLocaleString("pt-BR")} ·{" "}
                <span className="text-text-secondary">{h.acao}</span>
                {h.porNome ? ` — ${h.porNome}` : ""}
                {h.obs ? ` · ${h.obs}` : ""}
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-text-secondary">{label}</span>
      <span className={highlight ? "text-gold font-medium" : "text-text-primary"}>
        {value}
      </span>
    </div>
  );
}
