import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClientes } from "@/store/clienteStore";

interface SolicitacaoRow {
  id: string;
  cnpj: string;
  razao_social: string | null;
  solicitante_nome: string | null;
  owner_anterior_nome: string | null;
  justificativa: string | null;
  criado_em: string;
}

/** Painel admin: aprova/recusa migração de CNPJ entre carteiras de representantes. */
export function MigracoesCarteiraPanel() {
  const [rows, setRows] = useState<SolicitacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const hydrate = useClientes((s) => s.hydrate);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cliente_migracao_solicitacoes" as never)
      .select("id, cnpj, razao_social, solicitante_nome, owner_anterior_nome, justificativa, criado_em")
      .eq("status", "pendente")
      .order("criado_em", { ascending: true });
    if (error) console.error("[migracoes] load falhou", error);
    setRows((data ?? []) as unknown as SolicitacaoRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolver = async (id: string, aprovar: boolean) => {
    setBusyId(id);
    try {
      const { error } = await supabase.rpc("resolver_migracao_cliente" as never, {
        p_id: id,
        p_aprovar: aprovar,
      } as never);
      if (error) throw error;
      toast.success(aprovar ? "Cliente migrado de carteira." : "Solicitação recusada.");
      await load();
      if (aprovar) await hydrate();
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível resolver a solicitação.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-text-muted p-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando solicitações...
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-md gold-border bg-surface-2 p-4 space-y-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-gold">
        <ArrowRightLeft className="h-3.5 w-3.5" /> Migrações de carteira pendentes ({rows.length})
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-surface px-3 py-2"
          >
            <div className="min-w-0">
              <div className="text-sm text-text-primary truncate">
                {r.razao_social ?? "—"} · {r.cnpj}
              </div>
              <div className="text-[11px] text-text-secondary">
                {r.owner_anterior_nome ?? "—"} → {r.solicitante_nome ?? "—"}
              </div>
              {r.justificativa && (
                <div className="text-[11px] text-text-muted italic">"{r.justificativa}"</div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => resolver(r.id, true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-gold text-background text-[11px] font-semibold uppercase tracking-wider hover:bg-gold-light disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" /> Aprovar
              </button>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => resolver(r.id, false)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-border text-[11px] uppercase tracking-wider text-text-secondary hover:text-text-primary disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" /> Recusar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
