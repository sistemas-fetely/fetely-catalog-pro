import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Download, Eye, Loader2, MessageCircle } from "lucide-react";
import {
  formatarTamanho,
  listarCatalogos,
  urlArquivo,
  type CatalogoPdf,
} from "@/lib/catalogosPdf";

export const Route = createFileRoute("/catalogos")({
  head: () => ({
    meta: [
      { title: "Catálogos Fetély — Coleções em PDF" },
      {
        name: "description",
        content:
          "Baixe ou visualize os catálogos em PDF das coleções Fetély: velas, mesa e decoração.",
      },
      { property: "og:title", content: "Catálogos Fetély — Coleções em PDF" },
      {
        property: "og:description",
        content:
          "Todos os catálogos das coleções Fetély reunidos para visualizar ou baixar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CatalogosPage,
});

function CatalogosPage() {
  const [itens, setItens] = useState<CatalogoPdf[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    listarCatalogos()
      .then((r) => vivo && setItens(r))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Erro"));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <header className="text-center mb-10">
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-gold">
          <BookOpen className="h-3 w-3" /> Fetély
        </div>
        <h1 className="font-display text-4xl mt-2">Nossos Catálogos</h1>
        <p className="text-sm text-text-secondary mt-2 max-w-xl mx-auto">
          Escolha uma coleção para visualizar no navegador ou baixar o PDF.
        </p>
      </header>

      {itens === null && !erro && (
        <div className="flex justify-center py-20 text-text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {erro && (
        <p className="text-center text-sm text-text-muted py-20">
          Não foi possível carregar os catálogos agora. Tente novamente em
          instantes.
        </p>
      )}

      {itens && itens.length === 0 && (
        <p className="text-center text-sm text-text-muted py-20">
          Nenhum catálogo publicado no momento.
        </p>
      )}

      {itens && itens.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((c) => (
            <article
              key={c.id}
              className="rounded-lg border border-border bg-surface overflow-hidden flex flex-col"
            >
              <div className="aspect-[3/4] bg-surface-2 flex items-center justify-center overflow-hidden">
                {c.capa_path ? (
                  <img
                    src={urlArquivo(c.capa_path)}
                    alt={`Capa do catálogo ${c.nome}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <BookOpen className="h-10 w-10 text-text-muted" />
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col gap-1">
                {c.colecao && (
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gold">
                    {c.colecao}
                  </div>
                )}
                <h2 className="font-display text-lg leading-tight">{c.nome}</h2>
                {c.descricao && (
                  <p className="text-xs text-text-secondary">{c.descricao}</p>
                )}
                <div className="text-[11px] text-text-muted mt-1">
                  PDF · {formatarTamanho(c.tamanho_bytes)}
                </div>
                <div className="mt-4 flex gap-2">
                  <a
                    href={urlArquivo(c.pdf_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-gold px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-background hover:bg-gold-light transition"
                  >
                    <Eye className="h-3.5 w-3.5" /> Visualizar
                  </a>
                  <a
                    href={urlArquivo(c.pdf_path, true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-[11px] uppercase tracking-wider text-text-secondary hover:bg-surface-2 transition"
                  >
                    <Download className="h-3.5 w-3.5" /> Baixar
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <a
        href={`https://wa.me/5511999924750?text=${encodeURIComponent(
          "Olá! Vi os catálogos no site e quero fazer compras no atacado.",
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-background shadow-lg hover:bg-gold-light transition"
        aria-label="Falar com a equipe comercial no WhatsApp"
      >
        <MessageCircle className="h-5 w-5" />
        Comprar no atacado
      </a>
    </main>
  );
}
