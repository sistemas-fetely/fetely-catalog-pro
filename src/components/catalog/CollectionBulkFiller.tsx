import { useState } from "react";
import { useOrder } from "@/store/orderStore";
import { formatBRL } from "@/lib/format";
import type { Product } from "@/types";

interface Props {
  products: Product[];
}

type Pending = {
  label: string;
  entries: { product: Product; quantity: number }[];
};

export function CollectionBulkFiller({ products }: Props) {
  const [n, setN] = useState(1);
  const [pending, setPending] = useState<Pending | null>(null);
  const addBulk = useOrder((s) => s.addBulk);
  const presets = [6, 12, 24];

  const buildBoxes = (perItem: number): Pending => ({
    label: `${perItem} caixa${perItem > 1 ? "s" : ""} por item`,
    entries: products
      .filter((p) => p.precoAtacado > 0)
      .map((p) => ({ product: p, quantity: perItem * Math.max(1, p.multiplos) })),
  });

  const buildUnits = (units: number): Pending => ({
    label: `${units} unidades por item`,
    entries: products
      .filter((p) => p.precoAtacado > 0)
      .map((p) => ({ product: p, quantity: units })),
  });

  const confirm = () => {
    if (!pending) return;
    addBulk(pending.entries);
    setPending(null);
  };

  return (
    <>
      <div className="space-y-3 rounded-lg border border-gold/30 bg-surface-2/60 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
              Preencher coleção
            </div>
            <div className="text-xs text-text-secondary mt-1">
              Aplica a mesma quantidade para cada item da coleção.
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
              onClick={() => setPending(buildBoxes(n))}
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
              onClick={() => setPending(buildUnits(u))}
              className="rounded-full border border-border px-3 py-1.5 text-[11px] uppercase tracking-wider text-text-secondary hover:border-gold hover:text-gold transition"
            >
              {u} un. por item
            </button>
          ))}
        </div>
      </div>

      {pending && (
        <PreviewModal
          pending={pending}
          onCancel={() => setPending(null)}
          onConfirm={confirm}
        />
      )}
    </>
  );
}

function PreviewModal({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: Pending;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const totalUnits = pending.entries.reduce((s, e) => s + e.quantity, 0);
  const total = pending.entries.reduce(
    (s, e) => s + e.quantity * e.product.precoAtacado,
    0,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl gold-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-5 border-b border-border">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">
            Confirmar preenchimento
          </div>
          <h2 className="font-display text-2xl mt-1">Revisar adição ao carrinho</h2>
          <p className="text-xs text-text-secondary mt-1">
            Aplicando <span className="text-gold">{pending.label}</span> em{" "}
            {pending.entries.length} {pending.entries.length === 1 ? "item" : "itens"}.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-[0.18em] text-text-muted sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">Item</th>
                <th className="px-4 py-2 text-right">Qtd.</th>
                <th className="px-4 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {pending.entries.map(({ product, quantity }) => (
                <tr key={product.sku} className="border-t border-border/50">
                  <td className="px-4 py-2.5">
                    <div className="text-text-primary truncate">{product.nomeComercial}</div>
                    <div className="text-[10px] text-text-muted font-mono">{product.sku}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-text-secondary">{quantity}</td>
                  <td className="px-4 py-2.5 text-right text-gold">
                    {formatBRL(quantity * product.precoAtacado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="p-5 border-t border-border flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted">
              Subtotal da coleção
            </div>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="font-display text-2xl text-gold">{formatBRL(total)}</span>
              <span className="text-xs text-text-secondary">{totalUnits} unidades</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-text-secondary hover:text-text-primary hover:border-gold/40 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-md bg-gold px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-background hover:bg-gold-light transition"
            >
              Confirmar e adicionar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
