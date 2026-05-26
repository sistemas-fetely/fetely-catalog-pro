import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ChevronRight, Sparkles } from "lucide-react";
import { CatalogSidebar } from "@/components/layout/CatalogSidebar";
import { ProductCard } from "@/components/catalog/ProductCard";
import { NumericalCandleGrid } from "@/components/catalog/NumericalCandleGrid";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import {
  useCatalog,
  getProductsBy,
  isNumericCollection,
} from "@/store/catalogStore";
import { useUI } from "@/store/uiStore";
import { usePhotos, getColecaoPhoto } from "@/store/photoStore";

const searchSchema = z.object({
  colecao: fallback(z.string(), "").optional(),
  grupo: fallback(z.string(), "").optional(),
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
  const { colecao, highlight } = Route.useSearch();
  const products = useCatalog((s) => s.products);
  const photos = usePhotos();
  const setGroupExpanded = useUI((s) => s.setGroupExpanded);
  const fadeRef = useRef<HTMLDivElement>(null);

  const colecaoProducts = useMemo(
    () => (colecao ? getProductsBy(products, colecao) : []),
    [products, colecao],
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

  const heroPhoto = colecao ? getColecaoPhoto(photos, colecao) : undefined;
  const isNum = colecao ? isNumericCollection(colecao) : false;

  return (
    <div className="flex">
      <div className="hidden md:block">
        <CatalogSidebar />
      </div>
      <main className="flex-1 min-w-0">
        <div
          ref={fadeRef}
          style={{ transition: "opacity 150ms ease-out" }}
          className="px-6 py-8 max-w-[1200px] mx-auto"
        >
          {!colecao ? (
            <EmptyState />
          ) : (
            <>
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-text-muted mb-4">
                {meta && (
                  <>
                    <span>{meta.categoria}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{meta.grupo}</span>
                    <ChevronRight className="h-3 w-3" />
                  </>
                )}
                <span className="text-gold">{colecao}</span>
              </nav>

              {/* Hero */}
              <header className="rounded-xl overflow-hidden gold-border mb-8 relative aspect-[16/5] md:aspect-[16/4]">
                {heroPhoto ? (
                  <img
                    src={heroPhoto}
                    alt={colecao}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <PhotoPlaceholder
                    colecao={colecao}
                    className="h-full w-full"
                    showIcon={false}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-gold">
                      Coleção
                    </div>
                    <h1 className="font-display text-4xl md:text-5xl mt-1">{colecao}</h1>
                    {isNum && (
                      <div className="text-[11px] uppercase tracking-wider text-text-secondary mt-1">
                        Vela Numérica · Grade 0–9
                      </div>
                    )}
                  </div>
                  <Link
                    to="/photos"
                    search={{ tab: "colecao", colecao }}
                    className="hidden md:inline-flex items-center gap-2 rounded-md gold-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-gold hover:bg-gold/10 transition"
                  >
                    Gerenciar fotos
                  </Link>
                </div>
              </header>

              {/* Products */}
              {isNum ? (
                <NumericalCandleGrid products={colecaoProducts} colecao={colecao} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {colecaoProducts.map((p) => (
                    <div id={`sku-${p.sku}`} key={p.sku} className="rounded-lg transition">
                      <ProductCard product={p} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      <Sparkles className="h-10 w-10 text-gold mb-4" />
      <h1 className="font-display text-4xl">Escolha uma coleção</h1>
      <p className="text-text-secondary mt-2 max-w-md text-sm">
        Use o menu lateral para navegar pelas categorias, grupos e coleções da
        Fetély. Toda a estrutura do catálogo está disponível ali.
      </p>
    </div>
  );
}
