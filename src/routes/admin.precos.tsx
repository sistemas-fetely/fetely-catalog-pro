import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Table as TableIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/precos")({
  component: PrecosTablePage,
});

interface ProductRow {
  id: string;
  sku: string;
  nome_comercial: string;
  colecao: string | null;
  cor_nome: string | null;
  preco_varejo: number;
  preco_atacado: number;
  ativo: boolean;
}

const DISCOUNTS = [0, 5, 10, 15, 20, 25] as const;

const brl = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(Number(n));

function PrecosTablePage() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("id, sku, nome_comercial, colecao, cor_nome, preco_varejo, preco_atacado, ativo")
        .order("nome_comercial", { ascending: true })
        .limit(2000);
      if (!error && data) setRows(data as ProductRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyActive && !r.ativo) return false;
      if (!q) return true;
      return (
        r.sku.toLowerCase().includes(q) ||
        (r.nome_comercial ?? "").toLowerCase().includes(q) ||
        (r.colecao ?? "").toLowerCase().includes(q) ||
        (r.cor_nome ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, onlyActive]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-[1600px] px-4 py-8">
        <Link
          to="/settings"
          className="mb-4 inline-flex items-center gap-2 text-sm text-text-secondary hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
              <TableIcon className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-text-primary">Tabela de Preço</h1>
              <p className="text-sm text-text-secondary">
                Preços por SKU com escalonamento de descontos sobre o atacado
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar por SKU, produto, coleção ou cor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary"
          />
          <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Apenas ativos
          </label>
          <span className="ml-auto text-xs text-text-secondary">
            {filtered.length} {filtered.length === 1 ? "produto" : "produtos"}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-hover text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="sticky left-0 z-10 bg-surface-hover px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Produto</th>
                <th className="px-4 py-3 text-left">Coleção</th>
                <th className="px-4 py-3 text-left">Cor</th>
                <th className="px-4 py-3 text-right">Preço Varejo</th>
                {DISCOUNTS.map((d) => (
                  <th key={d} className="px-4 py-3 text-right">
                    {d === 0 ? "Preço Atacado" : `Atacado -${d}%`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5 + DISCOUNTS.length} className="px-4 py-8 text-center text-text-secondary">
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5 + DISCOUNTS.length} className="px-4 py-8 text-center text-text-secondary">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-surface-hover">
                    <td className="sticky left-0 z-10 bg-surface px-4 py-3 font-mono text-xs">{r.sku}</td>
                    <td className="px-4 py-3">{r.nome_comercial}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.colecao ?? "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.cor_nome ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{brl(r.preco_varejo)}</td>
                    {DISCOUNTS.map((d) => {
                      const value = Number(r.preco_atacado) * (1 - d / 100);
                      return (
                        <td
                          key={d}
                          className={`px-4 py-3 text-right ${d === 0 ? "font-semibold text-text-primary" : "text-text-primary"}`}
                        >
                          {brl(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-text-secondary">
          Os preços com desconto são calculados sobre o Preço Atacado vigente de cada SKU.
        </p>
      </div>
    </div>
  );
}
