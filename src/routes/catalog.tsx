import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ChevronRight, X } from "lucide-react";
import { CatalogSidebar } from "@/components/layout/CatalogSidebar";
import { ProductCard } from "@/components/catalog/ProductCard";
import { NumericalCandleGrid } from "@/components/catalog/NumericalCandleGrid";
import { NumericalCandleShowcase } from "@/components/catalog/NumericalCandleShowcase";
import { CutleryGrid } from "@/components/catalog/CutleryGrid";
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
  const { colecao, grupo, categoria, highlight } = Route.useSearch();
  const products = useCatalog((s) => s.products);
  const photos = usePhotos();
  const setGroupExpanded = useUI((s) => s.setGroupExpanded);
  const isPublic = !useAuth((s) => s.session);
  const fadeRef = useRef<HTMLDivElement>(null);

  // Garante que visitantes públicos também recebam o catálogo do banco
  // (caso contrário cai no JSON default, que não inclui todas as coleções).
  useEffect(() => {
    if (!useCatalog.getState().hidratado) {
      useCatalog.getState().hydrate();
    }
  }, []);

  const colecaoProducts = useMemo(
    () =>
      colecao
        ? getProductsBy(products, colecao, grupo || undefined, categoria || undefined)
        : [],
    [products, colecao, grupo, categoria],
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
  const isCutlery = !!colecao && colecaoProducts.length > 0 && colecaoProducts.every((p) => p.grupo === "Talheres");
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
                  {!isPublic && (
                    <Link
                      to="/photos"
                      search={{ tab: "colecao", colecao }}
                      className="hidden md:inline-flex items-center gap-2 rounded-md gold-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-gold hover:bg-gold/10 transition shrink-0"
                    >
                      Gerenciar fotos
                    </Link>
                  )}
                </div>
              </header>

              {/* Products */}
              {isNum && !isPublic ? (
                <NumericalCandleGrid
                  products={colecaoProducts}
                  colecao={colecao}
                  onColorChange={handleColorChange}
                />
              ) : isCutlery && !isPublic ? (
                <CutleryGrid
                  products={colecaoProducts}
                  colecao={colecao}
                  onColorChange={handleColorChange}
                />
              ) : (
                <>
                  {!isPublic && meta?.categoria === "Celebrar à Mesa" && (
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
  const { categoria } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { collections, countByCategoria } = useMemo(() => {
    const colMap = new Map<
      string,
      { colecao: string; categoria: string; grupo: string; count: number; sample: Product }
    >();
    const catCount: Record<string, number> = {};
    for (const p of products) {
      if (!p.precoAtacado || p.precoAtacado <= 0) continue;
      catCount[p.categoria] = (catCount[p.categoria] ?? 0) + 1;
      const mapKey = `${p.categoria}::${p.colecao}`;
      const existing = colMap.get(mapKey);
      if (existing) existing.count += 1;
      else
        colMap.set(mapKey, {
          colecao: p.colecao,
          categoria: p.categoria,
          grupo: p.grupo,
          count: 1,
          sample: p,
        });
    }
    return {
      collections: Array.from(colMap.values()).sort((a, b) =>
        a.colecao.localeCompare(b.colecao, "pt-BR"),
      ),
      countByCategoria: catCount,
    };
  }, [products]);

  type SearchT = { colecao?: string; grupo?: string; categoria?: string; highlight?: string };
  const setCategoria = (c: string | undefined) =>
    navigate({
      search: (prev: SearchT) => ({ ...prev, categoria: c || undefined, grupo: undefined }),
    });

  // Etapa 1 — escolher categoria
  if (!categoria) {
    const CATS: { nome: string; descricao: string }[] = [
      {
        nome: "Celebrar à Mesa",
        descricao:
          "Coleções completas para mesa posta: jogos americanos, copos, taças e acessórios.",
      },
      {
        nome: "Luz e Momento",
        descricao:
          "Velas decorativas, numéricas e aromas para celebrações inesquecíveis.",
      },
    ];

    return (
      <div className="space-y-8">
        <header className="text-center max-w-2xl mx-auto pt-4 sm:pt-8">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">
            Catálogo Fetély
          </div>
          <h1 className="font-display text-4xl md:text-5xl mt-2">
            Por onde gostaria de começar?
          </h1>
          <p className="text-text-secondary mt-3 text-sm">
            Escolha uma categoria para descobrir as coleções disponíveis.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {CATS.map((c) => {
            const sampleCol = collections.find((x) => x.categoria === c.nome);
            const img = sampleCol ? getColecaoPhoto(photos, sampleCol.colecao) : undefined;
            const count = countByCategoria[c.nome] ?? 0;
            return (
              <button
                key={c.nome}
                onClick={() => setCategoria(c.nome)}
                className="group relative overflow-hidden rounded-xl gold-border gold-border-hover bg-surface text-left transition"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  {img ? (
                    <img
                      src={img}
                      alt={c.nome}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <PhotoPlaceholder colecao={c.nome} className="h-full w-full" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-gold">
                    Categoria
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl mt-1 leading-tight">
                    {c.nome}
                  </h2>
                  <p className="text-xs sm:text-sm text-text-secondary mt-2 max-w-md">
                    {c.descricao}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gold opacity-90 group-hover:opacity-100">
                    Explorar coleções <ChevronRight className="h-3.5 w-3.5" />
                    {count > 0 && (
                      <span className="ml-2 text-text-muted normal-case tracking-normal">
                        · {count} produtos
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Etapa 2 — listar coleções da categoria escolhida (sem filtros de grupo)
  const filtered = collections.filter((c) => c.categoria === categoria);

  return (
    <div className="space-y-6">
      <button
        onClick={() => setCategoria(undefined)}
        className="inline-flex items-center gap-2 rounded-lg gold-border px-4 py-2.5 text-[12px] uppercase tracking-wider text-gold bg-gold/5 hover:bg-gold/15 transition font-semibold shadow-sm"
      >
        <X className="h-4 w-4" /> Trocar categoria
      </button>

      <header>
        <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">
          Categoria
        </div>
        <h1 className="font-display text-4xl md:text-5xl mt-1">{categoria}</h1>
        <p className="text-text-secondary mt-2 text-sm">
          {filtered.length} {filtered.length === 1 ? "coleção disponível" : "coleções disponíveis"}.
        </p>
      </header>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">
          Nenhuma coleção encontrada nesta categoria.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((c) => {
            const img = getColecaoPhoto(photos, c.colecao);
            return (
              <Link
                key={`${c.categoria}::${c.colecao}`}
                to="/catalog"
                search={{ colecao: c.colecao, categoria: c.categoria }}
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
                    <PhotoPlaceholder colecao={c.colecao} className="h-full w-full" />
                  )}
                </div>
                <div className="p-3">
                  <div className="font-display text-lg leading-tight">{c.colecao}</div>
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

