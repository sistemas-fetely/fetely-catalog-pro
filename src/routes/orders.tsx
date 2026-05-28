import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, Package } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { useVisibleOrders } from "@/store/orderStore";
import { useAuth } from "@/store/authStore";

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
  const history = useVisibleOrders();
  const isAdminOrMaster = useAuth((s) => s.roles.includes("admin") || s.roles.includes("master"));
  const [query, setQuery] = useState("");
  const [vendedorFilter, setVendedorFilter] = useState<string>("all");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // lista de vendedores únicos (somente admin vê dropdown)
  const vendedores = useMemo(() => {
    const map = new Map<string, string>();
    history.forEach((o) => {
      if (o.vendedorId) {
        map.set(o.vendedorId, o.vendedorNome ?? o.vendedorLogin ?? o.vendedorId);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [history]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((o) => {
      if (vendedorFilter !== "all" && o.vendedorId !== vendedorFilter) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.meta.cliente.toLowerCase().includes(q) ||
        (o.meta.cnpj ?? "").toLowerCase().includes(q) ||
        (o.vendedorNome ?? "").toLowerCase().includes(q)
      );
    });
  }, [history, query, vendedorFilter]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Histórico</div>
          <h1 className="font-display text-4xl mt-1">Pedidos salvos</h1>
          <p className="text-sm text-text-secondary mt-2">
            {history.length} pedido{history.length === 1 ? "" : "s"}
            {isAdminOrMaster ? " no sistema" : " seu"}
            {history.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {isAdminOrMaster && vendedores.length > 0 && (
            <select
              value={vendedorFilter}
              onChange={(e) => setVendedorFilter(e.target.value)}
              className="rounded-md gold-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
            >
              <option value="all">Todos os vendedores</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por cliente, CNPJ ou nº pedido..."
            className="w-72 rounded-md gold-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>
      </div>

      {!hydrated ? (
        <div className="rounded-lg gold-border bg-surface p-12 text-center text-text-secondary">
          Carregando pedidos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg gold-border bg-surface p-12 text-center">
          <Package className="h-10 w-10 text-gold/60 mx-auto mb-3" />
          <p className="text-text-secondary">
            {history.length === 0
              ? "Nenhum pedido encontrado. Seus pedidos aparecerão aqui após a primeira venda."
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
                {isAdminOrMaster && <th className="text-left px-4 py-3">Vendedor</th>}
                <th className="text-left px-4 py-3">CNPJ</th>
                <th className="text-right px-4 py-3">Itens</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const qty = o.items.reduce((s, i) => s + i.quantity, 0);
                const isRep = o.vendedorTipo === "representante";
                return (
                  <tr key={o.id} className="border-t border-border hover:bg-surface-2/50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-gold">{o.id}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(o.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">{o.meta.cliente || "—"}</td>
                    {isAdminOrMaster && (
                      <td className="px-4 py-3">
                        {o.vendedorNome ? (
                          <div className="flex flex-col gap-0.5">
                            <span>{o.vendedorNome}</span>
                            <span className="text-[10px] text-text-muted">
                              {o.vendedorLogin ?? "—"}
                              {o.vendedorTipo && (
                                <span
                                  className={`ml-2 inline-block px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${
                                    isRep
                                      ? "bg-amber-500/15 text-amber-300"
                                      : "bg-gold/15 text-gold"
                                  }`}
                                >
                                  {isRep ? "Rep" : "Interno"}
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>
                    )}
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
