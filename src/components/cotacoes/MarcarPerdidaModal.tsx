import { useState } from "react";
import { X } from "lucide-react";
import type { MotivoPerdaCotacao } from "@/types/cotacao";
import { MOTIVO_PERDA_LABEL } from "@/types/cotacao";

const MOTIVOS: MotivoPerdaCotacao[] = [
  "preco",
  "concorrente",
  "sem_budget",
  "timing",
  "produto_indisponivel",
  "sem_retorno",
  "outro",
];

export function MarcarPerdidaModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (motivo: MotivoPerdaCotacao, obs: string) => void;
  onCancel: () => void;
}) {
  const [motivo, setMotivo] = useState<MotivoPerdaCotacao>("preco");
  const [obs, setObs] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-lg gold-border bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl">Motivo da perda</h3>
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          {MOTIVOS.map((m) => (
            <label
              key={m}
              className="flex items-center gap-2 text-sm text-text-primary cursor-pointer"
            >
              <input
                type="radio"
                name="motivo"
                value={m}
                checked={motivo === m}
                onChange={() => setMotivo(m)}
                className="accent-gold"
              />
              {MOTIVO_PERDA_LABEL[m]}
            </label>
          ))}
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted mb-1.5">
            Observação
          </div>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
            className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:border-gold resize-none"
            placeholder="Detalhes da perda..."
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-border py-2.5 text-xs uppercase tracking-wider text-text-secondary hover:text-text-primary"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(motivo, obs)}
            className="flex-1 rounded-md bg-stock-out py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-background hover:opacity-90"
          >
            Registrar perda
          </button>
        </div>
      </div>
    </div>
  );
}
