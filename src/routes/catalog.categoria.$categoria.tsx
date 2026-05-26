import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronRight, Folder } from "lucide-react";
import { CatalogSidebar } from "@/components/layout/CatalogSidebar";
import { useCatalog } from "@/store/catalogStore";
import { usePhotos, getColecaoPhoto } from "@/store/photoStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";

export const Route = createFileRoute("/catalog/categoria/$categoria")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.categoria} — Fetély B2B` },
      {
        name: "description",
        content: `Coleções da categoria ${params.categoria}.`,
      },
    ],
  }),
  component: CategoriaPage,
});

interface ColecaoEntry {
  colecao: string;
  grupo: string;
  count: number;
}

function CategoriaPage() {
  const { categoria } = Route.useParams();
  const products = useCatalog((s) => s.products);
  const photos = usePhotos();

  const groups = useMemo(() => {
    const map = new Map<string, Map<string, ColecaoEntry>>();
    for (const p of products) {
      if (p.categoria !== categoria) continue;
      if (!p.precoAtacado || p.precoAtacado <= 0) continue;
      if (!map.has(p.grupo)) map.set(p.grupo, new Map());
      const inner = map.get(p.grupo)!;
      const cur = inner.get(p.colecao);
      if (cur) cur.count += 1;
      else inner.set(p.colecao, { colecao: p.colecao, grupo: p.grupo, count: 1 });
    }
    return Array.from(map.entries())
      .map(([grupo, colMap]) => ({
        grupo,
        colecoes: Array.from(colMap.values()).sort((a, b) =>
          a.colecao.localeCompare(b.colecao, "pt-BR"),
        ),
      }))
      .sort((a, b) => a.grupo.localeCompare(b.grupo, "pt-BR"));
  }, [products, categoria]);

  const total = groups.reduce((s, g) => s + g.colecoes.length, 0);

  return (
    <div className="flex">
      <div className="hidden md:block">
        <CatalogSidebar />
      </div>
      <main className="flex-1 min-w-0">
        <div className="px-6 py-8 max-w-[1200px] mx-auto">
          <nav className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-text-muted mb-4">
            <Link to="/catalog" className="hover:text-gold transition">
              Catálogo
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-gold">{categoria}</span>
          </nav>

          <header className="mb-10">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted flex items-center gap-2">
              <Folder className="h-3 w-3" /> Categoria
            </div>
            <h1 className="font-display text-5xl md:text-6xl mt-2">{categoria}</h1>
            <p className="text-sm text-text-secondary mt-2">
              {groups.length} grupos · {total} coleções
            </p>
          </header>

          {groups.length === 0 ? (
            <div className="text-center py-16 text-text-muted text-sm">
              Nenhuma coleção disponível nesta categoria.
            </div>
          ) : (
            <div className="space-y-12">
              {groups.map(({ grupo, colecoes }) => (
                <section key={grupo}>
                  <div className="flex items-baseline justify-between border-b border-border pb-2 mb-5">
                    <h2 className="font-display text-2xl">{grupo}</h2>
                    <span className="text-[10px] uppercase tracking-wider text-text-muted">
                      {colecoes.length} {colecoes.length === 1 ? "coleção" : "coleções"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {colecoes.map((c) => {
                      const img = getColecaoPhoto(photos, c.colecao);
                      return (
                        <Link
                          key={c.colecao}
                          to="/catalog"
                          search={{ colecao: c.colecao, grupo: c.grupo }}
                          className="group rounded-lg overflow-hidden gold-border gold-border-hover bg-surface transition"
                        >
                          <div className="relative aspect-[4/3]">
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
                            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
                          </div>
                          <div className="p-3">
                            <div className="font-display text-lg leading-tight">
                              {c.colecao}
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-text-muted mt-1">
                              {c.count} {c.count === 1 ? "item" : "itens"}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
