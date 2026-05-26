import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Trash2, Eye, Package } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { useOrder } from "@/store/orderStore";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Pedidos salvos — Fetély B2B" },
      { name: "description", content: "Histórico de pedidos salvos." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const history = useOrder((s) => s.history);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.meta.cliente.toLowerCase().includes(q) ||
        (o.meta.cnpj ?? "").toLowerCase().includes(q),
    );
  }, [history, query]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Histórico</div>
          <h1 className="font-display text-4xl mt-1">Pedidos salvos</h1>
          <p className="text-sm text-text-secondary mt-2">
            {history.length} pedido{history.length === 1 ? "" : "s"} registrado
            {history.length === 1 ? "" : "s"} neste dispositivo.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por cliente, CNPJ ou nº pedido..."
          className="w-72 rounded-md gold-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-gold"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg gold-border bg-surface p-12 text-center">
          <Package className="h-10 w-10 text-gold/60 mx-auto mb-3" />
          <p className="text-text-secondary">
            {history.length === 0
              ? "Nenhum pedido salvo ainda."
              : "Nenhum pedido encontrado para essa busca."}
          </p>
          <Link
            to="/catalog"
            className="inline-block mt-4 text-xs uppercase tracking-wider text-gold hover:underline"
          >
            Ir ao catálogo
          </Link>
        </div>
      ) : (
        <div className="rounded-lg gold-border bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="text-left px-4 py-3">Pedido</th>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">CNPJ</th>
                <th className="text-right px-4 py-3">Itens</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const qty = o.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <tr key={o.id} className="border-t border-border hover:bg-surface-2/50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-gold">{o.id}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(o.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">{o.meta.cliente || "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">{o.meta.cnpj || "—"}</td>
                    <td className="px-4 py-3 text-right">{qty}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gold">
                      {formatBRL(o.total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/confirmation"
                        search={{ id: o.id }}
                        className="inline-flex items-center gap-1.5 rounded-md gold-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-gold hover:bg-gold/10"
                      >
                        <Eye className="h-3 w-3" /> Ver
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
