import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { X, Heart, Check } from "lucide-react";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { StockBadge } from "@/components/ui/StockBadge";
import { formatBRL, isValidMultiple } from "@/lib/format";
import { useOrder } from "@/store/orderStore";
import { useAuth } from "@/store/authStore";
import { usePhotos, getProdutoPhoto } from "@/store/photoStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import { roteamentoQtd } from "@/lib/classifyItem";
import type { Product } from "@/types";


interface ProductCardProps {
  product: Product;
  /**
   * Modo "pré-seleção" (catálogo público de reuniões).
   * Quando presente, substitui o bloco de adicionar-ao-carrinho por
   * controles de interesse + quantidade opcional.
   */
  preSelecao?: {
    qty: number | undefined; // undefined = não selecionado; 0 = interesse sem qtd
    onQty: (q: number) => void;
    onInteresse: () => void;
  };
}

export function ProductCard({ product, preSelecao }: ProductCardProps) {
  const [qty, setQty] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const addItem = useOrder((s) => s.addItem);
  const session = useAuth((s) => s.session);
  const isPublic = !session;
  const photos = usePhotos();
  const photo =
    getProdutoPhoto(photos, product.colecao, product.sku) ??
    getProdutoPhoto(photos, product.colecao, product.corNome);
  const isVelaCategory = product.categoria === "Luz e Momento";
  const showUnitPrice = !isVelaCategory && product.qtdKit > 1;
  const indisponivel = isPublic
    ? product.precoVarejo <= 0
    : product.precoAtacado <= 0;
  const canAdd = qty > 0 && isValidMultiple(qty, product.multiplos) && !indisponivel;

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox]);

  return (
    <article className="group flex flex-col rounded-lg bg-surface gold-border gold-border-hover overflow-hidden transition">
      <button
        type="button"
        onClick={() => photo && setLightbox(true)}
        aria-label={`Ampliar foto de ${product.nomeComercial}`}
        className="relative aspect-square overflow-hidden block w-full text-left cursor-zoom-in"
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
          <StockBadge status={product.statusEstoque} estoqueDisponivel={product.estoqueDisponivel} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent pointer-events-none" />
      </button>

      {lightbox && photo && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(false);
            }}
            className="absolute top-4 right-4 rounded-full bg-background/80 hover:bg-background p-2 text-text-primary transition"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={photo}
            alt={`${product.nomeComercial} — ${product.corNome}`}
            className="max-h-[92vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center pointer-events-none px-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold">{product.colecao}</div>
            <div className="font-display text-xl text-text-primary mt-1">
              {product.nomeComercial}
            </div>
            <div className="text-xs text-text-secondary mt-0.5">
              {product.corNome} · {product.tamanhoNumero}
            </div>
          </div>
        </div>
      )}



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
          {!isPublic && (
            <div className="mt-0.5 text-[10px] text-text-muted font-mono">{product.sku}</div>
          )}
        </div>

        {isPublic ? (
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-gold-muted">
                Preço sugerido
              </div>
              <span className="text-xl font-semibold text-gold leading-none">
                {indisponivel ? "—" : formatBRL(product.precoVarejo)}
              </span>
              {!indisponivel && showUnitPrice && product.precoVarejo > 0 && (
                <div className="mt-1 text-[10px] text-text-muted">
                  {formatBRL(product.precoVarejo / product.qtdKit)} / un. ({product.qtdKit} un. por kit)
                </div>
              )}
            </div>
            {!indisponivel && product.precoAtacado > 0 && (
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Atacado</div>
                <span className="text-sm text-text-secondary leading-none">
                  {formatBRL(product.precoAtacado)}
                </span>
                {showUnitPrice && (
                  <div className="mt-1 text-[10px] text-text-muted">
                    {formatBRL(product.precoAtacado / product.qtdKit)} / un.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-gold-muted">Atacado</div>
              <span className="text-xl font-semibold text-gold leading-none">
                {indisponivel ? "—" : formatBRL(product.precoAtacado)}
              </span>
              {!indisponivel && showUnitPrice && product.precoAtacado > 0 && (
                <div className="mt-1 text-[10px] text-text-muted">
                  {formatBRL(product.precoAtacado / product.qtdKit)} / un.
                </div>
              )}
            </div>
            {!indisponivel && product.precoVarejo > 0 && (
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Varejo sug.</div>
                <span className="text-sm text-text-secondary leading-none">
                  {formatBRL(product.precoVarejo)}
                </span>
                {showUnitPrice && (
                  <div className="mt-1 text-[10px] text-text-muted">
                    {formatBRL(product.precoVarejo / product.qtdKit)} / un.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {!isPublic && showUnitPrice && (
          <div className="text-[10px] text-text-muted -mt-1">
            Kit com {product.qtdKit} un.
          </div>
        )}

        {!isPublic && !preSelecao && (() => {
          const split = qty > 0 ? roteamentoQtd(product, qty) : { firme: 0, provisao: 0 };
          const isMisto = split.firme > 0 && split.provisao > 0;
          const isSoProvisao = split.firme === 0 && split.provisao > 0;
          const btnLabel = indisponivel
            ? "Indisponível"
            : qty === 0
            ? "Adicionar"
            : isMisto
            ? `Adicionar (${split.firme} firme + ${split.provisao} provisão)`
            : isSoProvisao
            ? `Provisionar (${split.provisao})`
            : `Adicionar (${split.firme})`;
          return (
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
              {qty > 0 && isMisto && (
                <div className="rounded-md border border-stock-pre/40 bg-stock-pre/10 px-2 py-1 text-[10px] text-stock-pre text-center">
                  Parte do pedido irá para provisão (excede estoque disponível)
                </div>
              )}
              <button
                type="button"
                disabled={!canAdd}
                onClick={() => {
                  addItem(product, qty);
                  setQty(0);
                }}
                className={`w-full rounded-md py-2 text-xs font-semibold uppercase tracking-[0.15em] transition disabled:opacity-30 disabled:cursor-not-allowed ${
                  isSoProvisao
                    ? "bg-stock-pre text-background hover:opacity-90"
                    : "bg-gold text-background hover:bg-gold-light"
                }`}
              >
                {btnLabel}
              </button>
            </div>
          );
        })()}

        {preSelecao && (() => {
          const selected = preSelecao.qty !== undefined;
          const isInterest = selected && preSelecao.qty === 0;
          return (
            <div className="mt-auto space-y-2 pt-2 border-t border-border/60">
              <div className="text-[10px] uppercase tracking-wider text-text-muted flex items-center justify-between">
                <span>Caixa: {product.multiplos} un.</span>
                {selected && (
                  <span className="inline-flex items-center gap-1 text-gold">
                    <Check className="h-3 w-3" />
                    {isInterest ? "interesse marcado" : "selecionado"}
                  </span>
                )}
              </div>
              <QuantityInput
                value={preSelecao.qty ?? 0}
                onChange={preSelecao.onQty}
                multiplos={product.multiplos}
                disabled={indisponivel}
              />
              {isInterest && (
                <div className="rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-[10px] text-gold text-center">
                  <Heart className="inline h-3 w-3 mr-1" fill="currentColor" />
                  Quantidade a definir com o consultor
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  // Se já tem qty>0, remove tudo. Senão alterna interesse (0).
                  if (selected && (preSelecao.qty ?? 0) > 0) {
                    preSelecao.onQty(-1);
                  } else {
                    preSelecao.onInteresse();
                  }
                }}
                className={`w-full rounded-md py-1.5 text-[11px] uppercase tracking-wider border transition ${
                  selected
                    ? "border-gold/50 text-gold hover:bg-gold/10"
                    : "border-border text-text-secondary hover:border-gold/40 hover:text-gold"
                }`}
              >
                <Heart className="inline h-3 w-3 mr-1" fill={selected ? "currentColor" : "none"} />
                {selected
                  ? (isInterest ? "Remover interesse" : "Remover seleção")
                  : "Tenho interesse (sem qtd)"}
              </button>
            </div>
          );
        })()}
      </div>
    </article>
  );
}
