import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, History, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/precos")({
  component: PrecosHistoryPage,
});

interface HistRow {
  id: string;
  product_id: string;
  sku: string | null;
  nome_comercial: string | null;
  preco_atacado_anterior: number | null;
  preco_varejo_anterior: number | null;
  preco_atacado_novo: number | null;
  preco_varejo_novo: number | null;
  variacao_atacado_percent: number | null;
  variacao_varejo_percent: number | null;
  acao: string;
  alterado_por_nome: string | null;
  criado_em: string;
}

const brl = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(Number(n));

function PrecosHistoryPage() {
  const [rows, setRows] = useState<HistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("product_price_history")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(500);
      if (!error && data) setRows(data as HistRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.sku ?? "").toLowerCase().includes(q) ||
      (r.nome_comercial ?? "").toLowerCase().includes(q) ||
      (r.alterado_por_nome ?? "").toLowerCase().includes(q)
    );
  });

  const renderVariacao = (pct: number | null) => {
    if (pct == null) return <span className="text-text-secondary">—</span>;
    if (pct === 0)
      return (
        <span className="inline-flex items-center gap-1 text-text-secondary">
          <Minus className="h-3 w-3" />
          0%
        </span>
      );
    if (pct > 0)
      return (
        <span className="inline-flex items-center gap-1 text-emerald-500">
          <TrendingUp className="h-3 w-3" />+{pct}%
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-red-500">
        <TrendingDown className="h-3 w-3" />
        {pct}%
      </span>
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Link
          to="/settings"
          className="mb-4 inline-flex items-center gap-2 text-sm text-text-secondary hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
            <History className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-text-primary">
              Histórico de Preços
            </h1>
            <p className="text-sm text-text-secondary">
              Auditoria de todas as alterações de preço dos produtos
            </p>
          </div>
        </div>

        <input
          type="text"
          placeholder="Buscar por SKU, produto ou usuário..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary"
        />

        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-hover text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Produto</th>
                <th className="px-4 py-3 text-left">Ação</th>
                <th className="px-4 py-3 text-right">Atacado Ant.</th>
                <th className="px-4 py-3 text-right">Atacado Novo</th>
                <th className="px-4 py-3 text-right">Δ Atacado</th>
                <th className="px-4 py-3 text-right">Varejo Ant.</th>
                <th className="px-4 py-3 text-right">Varejo Novo</th>
                <th className="px-4 py-3 text-right">Δ Varejo</th>
                <th className="px-4 py-3 text-left">Alterado por</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-text-secondary">
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-text-secondary">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-surface-hover">
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(r.criado_em).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.sku ?? "—"}</td>
                    <td className="px-4 py-3">{r.nome_comercial ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          r.acao === "create"
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-gold/15 text-gold"
                        }`}
                      >
                        {r.acao === "create" ? "criação" : "alteração"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{brl(r.preco_atacado_anterior)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{brl(r.preco_atacado_novo)}</td>
                    <td className="px-4 py-3 text-right">{renderVariacao(r.variacao_atacado_percent)}</td>
                    <td className="px-4 py-3 text-right">{brl(r.preco_varejo_anterior)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{brl(r.preco_varejo_novo)}</td>
                    <td className="px-4 py-3 text-right">{renderVariacao(r.variacao_varejo_percent)}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.alterado_por_nome ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-text-secondary">
          Exibindo as últimas 500 alterações. O histórico é gravado automaticamente sempre que um preço é alterado.
        </p>
      </div>
    </div>
  );
}
