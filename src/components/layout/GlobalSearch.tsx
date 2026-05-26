import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useCatalog } from "@/store/catalogStore";
import { usePhotos, getProdutoPhoto } from "@/store/photoStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import { formatBRL } from "@/lib/format";

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const products = useCatalog((s) => s.products);
  const photos = usePhotos();
  const navigate = useNavigate();

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    return products
      .filter(
        (p) =>
          p.nomeComercial.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          p.colecao.toLowerCase().includes(term),
      )
      .slice(0, 10);
  }, [q, products]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative flex-1 max-w-md">
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 focus-within:border-gold/60 transition">
        <Search className="h-4 w-4 text-text-muted" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar produto, SKU ou coleção…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"
        />
        {q && (
          <button
            onClick={() => {
              setQ("");
              setOpen(false);
            }}
            className="text-text-muted hover:text-text-primary"
            aria-label="Limpar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-40 rounded-md gold-border bg-surface-2 shadow-2xl overflow-hidden">
          {results.map((p) => {
            const img = getProdutoPhoto(photos, p.colecao, p.corNome);
            return (
              <button
                key={p.sku}
                onClick={() => {
                  navigate({
                    to: "/catalog",
                    search: { colecao: p.colecao, highlight: p.sku },
                  });
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface transition"
              >
                {img ? (
                  <img
                    src={img}
                    alt=""
                    className="h-10 w-10 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <PhotoPlaceholder
                    colecao={p.colecao}
                    label={p.corNome}
                    showIcon={false}
                    className="h-10 w-10 rounded flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">
                    {p.nomeComercial}
                  </div>
                  <div className="text-[10px] text-text-muted truncate">
                    {p.colecao} · {p.corNome}
                  </div>
                </div>
                <div className="text-xs text-gold font-medium whitespace-nowrap">
                  {p.precoAtacado > 0 ? formatBRL(p.precoAtacado) : "—"}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {open && q.trim().length >= 2 && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-40 rounded-md gold-border bg-surface-2 px-4 py-3 text-xs text-text-muted">
          Nenhum produto encontrado.
        </div>
      )}
    </div>
  );
}
