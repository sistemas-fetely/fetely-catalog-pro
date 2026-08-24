import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { usePhotos, getProdutoPhoto } from "@/store/photoStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";

interface Props {
  colecao: string;
  colors: string[];
  active: string;
  onSelect: (c: string) => void;
  /** Tamanho do thumbnail em px (default 40). */
  size?: number;
}

export function ColorVariantChips({ colecao, colors, active, onSelect, size = 40 }: Props) {
  const photos = usePhotos();
  const [zoom, setZoom] = useState<{ src: string; label: string } | null>(null);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoom]);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => {
          const photo = getProdutoPhoto(photos, colecao, c);
          const isActive = c === active;
          return (
            <div
              key={c}
              className={`flex items-center gap-2 pl-1 pr-4 py-1 rounded-full text-xs uppercase tracking-wider border transition ${
                isActive
                  ? "bg-gold text-background border-gold"
                  : "border-border text-text-secondary hover:border-gold/60 hover:text-gold-light"
              }`}
            >
              {photo ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoom({ src: photo, label: c });
                  }}
                  className="flex-shrink-0 rounded-full overflow-hidden cursor-zoom-in ring-0 hover:ring-2 hover:ring-gold/60 transition"
                  style={{ height: size, width: size }}
                  aria-label={`Ampliar foto ${c}`}
                >
                  <img loading="lazy" decoding="async" src={photo} alt={c} className="h-full w-full object-cover" />
                </button>
              ) : (
                <PhotoPlaceholder
                  colecao={colecao}
                  label={c}
                  className="rounded-full flex-shrink-0"
                  showIcon={false}
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(c)}
                className="leading-none"
              >
                {c}
              </button>
            </div>
          );
        })}
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoom(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoom(null);
            }}
            className="absolute top-4 right-4 rounded-full bg-background/80 hover:bg-background p-2 text-text-primary transition"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={zoom.src}
            alt={zoom.label}
            className="max-h-[92vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center pointer-events-none px-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold">{colecao}</div>
            <div className="font-display text-xl text-text-primary mt-1">{zoom.label}</div>
          </div>
        </div>
      )}
    </>
  );
}
