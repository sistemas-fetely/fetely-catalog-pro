import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/authStore";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureFlags, updateFeatureFlag } from "@/lib/featureFlags";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/gate-ab")({
  head: () => ({ meta: [{ title: "A/B — Gate de entrada · Fetély" }] }),
  component: GateAbPage,
});

interface AbRow {
  variante: string;
  sessoes: number;
  montaram: number;
  enviaram: number;
  valor_enviado: number;
  taxa_montagem: number;
  taxa_envio: number;
  conv_total: number;
}

function GateAbPage() {
  const roles = useAuth((s) => s.roles);
  const isAdmin = roles.includes("admin") || roles.includes("master");
  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-6">
      {isAdmin ? <GateAbContent /> : <div className="text-text-secondary">Sem permissão.</div>}
    </div>
  );
}

function GateAbContent() {
  const { flags, reload } = useFeatureFlags();
  const [rows, setRows] = useState<AbRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadMetrics() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("gate_ab_metrics").select("*");
      if (error) throw error;
      setRows((data ?? []) as AbRow[]);
    } catch (e) {
      console.warn("[gate-ab] load falhou", e);
      toast.error("Não foi possível carregar as métricas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMetrics();
  }, []);

  async function toggleGate() {
    setSaving(true);
    try {
      await updateFeatureFlag("GATE_ENTRADA_ATIVO", !flags.GATE_ENTRADA_ATIVO);
      reload();
      toast.success(`Gate ${!flags.GATE_ENTRADA_ATIVO ? "ativado" : "desativado"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao alterar flag");
    } finally {
      setSaving(false);
    }
  }

  const comGate = rows.find((r) => r.variante === "com_gate");
  const semGate = rows.find((r) => r.variante === "sem_gate");

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-3xl">A/B — Gate de entrada</h1>
        <p className="text-sm text-text-secondary">
          Compare a jornada dos clientes que passaram pelo gate (nome + WhatsApp) contra os que abriram o catálogo direto.
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 flex items-center gap-4">
          <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", flags.GATE_ENTRADA_ATIVO ? "bg-green-500/15 text-green-600" : "bg-muted text-text-muted")}>
            {flags.GATE_ENTRADA_ATIVO ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">
              Gate {flags.GATE_ENTRADA_ATIVO ? "ATIVO" : "DESLIGADO"}
            </div>
            <div className="text-xs text-text-secondary">
              {flags.GATE_ENTRADA_ATIVO
                ? "Clientes precisam informar nome + WhatsApp antes de ver o catálogo."
                : "Catálogo abre direto, sem identificação prévia."}
            </div>
          </div>
          <Button onClick={toggleGate} disabled={saving} variant={flags.GATE_ENTRADA_ATIVO ? "outline" : "default"}>
            {saving ? "Salvando…" : flags.GATE_ENTRADA_ATIVO ? "Desativar gate" : "Ativar gate"}
          </Button>
        </CardContent>
      </Card>

      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2 text-xs">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          Métricas dos <strong>últimos 14 dias</strong>. O A/B é observacional: "com_gate" agrupa sessões que se identificaram (naturalmente ou porque a flag estava ligada); "sem_gate" agrupa quem passou sem identificar. Alterne a flag por períodos para ler diferenças.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <VarianteCard titulo="Com gate" cor="border-gold/40 bg-gold/5" row={comGate} />
        <VarianteCard titulo="Sem gate" cor="border-border" row={semGate} />
      </div>

      {loading && <div className="text-xs text-text-secondary">Carregando…</div>}

      <details className="rounded-lg border border-border p-3 text-xs text-text-secondary">
        <summary className="cursor-pointer">Como interpretar</summary>
        <ul className="mt-2 space-y-1 list-disc pl-4">
          <li><strong>Sessões</strong>: entradas únicas na URL do catálogo (janela 14d).</li>
          <li><strong>Montaram wishlist</strong>: adicionaram ≥ 1 produto.</li>
          <li><strong>Enviaram</strong>: concluíram e enviaram a pré-seleção.</li>
          <li><strong>Taxa de montagem</strong>: sessão → montou. <strong>Taxa de envio</strong>: montou → enviou.</li>
        </ul>
      </details>
    </>
  );
}

function VarianteCard({ titulo, cor, row }: { titulo: string; cor: string; row?: AbRow }) {
  const empty = !row;
  return (
    <Card className={cn(cor)}>
      <CardContent className="p-4 space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-gold-muted">{titulo}</div>
        {empty ? (
          <div className="text-xs text-text-secondary">Sem sessões neste grupo ainda.</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Sessões" value={String(row!.sessoes)} />
              <Metric label="Montaram" value={String(row!.montaram)} />
              <Metric label="Enviaram" value={String(row!.enviaram)} />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
              <Metric label="Tx. montagem" value={`${row!.taxa_montagem}%`} />
              <Metric label="Tx. envio" value={`${row!.taxa_envio}%`} />
              <Metric label="Conv. total" value={`${row!.conv_total}%`} accent />
            </div>
            <div className="text-xs text-text-secondary pt-1 border-t border-border">
              Valor enviado: <span className="text-gold font-semibold">{formatBRL(row!.valor_enviado)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-text-secondary">{label}</div>
      <div className={cn("font-display text-lg", accent && "text-gold")}>{value}</div>
    </div>
  );
}
