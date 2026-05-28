import { useState } from "react";
import { useOrder } from "@/store/orderStore";
import type { Product } from "@/types";

interface Props {
  products: Product[];
}

export function CollectionBulkFiller({ products }: Props) {
  const [n, setN] = useState(1);
  const addBulk = useOrder((s) => s.addBulk);
  const presets = [6, 12, 24];

  const applyBoxes = (perItem: number) => {
    const entries = products
      .filter((p) => p.precoAtacado > 0)
      .map((p) => ({ product: p, quantity: perItem * Math.max(1, p.multiplos) }));
    if (entries.length) addBulk(entries);
  };

  const applyUnits = (units: number) => {
    const entries = products
      .filter((p) => p.precoAtacado > 0)
      .map((p) => ({ product: p, quantity: units }));
    if (entries.length) addBulk(entries);
  };

  return (
    <div className="space-y-3 rounded-lg border border-gold/30 bg-surface-2/60 p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
            Preencher coleção
          </div>
          <div className="text-xs text-text-secondary mt-1">
            Adiciona ao carrinho a mesma quantidade para cada item da coleção.
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
            caixa{n > 1 ? "s" : ""} por item
          </span>
          <button
            type="button"
            onClick={() => applyBoxes(n)}
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
            onClick={() => applyUnits(u)}
            className="rounded-full border border-border px-3 py-1.5 text-[11px] uppercase tracking-wider text-text-secondary hover:border-gold hover:text-gold transition"
          >
            {u} un. por item
          </button>
        ))}
      </div>
    </div>
  );
}
