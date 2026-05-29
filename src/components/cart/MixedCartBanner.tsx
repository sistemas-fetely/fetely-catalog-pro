import { Zap } from "lucide-react";
import { formatBRL } from "@/lib/format";

export function MixedCartBanner({
  firmeCount,
  firmeTotal,
  provisaoCount,
  provisaoTotal,
}: {
  firmeCount: number;
  firmeTotal: number;
  provisaoCount: number;
  provisaoTotal: number;
}) {
  return (
    <div className="rounded-lg border border-gold/40 bg-gradient-to-r from-gold/10 via-gold/5 to-transparent p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Zap className="h-5 w-5 text-gold mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold font-semibold">
            Carrinho misto detectado
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Seu carrinho tem itens em estoque e itens com previsão. Serão separados automaticamente.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-surface-2 px-3 py-2 border border-stock-in/30">
              <div className="text-[10px] uppercase tracking-wider text-stock-in">📦 Pedido firme</div>
              <div className="text-text-primary font-medium mt-0.5">
                {firmeCount} {firmeCount === 1 ? "item" : "itens"} ·{" "}
                <span className="text-gold">{formatBRL(firmeTotal)}</span>
              </div>
            </div>
            <div className="rounded-md bg-surface-2 px-3 py-2 border border-stock-pre/30">
              <div className="text-[10px] uppercase tracking-wider text-stock-pre">📋 Provisão futura</div>
              <div className="text-text-primary font-medium mt-0.5">
                {provisaoCount} {provisaoCount === 1 ? "item" : "itens"} ·{" "}
                <span className="text-text-secondary">{formatBRL(provisaoTotal)}</span>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-text-muted mt-2">
            Os itens de previsão <strong>não entram</strong> no pedido atual — serão salvos como rascunho para faturamento futuro.
          </p>
        </div>
      </div>
    </div>
  );
}
