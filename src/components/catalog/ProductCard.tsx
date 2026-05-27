import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { StockBadge } from "@/components/ui/StockBadge";
import { formatBRL, isValidMultiple } from "@/lib/format";
import { useOrder } from "@/store/orderStore";
import { usePhotos, getProdutoPhoto } from "@/store/photoStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import type { Product } from "@/types";


interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [qty, setQty] = useState(0);
  const addItem = useOrder((s) => s.addItem);
  const photos = usePhotos();
  const photo =
    getProdutoPhoto(photos, product.colecao, product.sku) ??
    getProdutoPhoto(photos, product.colecao, product.corNome);
  const indisponivel = product.precoAtacado <= 0;
  const canAdd = qty > 0 && isValidMultiple(qty, product.multiplos) && !indisponivel;

  return (
    <article className="group flex flex-col rounded-lg bg-surface gold-border gold-border-hover overflow-hidden transition">
      <Link
        to="/produto"
        search={{ sku: product.sku }}
        className="relative aspect-[4/3] overflow-hidden block"
        aria-label={`Ver detalhes de ${product.nomeComercial}`}
      >
        {photo ? (
          <img
            src={photo}
            alt={`${product.nomeComercial} — ${product.corNome}`}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <PhotoPlaceholder
            colecao={product.colecao}
            label={product.corNome}
            className="h-full w-full"
            showIcon={false}
          />
        )}
        <div className="absolute inset-0 flex items-end p-3 pointer-events-none">
          <div className="text-[10px] uppercase tracking-[0.2em] text-text-primary/90">
            {product.colecao}
          </div>
        </div>
        <div className="absolute top-3 right-3">
          <StockBadge status={product.statusEstoque} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent pointer-events-none" />
      </Link>



      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted">
            {product.grupo} • {product.tipo}
          </div>
          <Link
            to="/produto"
            search={{ sku: product.sku }}
            className="font-display text-lg leading-tight text-text-primary mt-1 block hover:text-gold transition"
          >
            {product.nomeComercial}
          </Link>
          <div className="mt-1 text-xs text-text-secondary">
            {product.corNome} · {product.tamanhoNumero}
          </div>
          <div className="mt-0.5 text-[10px] text-text-muted font-mono">{product.sku}</div>

        </div>

        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-gold-muted">Atacado</div>
            <span className="text-xl font-semibold text-gold leading-none">
              {indisponivel ? "—" : formatBRL(product.precoAtacado)}
            </span>
          </div>
          {!indisponivel && product.precoVarejo > 0 && (
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Varejo sug.</div>
              <span className="text-sm text-text-secondary leading-none">
                {formatBRL(product.precoVarejo)}
              </span>
            </div>
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
