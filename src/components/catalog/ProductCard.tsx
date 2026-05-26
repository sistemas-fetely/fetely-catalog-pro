import { useState } from "react";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { StockBadge } from "@/components/ui/StockBadge";
import { COLLECTION_ACCENT } from "@/data/products";
import { formatBRL, isValidMultiple } from "@/lib/format";
import { useOrder } from "@/store/orderStore";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [qty, setQty] = useState(0);
  const addItem = useOrder((s) => s.addItem);
  const accent = COLLECTION_ACCENT[product.colecao] ?? "oklch(0.5 0 0)";
  const indisponivel = product.precoAtacado <= 0;
  const canAdd = qty > 0 && isValidMultiple(qty, product.multiplos) && !indisponivel;

  return (
    <article className="group flex flex-col rounded-lg bg-surface gold-border gold-border-hover overflow-hidden transition">
      <div
        className="relative aspect-[4/3] overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, oklch(0.18 0 0) 100%)`,
        }}
      >
        <div className="absolute inset-0 flex items-end p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-text-primary/80">
            {product.colecao}
          </div>
        </div>
        <div className="absolute top-3 right-3">
          <StockBadge status={product.statusEstoque} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent" />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted">
            {product.grupo} • {product.tipo}
          </div>
          <h3 className="font-display text-lg leading-tight text-text-primary mt-1">
            {product.nomeComercial}
          </h3>
          <div className="mt-1 text-xs text-text-secondary">
            {product.corNome} · {product.tamanhoNumero}
          </div>
          <div className="mt-0.5 text-[10px] text-text-muted font-mono">{product.sku}</div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-gold">
            {indisponivel ? "—" : formatBRL(product.precoAtacado)}
          </span>
          {!indisponivel && (
            <span className="text-xs text-text-muted line-through">
              {formatBRL(product.precoVarejo)}
            </span>
          )}
        </div>

        <div className="mt-auto space-y-2 pt-2 border-t border-border/60">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">
            Caixa: {product.multiplos} un. — mínimo
          </div>
          <QuantityInput
            value={qty}
            onChange={setQty}
            multiplos={product.multiplos}
            disabled={indisponivel}
          />
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => {
              addItem(product, qty);
              setQty(0);
            }}
            className="w-full rounded-md bg-gold py-2 text-xs font-semibold uppercase tracking-[0.15em] text-background transition hover:bg-gold-light disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {indisponivel ? "Indisponível" : "Adicionar"}
          </button>
        </div>
      </div>
    </article>
  );
}
