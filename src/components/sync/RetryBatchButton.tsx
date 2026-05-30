import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MAX_BATCH = 20;
const DELAY_MS = 200;

export function RetryBatchButton({
  selectedIds,
  onComplete,
}: {
  selectedIds: Set<string>;
  onComplete: () => void;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const qc = useQueryClient();

  const count = selectedIds.size;
  const overLimit = count > MAX_BATCH;
  const canFire = count > 0 && !isRunning && !overLimit;

  const run = async () => {
    if (!canFire) return;
    setIsRunning(true);
    const ids = Array.from(selectedIds);
    let sucesso = 0;
    const falhas: { id: string; msg: string }[] = [];
    setProgress({ done: 0, total: ids.length });

    for (let i = 0; i < ids.length; i++) {
      const orderId = ids[i];
      try {
        const { data, error } = await supabase.functions.invoke("enviar-para-sncf", {
          body: { order_id: orderId },
        });
        const payload = data as { ok?: boolean; error?: string } | null;
        if (error || payload?.ok !== true) {
          const msg = error?.message ?? payload?.error ?? "Erro desconhecido";
          falhas.push({ id: orderId, msg });
        } else {
          sucesso++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro de rede";
        falhas.push({ id: orderId, msg });
      }
      setProgress({ done: i + 1, total: ids.length });
      if (i < ids.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    setIsRunning(false);
    setProgress({ done: 0, total: 0 });
    qc.invalidateQueries({ queryKey: ["sync-management"] });
    onComplete();

    if (falhas.length === 0) {
      toast.success(
        `${sucesso} pedido${sucesso > 1 ? "s" : ""} reenviado${sucesso > 1 ? "s" : ""} com sucesso`,
      );
    } else if (sucesso === 0) {
      toast.error(
        `Falhou em todos os ${falhas.length} pedidos. Veja erros nas linhas após recarregar.`,
      );
    } else {
      toast(
        `${sucesso} sucesso · ${falhas.length} falhou. Itens com erro continuam visíveis pra retentar.`,
      );
    }
  };

  if (count === 0) {
    return (
      <button
        type="button"
        disabled
        className="rounded-md border border-border bg-surface px-4 py-2 text-xs text-text-secondary cursor-not-allowed"
      >
        Selecione pedidos pra retentar
      </button>
    );
  }

  if (overLimit) {
    return (
      <button
        type="button"
        disabled
        className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-500 cursor-not-allowed"
      >
        Selecionou {count} · Máximo {MAX_BATCH} por vez
      </button>
    );
  }

  if (isRunning) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-xs text-gold cursor-wait"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Retentando {progress.done}/{progress.total}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={run}
      className="inline-flex items-center gap-2 rounded-md border border-gold bg-gold/15 px-4 py-2 text-xs uppercase tracking-wider text-gold hover:bg-gold/25"
    >
      <Send className="h-3.5 w-3.5" />
      Retentar selecionados ({count})
    </button>
  );
}
