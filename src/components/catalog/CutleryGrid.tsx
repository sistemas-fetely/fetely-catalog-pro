import { useEffect, useMemo, useState } from "react";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { StockBadge } from "@/components/ui/StockBadge";
import { formatBRL } from "@/lib/format";
import { useOrder } from "@/store/orderStore";
import { usePhotos, getProdutoPhoto } from "@/store/photoStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import { CollectionBulkFiller } from "@/components/catalog/CollectionBulkFiller";
import type { Product } from "@/types";

interface Props {
  products: Product[]; // todos os SKUs da coleção de talheres
  colecao: string;
  onColorChange?: (color: string) => void;
}

const TIPO_ORDER = ["Faca", "Garfo", "Colher"];

export function CutleryGrid({ products, colecao, onColorChange }: Props) {
  const colors = useMemo(
    () => Array.from(new Set(products.map((p) => p.corNome))),
    [products],
  );

  const [color, setColor] = useState(colors[0]);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const addBulk = useOrder((s) => s.addBulk);
  const photos = usePhotos();

  useEffect(() => {
    onColorChange?.(color);
  }, [color, onColorChange]);

  const filtered = useMemo(
    () =>
      products
        .filter((p) => p.corNome === color)
        .sort(
          (a, b) =>
            TIPO_ORDER.indexOf(a.tipo) - TIPO_ORDER.indexOf(b.tipo),
        ),
    [products, color],
  );

  const total = filtered.reduce(
    (sum, p) => sum + (qtys[p.sku] ?? 0) * p.precoAtacado,
    0,
  );
  const totalUnits = filtered.reduce((sum, p) => sum + (qtys[p.sku] ?? 0), 0);

  const handleAdd = () => {
    const entries = filtered
      .filter((p) => (qtys[p.sku] ?? 0) > 0)
      .map((p) => ({ product: p, quantity: qtys[p.sku] }));
    if (!entries.length) return;
    addBulk(entries);
    setQtys({});
  };

  const applyBoxes = (boxes: number) => {
    const next: Record<string, number> = { ...qtys };
    filtered.forEach((p) => {
      const step = Math.max(1, p.multiplos);
      next[p.sku] = boxes * step;
    });
    setQtys(next);
  };

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

      {/* Preencher (cor atual) */}
      <CollectionBulkFiller key={color} products={filtered} />

      {/* Atalhos por caixa (cor atual) */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gold/30 bg-surface-2/60 p-4">
        <span className="text-[10px] uppercase tracking-[0.2em] text-gold-muted mr-2">
          Preencher (caixas por tipo) — {color}
        </span>
        {[1, 2, 3, 6].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => applyBoxes(n)}
            className="rounded-full border border-border px-3 py-1.5 text-[11px] uppercase tracking-wider text-text-secondary hover:border-gold hover:text-gold transition"
          >
            {n} caixa{n > 1 ? "s" : ""}
          </button>
        ))}
      </div>

      {/* Linhas: Faca / Garfo / Colher */}
      <div className="rounded-lg gold-border overflow-hidden">
        <div className="grid grid-cols-[120px_1fr_120px_120px_160px] bg-surface-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
          <div className="px-4 py-3">Tipo</div>
          <div className="px-4 py-3">Produto</div>
          <div className="px-4 py-3 text-right">Varejo sug.</div>
          <div className="px-4 py-3 text-right">Atacado</div>
          <div className="px-4 py-3">Quantidade</div>
        </div>
        {filtered.map((p) => {
          const qty = qtys[p.sku] ?? 0;
          return (
            <div
              key={p.sku}
              className="grid grid-cols-[120px_1fr_120px_120px_160px] items-center border-t border-border/50 bg-surface hover:bg-surface-2/60 transition"
            >
              <div className="px-4 py-3 font-display text-lg text-gold">
                {p.tipo}
              </div>
              <div className="px-4 py-3 min-w-0">
                <div className="text-sm text-text-primary truncate">
                  {p.nomeComercial}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono text-text-muted">
                    {p.sku}
                  </span>
                  <StockBadge status={p.statusEstoque} estoqueDisponivel={p.estoqueDisponivel} />
                </div>
                <div className="text-[10px] text-text-muted mt-1">
                  Caixa: {p.multiplos} un.
                </div>
              </div>
              <div className="px-4 py-3 text-right text-xs text-text-secondary">
                {p.precoVarejo > 0 ? formatBRL(p.precoVarejo) : "—"}
              </div>
              <div className="px-4 py-3 text-right text-gold font-medium">
                {formatBRL(p.precoAtacado)}
              </div>
              <div className="px-4 py-3">
                <QuantityInput
                  value={qty}
                  onChange={(v) => setQtys((q) => ({ ...q, [p.sku]: v }))}
                  multiplos={p.multiplos}
                  compact
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumo + ação */}
      <div className="flex items-center justify-between rounded-lg gold-border bg-surface-2/95 backdrop-blur p-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted">
            Subtotal da seleção
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="font-display text-2xl text-gold">
              {formatBRL(total)}
            </span>
            <span className="text-xs text-text-secondary">
              {totalUnits} unidades
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled={totalUnits === 0}
          onClick={handleAdd}
          className="rounded-md bg-gold px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-background transition hover:bg-gold-light disabled:opacity-30"
        >
          Adicionar seleção ao carrinho
        </button>
      </div>
    </div>
  );
}
