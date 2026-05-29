import { X } from "lucide-react";
import { formatBRL } from "@/lib/format";

export interface FinalConfirmData {
  firmeCount: number;
  firmeTotal: number;
  faixaNome?: string;
  condicaoDescricao?: string;
  frete?: "FOB" | "CIF";
  provisaoCount: number;
  provisaoTotal: number;
  proximaPrevisao?: string;
}

export function FinalConfirmModal({
  data,
  onConfirm,
  onCancel,
}: {
  data: FinalConfirmData;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-lg gold-border bg-surface p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl">Confirmação final</h3>
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-text-secondary">
          Seu carrinho será dividido em dois registros distintos:
        </p>

        {data.firmeCount > 0 && (
          <div className="rounded-md border border-stock-in/40 bg-stock-in/5 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stock-in font-semibold">
              📦 Pedido firme — será gerado agora
            </div>
            <div className="mt-2 text-sm text-text-primary">
              {data.firmeCount} {data.firmeCount === 1 ? "item" : "itens"}
              {data.faixaNome ? ` · Faixa ${data.faixaNome}` : ""}
            </div>
            <div className="font-display text-2xl text-gold mt-1">
              {formatBRL(data.firmeTotal)}
            </div>
            <div className="text-[11px] text-text-muted mt-1">
              {data.condicaoDescricao ?? "—"}
              {data.frete ? ` · ${data.frete}` : ""}
            </div>
          </div>
        )}

        {data.provisaoCount > 0 && (
          <div className="rounded-md border border-stock-pre/40 bg-stock-pre/5 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stock-pre font-semibold">
              📋 Provisão futura — será salva como rascunho
            </div>
            <div className="mt-2 text-sm text-text-primary">
              {data.provisaoCount} {data.provisaoCount === 1 ? "item" : "itens"}
              {data.proximaPrevisao ? ` · Prev. ${data.proximaPrevisao}` : ""}
            </div>
            <div className="text-sm text-stock-pre mt-1">
              Ref: {formatBRL(data.provisaoTotal)}
            </div>
            <div className="text-[11px] text-text-muted mt-1">
              Você será notificado quando o estoque liberar.
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-border py-2.5 text-xs uppercase tracking-wider text-text-secondary hover:text-text-primary hover:border-gold/40"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-md bg-gold py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-background hover:bg-gold-light"
          >
            Confirmar ambos →
          </button>
        </div>
      </div>
    </div>
  );
}
