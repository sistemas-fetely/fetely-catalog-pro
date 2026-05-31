import { useState } from "react";
import { XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ReprovarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entidade: string; // "pedido" | "provisão"
  identificador: string;
  onConfirm: (motivo: string) => Promise<void> | void;
}

export function ReprovarDialog({
  open,
  onOpenChange,
  entidade,
  identificador,
  onConfirm,
}: ReprovarDialogProps) {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (motivo.trim().length < 3) return;
    setLoading(true);
    try {
      await onConfirm(motivo.trim());
      setMotivo("");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!loading) {
          if (!o) setMotivo("");
          onOpenChange(o);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-stock-out">
            <XCircle className="h-5 w-5" /> Reprovar {entidade}
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono">{identificador}</span> será removida da
            operação. Informe o motivo da reprovação.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            placeholder="Ex.: cliente desistiu, dados incorretos, fora de política..."
            className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm resize-none focus:border-stock-out outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-md border border-border px-4 py-2 text-xs uppercase tracking-wider text-text-secondary hover:bg-surface-2 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || motivo.trim().length < 3}
              className="rounded-md bg-stock-out px-4 py-2 text-xs uppercase tracking-wider text-white hover:bg-stock-out/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Reprovando..." : "Confirmar reprovação"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
