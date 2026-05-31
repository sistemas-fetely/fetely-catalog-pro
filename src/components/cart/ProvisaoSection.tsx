import { Trash2 } from "lucide-react";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { formatBRL } from "@/lib/format";
import { extrairDataPrevisao } from "@/lib/classifyItem";
import { useOrder } from "@/store/orderStore";
import type { CartItem } from "@/types";

export function ProvisaoSection({ items }: { items: CartItem[] }) {
  const updateQty = useOrder((s) => s.updateQty);
  const removeItem = useOrder((s) => s.removeItem);
  const subtotal = items.reduce((s, i) => s + i.quantity * i.product.precoAtacado, 0);

  return (
    <section className="rounded-lg border border-blue-700/30 bg-blue-950/60 overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-3 py-3 sm:px-5 border-b border-blue-700/20 bg-blue-900/10">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.25em] text-blue-300 font-semibold">
            📋 Provisão futura — não faturado
          </div>
          <div className="text-[11px] text-blue-200/70 mt-0.5">
            Sem desconto · valores de referência
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-blue-200/70">Referência</div>
          <div className="text-blue-300 font-medium text-sm">{formatBRL(subtotal)}</div>
        </div>
      </header>
      <div className="px-3 py-2 sm:px-5 sm:py-2.5 text-[11px] text-blue-200/90 bg-blue-900/10 border-b border-blue-700/10">
        ⚠ Estes itens serão salvos como rascunho separado. Não entram no pedido atual.
      </div>
      <ul>
        {items.map((item) => {
          const previsao = extrairDataPrevisao(item.product.statusEstoque);
          return (
            <li
              key={item.sku}
              className="flex flex-col sm:grid sm:grid-cols-[1fr_140px_140px_40px] sm:items-center gap-3 sm:gap-4 px-3 py-3 sm:px-5 sm:py-4 border-t border-stock-pre/10 first:border-t-0"
            >
              <div className="min-w-0 flex items-start justify-between gap-2 sm:block">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-primary line-clamp-2 sm:truncate">
                    {item.product.nomeComercial}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] font-mono text-text-secondary">
                      {item.product.sku} · Caixa {item.product.multiplos}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-stock-pre/20 border border-stock-pre/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-stock-pre font-semibold">
                      {previsao}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => removeItem(item.sku)}
                  className="sm:hidden text-text-muted hover:text-stock-out p-2 -mr-2 -mt-1 shrink-0"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3 sm:contents">
                <QuantityInput
                  value={item.quantity}
                  onChange={(v) => updateQty(item.sku, v)}
                  multiplos={item.product.multiplos}
                  compact
                />
                <div className="text-right">
                  <div className="text-stock-pre font-medium">
                    {formatBRL(item.quantity * item.product.precoAtacado)}
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {formatBRL(item.product.precoAtacado)} un. ref.
                  </div>
                </div>
                <button
                  onClick={() => removeItem(item.sku)}
                  className="hidden sm:block text-text-muted hover:text-stock-out p-2"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
