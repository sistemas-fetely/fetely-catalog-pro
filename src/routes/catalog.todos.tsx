import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ArrowLeft, Search, X } from "lucide-react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { useCatalog } from "@/store/catalogStore";
import type { Product } from "@/types";

const searchSchema = z.object({
  q: fallback(z.string(), "").optional(),
  categoria: fallback(z.string(), "").optional(),
  colecao: fallback(z.string(), "").optional(),
});

export const Route = createFileRoute("/catalog/todos")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Todos os produtos — Catálogo Fetély" },
      {
        name: "description",
        content:
          "Lista completa dos produtos Fetély com busca por nome, código e filtros por categoria e coleção.",
      },
    ],
  }),
  component: TodosProdutosPage,
});

function TodosProdutosPage() {
  const { q, categoria, colecao } = Route.useSearch();
  const navigate = Route.useNavigate();
  const products = useCatalog((s) => s.products);
  const [query, setQuery] = useState(q ?? "");

  useEffect(() => {
    if (!useCatalog.getState().hidratado) {
      useCatalog.getState().hydrate();
    }
  }, []);

  // debounce da busca -> URL
  useEffect(() => {
    const t = setTimeout(() => {
      navigate({
        search: (prev: { q?: string; categoria?: string; colecao?: string }) => ({
          ...prev,
          q: query || undefined,
        }),
        replace: true,
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query, navigate]);

  const ativos = useMemo(
    () =>
      products.filter(
        (p) => p.ativo !== false && p.precoAtacado && p.precoAtacado > 0,
      ),
    [products],
  );

  const categorias = useMemo(
    () => Array.from(new Set(ativos.map((p) => p.categoria))).sort(),
    [ativos],
  );

  const colecoes = useMemo(
    () =>
      Array.from(
        new Set(
          ativos
            .filter((p) => !categoria || p.categoria === categoria)
            .map((p) => p.colecao),
        ),
      ).sort(),
    [ativos, categoria],
  );

  const filtered = useMemo(() => {
    const term = (q ?? "").trim().toLowerCase();
    const list = ativos.filter((p) => {
      if (categoria && p.categoria !== categoria) return false;
      if (colecao && p.colecao !== colecao) return false;
      if (!term) return true;
      const hay = [
        p.sku,
        p.codCadastro,
        p.ean,
        p.nomeComercial,
        p.nomeCompleto,
        p.colecao,
        p.corNome,
        p.cor,
        p.grupo,
        p.tipo,
        p.categoria,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
    // Ordenar: categoria → coleção → cor → número/sku
    return list.sort((a, b) => {
      const c = a.categoria.localeCompare(b.categoria, "pt-BR");
      if (c) return c;
      const col = a.colecao.localeCompare(b.colecao, "pt-BR");
      if (col) return col;
      const cor = (a.corNome ?? "").localeCompare(b.corNome ?? "", "pt-BR");
      if (cor) return cor;
      const na = a.numeroVela ?? null;
      const nb = b.numeroVela ?? null;
      if (na !== null && nb !== null) return na - nb;
      return a.sku.localeCompare(b.sku, "pt-BR");
    });
  }, [ativos, q, categoria, colecao]);

  // Agrupar por categoria → coleção
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, Product[]>>();
    for (const p of filtered) {
      if (!map.has(p.categoria)) map.set(p.categoria, new Map());
      const cats = map.get(p.categoria)!;
      if (!cats.has(p.colecao)) cats.set(p.colecao, []);
      cats.get(p.colecao)!.push(p);
    }
    return map;
  }, [filtered]);

  type S = { q?: string; categoria?: string; colecao?: string };
  const setCategoria = (v: string) =>
    navigate({
      search: (prev: S) => ({
        ...prev,
        categoria: v || undefined,
        colecao: undefined,
      }),
      replace: true,
    });
  const setColecao = (v: string) =>
    navigate({
      search: (prev: S) => ({ ...prev, colecao: v || undefined }),
      replace: true,
    });
  const limpar = () => {
    setQuery("");
    navigate({ search: {}, replace: true });
  };

  const hasFilter = !!(q || categoria || colecao);

  return (
    <main className="px-3 py-4 sm:px-6 sm:py-8 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-muted hover:text-gold transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Catálogo
        </Link>
        <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">
          Todos os produtos
        </div>
      </div>

      <header className="mb-5">
        <h1 className="font-display text-3xl sm:text-4xl">Todos os produtos</h1>
        <p className="text-text-secondary text-sm mt-1">
          {filtered.length} de {ativos.length}{" "}
          {ativos.length === 1 ? "produto" : "produtos"}
        </p>
      </header>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, SKU, código, EAN, coleção…"
            className="w-full rounded-md gold-border bg-surface pl-9 pr-9 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-gold"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={categoria ?? ""}
          onChange={(e) => setCategoria(e.target.value)}
          className="rounded-md gold-border bg-surface px-3 py-2 text-sm min-w-[180px]"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={colecao ?? ""}
          onChange={(e) => setColecao(e.target.value)}
          className="rounded-md gold-border bg-surface px-3 py-2 text-sm min-w-[180px]"
        >
          <option value="">Todas as coleções</option>
          {colecoes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {hasFilter && (
          <button
            onClick={limpar}
            className="rounded-md gold-border px-3 py-2 text-[11px] uppercase tracking-wider text-gold hover:bg-gold/10 transition"
          >
            Limpar
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">
          Nenhum produto encontrado.
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([cat, cols]) => (
            <section key={cat} className="space-y-4">
              <div className="border-b border-border pb-1.5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">
                  Categoria
                </div>
                <h2 className="font-display text-xl">{cat}</h2>
              </div>
              {Array.from(cols.entries()).map(([col, items]) => (
                <div key={col} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base text-text-primary">
                      {col}{" "}
                      <span className="text-text-muted text-xs font-sans">
                        · {items.length}
                      </span>
                    </h3>
                    <Link
                      to="/catalog"
                      search={{ colecao: col, categoria: cat }}
                      className="text-[10px] uppercase tracking-wider text-gold hover:underline"
                    >
                      Ver coleção →
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {items.map((p) => (
                      <div id={`sku-${p.sku}`} key={p.sku}>
                        <ProductCard product={p} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
