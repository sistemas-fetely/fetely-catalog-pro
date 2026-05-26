import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resizeImage } from "@/lib/image";
import { Upload, Trash2, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subtitle?: string;
  current?: string;
  onSave: (dataUrl: string) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
}

export function PhotoUploadModal({
  open,
  onOpenChange,
  title,
  subtitle,
  current,
  onSave,
  onRemove,
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      const data = await resizeImage(file, 800);
      setPreview(data);
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = () => {
    setPreview(null);
    setBusy(false);
    setDrag(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const displayed = preview ?? current;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-surface gold-border text-text-primary">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          {subtitle && (
            <div className="text-xs text-text-secondary mt-1">{subtitle}</div>
          )}
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer aspect-[4/3] w-full rounded-md border-2 border-dashed transition flex items-center justify-center overflow-hidden ${
            drag ? "border-gold bg-gold/5" : "border-border bg-surface-2/40 hover:border-gold/60"
          }`}
        >
          {busy ? (
            <Loader2 className="h-8 w-8 text-gold animate-spin" />
          ) : displayed ? (
            <img src={displayed} alt="Pré-visualização" className="h-full w-full object-cover" />
          ) : (
            <div className="text-center px-6">
              <Upload className="h-8 w-8 text-gold mx-auto mb-2" />
              <div className="text-sm text-text-secondary">
                Arraste uma imagem ou clique para selecionar
              </div>
              <div className="text-[10px] text-text-muted mt-1">
                JPG, PNG · redimensionada para 800px / qualidade 80%
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <div>
            {current && onRemove && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onRemove();
                    reset();
                    onOpenChange(false);
                  } catch (e) {
                    console.error(e);
                    setBusy(false);
                  }
                }}
                className="inline-flex items-center gap-2 text-xs text-text-muted hover:text-destructive transition disabled:opacity-40"
              >
                <Trash2 className="h-3 w-3" /> Remover foto atual
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-xs uppercase tracking-wider text-text-secondary hover:text-text-primary transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!preview || busy}
              onClick={async () => {
                if (!preview) return;
                setBusy(true);
                try {
                  await onSave(preview);
                  reset();
                  onOpenChange(false);
                } catch (e) {
                  console.error(e);
                  setBusy(false);
                }
              }}
              className="rounded-md bg-gold px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-background hover:bg-gold-light transition disabled:opacity-30 inline-flex items-center gap-2"
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
              Salvar foto
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
