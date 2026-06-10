import { useEffect, useMemo, useState } from "react";
import { COLLECTION_ACCENT } from "@/data/products";
import { formatBRL } from "@/lib/format";
import { usePhotos, getProdutoPhoto } from "@/store/photoStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import type { Product } from "@/types";

interface Props {
  products: Product[];
  colecao: string;
  onColorChange?: (color: string) => void;
}

/**
 * Versão pública (somente leitura) da apresentação de velas numéricas.
 * Mostra variantes de cor + tamanho e a grade 0–9 com preços, sem ações de carrinho.
 */
export function NumericalCandleShowcase({ products, colecao, onColorChange }: Props) {
  const colors = useMemo(
    () => Array.from(new Set(products.map((p) => p.corNome))),
    [products],
  );
  const sizes = useMemo(
    () => Array.from(new Set(products.map((p) => p.tamanhoNumero))),
    [products],
  );

  const [color, setColor] = useState(colors[0]);
  const [size, setSize] = useState(sizes[0]);
  const photos = usePhotos();

  useEffect(() => {
    onColorChange?.(color);
  }, [color, onColorChange]);

  const filtered = products
    .filter((p) => p.corNome === color && p.tamanhoNumero === size)
    .sort((a, b) => (a.numeroVela ?? 0) - (b.numeroVela ?? 0));

  const accent = COLLECTION_ACCENT[colecao] ?? "oklch(0.5 0 0)";

  return (
    <div className="space-y-6">
      {/* Seletor de cor */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted mb-2">
          Variante de cor
        </div>
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => {
            const photo = getProdutoPhoto(photos, colecao, c);
            const active = c === color;
            return (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`flex items-center gap-2 pl-1 pr-4 py-1 rounded-full text-xs uppercase tracking-wider border transition ${
                  active
                    ? "bg-gold text-background border-gold"
                    : "border-border text-text-secondary hover:border-gold/60 hover:text-gold-light"
                }`}
              >
                {photo ? (
                  <img
                    src={photo}
                    alt={c}
                    className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <PhotoPlaceholder
                    colecao={colecao}
                    label={c}
                    className="h-8 w-8 rounded-full flex-shrink-0"
                    showIcon={false}
                  />
                )}
                <span>{c}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Seletor de tamanho */}
      {sizes.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted mb-2">
            Tamanho
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`px-4 py-2 rounded-md text-xs uppercase tracking-wider border transition ${
                  s === size
                    ? "bg-surface-2 border-gold text-gold"
                    : "border-border text-text-secondary hover:border-gold/60"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grade 0-9 (somente leitura) */}
      <div className="rounded-lg gold-border overflow-hidden">
        <div className="grid grid-cols-[64px_1fr_140px] bg-surface-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
          <div className="px-4 py-3">Nº</div>
          <div className="px-4 py-3">Produto</div>
          <div className="px-4 py-3 text-right">Preço sugerido</div>
        </div>
        {filtered.map((p) => (
          <div
            key={p.sku}
            className="grid grid-cols-[64px_1fr_140px] items-center border-t border-border/50 bg-surface"
          >
            <div
              className="px-4 py-3 font-display text-3xl font-semibold"
              style={{ color: accent }}
            >
              {p.numeroVela}
            </div>
            <div className="px-4 py-3 min-w-0">
              <div className="text-sm text-text-primary truncate">{p.nomeComercial}</div>
              <div className="text-[10px] font-mono text-text-muted mt-1">{p.sku}</div>
            </div>
            <div className="px-4 py-3 text-right">
              {p.precoVarejo > 0 ? (
                <span className="text-gold font-medium">{formatBRL(p.precoVarejo)}</span>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
