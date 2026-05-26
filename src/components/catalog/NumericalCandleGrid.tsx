import { useMemo, useState } from "react";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { StockBadge } from "@/components/ui/StockBadge";
import { COLLECTION_ACCENT } from "@/data/products";
import { formatBRL } from "@/lib/format";
import { useOrder } from "@/store/orderStore";
import { usePhotos, getProdutoPhoto } from "@/store/photoStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import type { Product } from "@/types";

interface Props {
  products: Product[]; // todos os SKUs da coleção (numerica)
  colecao: string;
}

export function NumericalCandleGrid({ products, colecao }: Props) {
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
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const addBulk = useOrder((s) => s.addBulk);
  const photos = usePhotos();
  const colorPhoto = getProdutoPhoto(photos, colecao, color);

  const filtered = products
    .filter((p) => p.corNome === color && p.tamanhoNumero === size)
    .sort((a, b) => (a.numeroVela ?? 0) - (b.numeroVela ?? 0));

  const accent = COLLECTION_ACCENT[colecao] ?? "oklch(0.5 0 0)";

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

  return (
    <div className="space-y-6">
      {/* Seletor de cor */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted mb-2">
          Variante de cor
        </div>
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`px-4 py-2 rounded-full text-xs uppercase tracking-wider border transition ${
                c === color
                  ? "bg-gold text-background border-gold"
                  : "border-border text-text-secondary hover:border-gold/60 hover:text-gold-light"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Seletor de tamanho */}
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

      {/* Preenchimento em lote */}
      <BulkFiller
        onApplyBoxes={(perItem) => {
          const next: Record<string, number> = { ...qtys };
          filtered.forEach((p) => {
            const step = Math.max(1, p.multiplos);
            next[p.sku] = perItem * step;
          });
          setQtys(next);
        }}
        onApplyUnits={(units) => {
          const next: Record<string, number> = { ...qtys };
          filtered.forEach((p) => {
            next[p.sku] = units;
          });
          setQtys(next);
        }}
      />


      {/* Grade 0-9 */}
      <div className="rounded-lg gold-border overflow-hidden">
        <div className="grid grid-cols-[64px_1fr_120px_120px_160px] bg-surface-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
          <div className="px-4 py-3">Nº</div>
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
              className="grid grid-cols-[64px_1fr_120px_120px_160px] items-center border-t border-border/50 bg-surface hover:bg-surface-2/60 transition"
            >
              <div
                className="px-4 py-3 font-display text-3xl font-semibold"
                style={{ color: accent }}
              >
                {p.numeroVela}
              </div>
              <div className="px-4 py-3 flex items-center gap-3">
                {colorPhoto ? (
                  <img
                    src={colorPhoto}
                    alt={color}
                    className="h-10 w-10 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <PhotoPlaceholder
                    colecao={colecao}
                    label={color}
                    className="h-10 w-10 rounded flex-shrink-0"
                    showIcon={false}
                  />
                )}
                <div className="min-w-0">
                  <div className="text-sm text-text-primary truncate">{p.nomeComercial}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-text-muted">{p.sku}</span>
                    <StockBadge status={p.statusEstoque} />
                  </div>
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
      <div className="sticky bottom-4 flex items-center justify-between rounded-lg gold-border bg-surface-2/95 backdrop-blur p-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted">
            Subtotal da seleção
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="font-display text-2xl text-gold">{formatBRL(total)}</span>
            <span className="text-xs text-text-secondary">{totalUnits} unidades</span>
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

function BulkFiller({
  onApplyBoxes,
  onApplyUnits,
}: {
  onApplyBoxes: (perItem: number) => void;
  onApplyUnits: (units: number) => void;
}) {
  const [n, setN] = useState(1);
  const presets = [6, 12, 24];
  return (
    <div className="space-y-3 rounded-lg border border-gold/30 bg-surface-2/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
            Preencher coleção
          </div>
          <div className="text-xs text-text-secondary mt-1">
            Aplica a mesma quantidade em cada número (0–9) da combinação selecionada.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-stretch rounded-md border border-border bg-surface h-10">
            <button
              type="button"
              onClick={() => setN((v) => Math.max(1, v - 1))}
              className="px-3 text-text-secondary hover:text-gold"
              aria-label="Diminuir"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={n}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) setN(Math.max(1, v));
              }}
              className="w-16 bg-transparent text-center font-medium outline-none"
            />
            <button
              type="button"
              onClick={() => setN((v) => v + 1)}
              className="px-3 text-text-secondary hover:text-gold"
              aria-label="Aumentar"
            >
              +
            </button>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-text-muted">
            caixa{n > 1 ? "s" : ""} por número
          </span>
          <button
            type="button"
            onClick={() => onApplyBoxes(n)}
            className="rounded-md border border-gold/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-gold hover:bg-gold hover:text-background transition"
          >
            Aplicar a todos
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
        <span className="text-[10px] uppercase tracking-[0.2em] text-text-muted mr-1">
          Atalhos por unidades
        </span>
        {presets.map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => onApplyUnits(u)}
            className="rounded-full border border-border px-3 py-1.5 text-[11px] uppercase tracking-wider text-text-secondary hover:border-gold hover:text-gold transition"
          >
            {u} un. por nº
          </button>
        ))}
      </div>
    </div>
  );
}
