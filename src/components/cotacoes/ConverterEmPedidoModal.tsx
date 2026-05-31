import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import type { Cotacao } from "@/types/cotacao";
import { useOrder } from "@/store/orderStore";
import { useCotacao } from "@/store/cotacaoStore";

export function ConverterEmPedidoModal({
  cotacao,
  onClose,
  onConverted,
}: {
  cotacao: Cotacao;
  onClose: () => void;
  onConverted: (pedidoId: string) => void;
}) {
  const saveOrder = useOrder((s) => s.saveOrder);
  const setMeta = useOrder((s) => s.setMeta);
  const clearCart = useOrder((s) => s.clearCart);
  const addBulk = useOrder((s) => s.addBulk);
  const marcarConvertida = useCotacao((s) => s.marcarConvertida);
  const [saving, setSaving] = useState(false);

  const handleConvert = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Carrega o cart com os itens da cotação para reusar saveOrder
      clearCart();
      addBulk(cotacao.items.map((i) => ({ product: i.product, quantity: i.quantity })));
      setMeta({
        ...cotacao.meta,
        cotacaoOrigemId: cotacao.id,
        pedidoOrigem: "cotacao",
      });
      const pedido = await saveOrder(cotacao.commercial, cotacao.items);
      marcarConvertida(cotacao.id, pedido.id);
      clearCart();
      toast.success(`Cotação ${cotacao.id} convertida no Pedido ${pedido.id}`);
      onConverted(pedido.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível converter";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-lg gold-border bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl">Converter em pedido</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary" aria-label="Fechar" disabled={saving}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-md border border-gold/40 bg-gold/5 p-4 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-gold font-semibold">
            Cotação {cotacao.id}
          </div>
          <div className="text-sm text-text-primary">
            {cotacao.meta.cliente} · {cotacao.items.length} {cotacao.items.length === 1 ? "item" : "itens"}
          </div>
          <div className="font-display text-2xl text-gold">{formatBRL(cotacao.total)}</div>
          <div className="text-[11px] text-text-muted">
            {cotacao.commercial?.condicaoDescricao ?? "—"}
            {cotacao.commercial?.frete ? ` · ${cotacao.commercial.frete}` : ""}
          </div>
        </div>

        <p className="text-xs text-text-secondary">
          Um pedido firme será criado com os mesmos itens e condições. A cotação ficará marcada como
          convertida.
        </p>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-md border border-border py-2.5 text-xs uppercase tracking-wider text-text-secondary hover:text-text-primary disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleConvert}
            disabled={saving}
            className="flex-1 rounded-md bg-gold py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-background hover:bg-gold-light disabled:opacity-40"
          >
            {saving ? "Convertendo…" : "✦ Confirmar conversão"}
          </button>
        </div>
      </div>
    </div>
  );
}
