import { AlertTriangle, X, Send, Activity } from "lucide-react";
import type { SyncKpis } from "@/hooks/useSyncManagement";

export function SyncKpiCards({ kpis }: { kpis: SyncKpis }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
      <Card
        label="Não enviados"
        value={kpis.naoEnviados}
        tone="gold"
        icon={<Send className="h-3.5 w-3.5" />}
        hint="Aguardando envio pelo vendedor"
      />
      <Card
        label="Erros técnicos"
        value={kpis.errosPersistentes}
        tone="amber"
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        hint="SOps: investigar e retentar"
      />
      <Card
        label="Rejeitados"
        value={kpis.rejeitados}
        tone="red"
        icon={<X className="h-3.5 w-3.5" />}
        hint="Vendedor: cancelar e refazer"
      />
      <Card
        label="Taxa de sucesso"
        value={`${kpis.taxaSucesso7d}%`}
        tone="emerald"
        icon={<Activity className="h-3.5 w-3.5" />}
        hint="Sobre o resultset atual"
      />
    </div>
  );
}

function Card({
  label,
  value,
  tone,
  icon,
  hint,
}: {
  label: string;
  value: string | number;
  tone: "gold" | "amber" | "red" | "emerald";
  icon: React.ReactNode;
  hint: string;
}) {
  const toneClasses = {
    gold: "border-gold/40 text-gold",
    amber: "border-amber-500/40 text-amber-500",
    red: "border-red-500/40 text-red-500",
    emerald: "border-emerald-500/40 text-emerald-500",
  }[tone];
  return (
    <div className={`rounded-lg border ${toneClasses} bg-surface/40 px-4 py-3`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1.5 font-display text-3xl">{value}</div>
      <div className="text-[10px] text-text-secondary mt-0.5">{hint}</div>
    </div>
  );
}
