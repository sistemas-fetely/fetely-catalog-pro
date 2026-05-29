import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ChevronRight, X } from "lucide-react";
import { CatalogSidebar } from "@/components/layout/CatalogSidebar";
import { ProductCard } from "@/components/catalog/ProductCard";
import { NumericalCandleGrid } from "@/components/catalog/NumericalCandleGrid";
import { CollectionBulkFiller } from "@/components/catalog/CollectionBulkFiller";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import {
  useCatalog,
  getProductsBy,
  isNumericCollection,
} from "@/store/catalogStore";
import { useUI } from "@/store/uiStore";
import { usePhotos, getColecaoPhoto, getProdutoPhoto } from "@/store/photoStore";
import { useAuth } from "@/store/authStore";
import type { Product } from "@/types";

const searchSchema = z.object({
  colecao: fallback(z.string(), "").optional(),
  grupo: fallback(z.string(), "").optional(),
  categoria: fallback(z.string(), "").optional(),
  highlight: fallback(z.string(), "").optional(),
});

export const Route = createFileRoute("/catalog")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Catálogo — Fetély B2B" },
      { name: "description", content: "Navegue pelo catálogo Fetély por coleção." },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const { colecao, grupo, highlight } = Route.useSearch();
  const products = useCatalog((s) => s.products);
  const photos = usePhotos();
  const setGroupExpanded = useUI((s) => s.setGroupExpanded);
  const isPublic = !useAuth((s) => s.session);
  const fadeRef = useRef<HTMLDivElement>(null);

  const colecaoProducts = useMemo(
    () => (colecao ? getProductsBy(products, colecao, grupo || undefined) : []),
    [products, colecao, grupo],
  );

  const meta = useMemo(() => {
    if (!colecao || colecaoProducts.length === 0) return null;
    const first = colecaoProducts[0];
    return { categoria: first.categoria, grupo: first.grupo };
  }, [colecao, colecaoProducts]);

  // Expand the group containing the active collection
  useEffect(() => {
    if (meta) setGroupExpanded(`${meta.categoria}::${meta.grupo}`, true);
  }, [meta, setGroupExpanded]);

  // Fade-in transition on collection change
  useEffect(() => {
    if (!fadeRef.current) return;
    const el = fadeRef.current;
    el.style.opacity = "0";
    const t = setTimeout(() => {
      el.style.opacity = "1";
    }, 20);
    return () => clearTimeout(t);
  }, [colecao]);

  // Scroll to highlighted product
  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`sku-${highlight}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-gold");
        setTimeout(() => el.classList.remove("ring-2", "ring-gold"), 2200);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [highlight, colecao]);

  const isNum = colecao ? isNumericCollection(colecao) : false;
  const [activeColor, setActiveColor] = useState<string | undefined>(undefined);

  // Reset selected color when collection changes
  useEffect(() => {
    setActiveColor(undefined);
  }, [colecao]);

  const handleColorChange = useCallback((c: string) => setActiveColor(c), []);

  const colorPhoto = colecao && activeColor ? getProdutoPhoto(photos, colecao, activeColor) : undefined;
  const heroPhoto = colorPhoto ?? (colecao ? getColecaoPhoto(photos, colecao) : undefined);

  return (
    <div className="flex">
      <div className="hidden lg:block">
        <CatalogSidebar />
      </div>
      <main className="flex-1 min-w-0">
        <div
          ref={fadeRef}
          style={{ transition: "opacity 150ms ease-out" }}
          className="px-3 py-4 sm:px-6 sm:py-8 max-w-[1200px] mx-auto"
        >
          {!colecao ? (
            <EmptyState />
          ) : (
            <>
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-wider text-text-muted mb-3 sm:mb-4 overflow-x-auto whitespace-nowrap scrollbar-thin pb-1">
                {meta && (
                  <>
                    <span>{meta.categoria}</span>
                    <ChevronRight className="h-3 w-3 shrink-0" />
                    <span>{meta.grupo}</span>
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  </>
                )}
                <span className="text-gold">{colecao}</span>
              </nav>

              {/* Hero */}
              <header className="rounded-xl overflow-hidden gold-border mb-6 sm:mb-8 relative aspect-[16/7] sm:aspect-[16/5] md:aspect-[16/4] bg-surface-2">
                {heroPhoto ? (
                  <img
                    key={heroPhoto}
                    src={heroPhoto}
                    alt={activeColor ? `${colecao} — ${activeColor}` : colecao}
                    className={`h-full w-full ${colorPhoto ? "object-contain" : "object-cover"} animate-[fadeIn_0.4s_ease-out]`}
                  />
                ) : (
                  <PhotoPlaceholder
                    colecao={colecao}
                    className="h-full w-full"
                    showIcon={false}
                  />
                )}
                
                <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-6 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.3em] text-gold">
                      Coleção
                    </div>
                    <h1 className="font-display text-2xl sm:text-4xl md:text-5xl mt-1 leading-tight truncate">{colecao}</h1>
                    {isNum && (
                      <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-text-secondary mt-1">
                        Vela Numérica · Grade 0–9
                        {activeColor && (
                          <span className="ml-2 text-gold">· {activeColor}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <Link
                    to="/photos"
                    search={{ tab: "colecao", colecao }}
                    className="hidden md:inline-flex items-center gap-2 rounded-md gold-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-gold hover:bg-gold/10 transition shrink-0"
                  >
                    Gerenciar fotos
                  </Link>
                </div>
              </header>

              {/* Products */}
              {isNum ? (
                <NumericalCandleGrid
                  products={colecaoProducts}
                  colecao={colecao}
                  onColorChange={handleColorChange}
                />
              ) : (
                <>
                  {meta?.categoria === "Celebrar à Mesa" && (
                    <CollectionBulkFiller products={colecaoProducts} />
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {colecaoProducts.map((p) => (
                      <div id={`sku-${p.sku}`} key={p.sku} className="rounded-lg transition">
                        <ProductCard product={p} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  const products = useCatalog((s) => s.products);
  const photos = usePhotos();
  const { categoria, grupo } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { categorias, gruposByCategoria, collections } = useMemo(() => {
    const cats = new Set<string>();
    const grp: Record<string, Set<string>> = {};
    const colMap = new Map<
      string,
      { colecao: string; categoria: string; grupo: string; count: number; sample: Product }
    >();
    for (const p of products) {
      if (!p.precoAtacado || p.precoAtacado <= 0) continue;
      cats.add(p.categoria);
      if (!grp[p.categoria]) grp[p.categoria] = new Set();
      grp[p.categoria].add(p.grupo);
      const existing = colMap.get(p.colecao);
      if (existing) existing.count += 1;
      else
        colMap.set(p.colecao, {
          colecao: p.colecao,
          categoria: p.categoria,
          grupo: p.grupo,
          count: 1,
          sample: p,
        });
    }
    return {
      categorias: Array.from(cats).sort((a, b) => a.localeCompare(b, "pt-BR")),
      gruposByCategoria: grp,
      collections: Array.from(colMap.values()).sort((a, b) =>
        a.colecao.localeCompare(b.colecao, "pt-BR"),
      ),
    };
  }, [products]);

  const gruposDisponiveis = useMemo(() => {
    if (!categoria) return [] as string[];
    return Array.from(gruposByCategoria[categoria] ?? []).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [categoria, gruposByCategoria]);

  const filtered = useMemo(() => {
    return collections.filter((c) => {
      if (categoria && c.categoria !== categoria) return false;
      if (grupo && c.grupo !== grupo) return false;
      return true;
    });
  }, [collections, categoria, grupo]);

  type SearchT = { colecao?: string; grupo?: string; categoria?: string; highlight?: string };
  const setCategoria = (c: string | undefined) =>
    navigate({
      search: (prev: SearchT) => ({ ...prev, categoria: c || undefined, grupo: undefined }),
    });
  const setGrupo = (g: string | undefined) =>
    navigate({ search: (prev: SearchT) => ({ ...prev, grupo: g || undefined }) });

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">
          Catálogo Fetély
        </div>
        <h1 className="font-display text-4xl md:text-5xl mt-1">Todas as Coleções</h1>
        <p className="text-text-secondary mt-2 text-sm max-w-2xl">
          Explore {collections.length} coleções. Use os filtros abaixo ou o menu
          lateral para refinar.
        </p>
      </header>

      {/* Filters */}
      <div className="rounded-lg gold-border bg-surface/60 p-4 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted mb-2">
            Categoria
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={!categoria}
              onClick={() => setCategoria(undefined)}
              label="Todas"
            />
            {categorias.map((c) => (
              <FilterChip
                key={c}
                active={categoria === c}
                onClick={() => setCategoria(c)}
                label={c}
              />
            ))}
          </div>
        </div>

        {categoria && gruposDisponiveis.length > 1 && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted mb-2">
              Grupo
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={!grupo}
                onClick={() => setGrupo(undefined)}
                label="Todos"
              />
              {gruposDisponiveis.map((g) => (
                <FilterChip
                  key={g}
                  active={grupo === g}
                  onClick={() => setGrupo(g)}
                  label={g}
                />
              ))}
            </div>
          </div>
        )}

        {(categoria || grupo) && (
          <button
            onClick={() =>
              navigate({
                search: (prev: SearchT) => ({
                  ...prev,
                  categoria: undefined,
                  grupo: undefined,
                }),
              })
            }
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-text-muted hover:text-gold transition"
          >
            <X className="h-3 w-3" /> Limpar filtros
          </button>
        )}
      </div>

      {/* Results */}
      <div className="text-[11px] uppercase tracking-wider text-text-muted">
        {filtered.length} {filtered.length === 1 ? "coleção" : "coleções"}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">
          Nenhuma coleção encontrada com os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((c) => {
            const img = getColecaoPhoto(photos, c.colecao);
            return (
              <Link
                key={c.colecao}
                to="/catalog"
                search={{ colecao: c.colecao }}
                className="group rounded-lg overflow-hidden gold-border gold-border-hover bg-surface transition"
              >
                <div className="relative aspect-square overflow-hidden">
                  {img ? (
                    <img
                      src={img}
                      alt={c.colecao}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <PhotoPlaceholder
                      colecao={c.colecao}
                      className="h-full w-full"
                    />
                  )}
                  
                  <div className="absolute top-2 left-2 rounded-full bg-background/80 backdrop-blur px-2 py-0.5 text-[9px] uppercase tracking-wider text-gold">
                    {c.categoria}
                  </div>
                </div>
                <div className="p-3">
                  <div className="font-display text-lg leading-tight">
                    {c.colecao}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-[10px] uppercase tracking-wider text-text-muted">
                      {c.grupo}
                    </div>
                    <div className="text-[10px] text-text-secondary">
                      {c.count} {c.count === 1 ? "item" : "itens"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-gold mt-2 opacity-0 group-hover:opacity-100 transition">
                    Ver coleção <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[11px] uppercase tracking-wider transition border ${
        active
          ? "bg-gold text-background border-gold"
          : "border-border text-text-secondary hover:text-text-primary hover:border-gold/60"
      }`}
    >
      {label}
    </button>
  );
}
