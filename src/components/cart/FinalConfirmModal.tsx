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
  onConfirmPedido,
  onSalvarCotacao,
  onCancel,
  loading,
}: {
  data: FinalConfirmData;
  onConfirmPedido: () => void;
  onSalvarCotacao: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-lg gold-border bg-surface p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl">Confirmar como…</h3>
          <button
            onClick={onCancel}
            className="text-text-muted hover:text-text-primary"
            aria-label="Fechar"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {data.firmeCount > 0 && (
          <div className="rounded-md border border-stock-in/40 bg-stock-in/5 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stock-in font-semibold">
              📦 Resumo do pedido
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
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={onSalvarCotacao}
            disabled={loading}
            className="flex flex-col items-start gap-1 rounded-md border-2 border-gold/60 bg-transparent px-4 py-3 text-left hover:bg-gold/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-sm font-semibold uppercase tracking-[0.12em] text-gold">
              📋 Salvar como Cotação
            </span>
            <span className="text-[11px] text-text-muted">
              Sem compromisso · válida 15 dias
            </span>
          </button>
          <button
            onClick={onConfirmPedido}
            disabled={loading}
            className="flex flex-col items-start gap-1 rounded-md bg-gold px-4 py-3 text-left hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-sm font-semibold uppercase tracking-[0.12em] text-background">
              ✦ Confirmar Pedido
            </span>
            <span className="text-[11px] text-background/70">
              Pedido firme faturável
            </span>
          </button>
        </div>

        <button
          onClick={onCancel}
          disabled={loading}
          className="w-full rounded-md border border-border py-2 text-[11px] uppercase tracking-wider text-text-secondary hover:text-text-primary disabled:opacity-40"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
