import { Send, Loader2, Check, AlertTriangle, X } from "lucide-react";
import { useEnviarParaSncf } from "@/hooks/useEnviarParaSncf";

function formatData(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `hoje ${hh}h${mm}`;
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mo} ${hh}h${mm}`;
}

function truncate(s: string, max = 40): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

const BASE =
  "flex items-center gap-2 rounded-md px-4 py-2 text-xs uppercase tracking-wider transition";

export function BotaoEnviarSncf({ orderId }: { orderId: string }) {
  const { status, estagio, erro, enviadoEm, enviar } = useEnviarParaSncf(orderId);

  if (status === "pendente") {
    return (
      <button disabled className={`${BASE} gold-border text-gold opacity-60`}>
        <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
      </button>
    );
  }

  if (status === "enviado") {
    const quando = enviadoEm ? formatData(enviadoEm) : "";
    const onde = estagio ?? "";
    return (
      <button
        disabled
        className={`${BASE} border border-green-500/40 text-green-500`}
      >
        <Check className="h-4 w-4" /> Enviado {quando}
        {onde ? ` • em ${onde}` : ""}
      </button>
    );
  }

  if (status === "erro_persistente") {
    return (
      <button
        onClick={() => enviar()}
        className={`${BASE} border border-amber-500/40 text-amber-500 hover:bg-amber-500/10`}
      >
        <AlertTriangle className="h-4 w-4" /> Falhou • tentar de novo
      </button>
    );
  }

  if (status === "rejeitado") {
    return (
      <button
        disabled
        className={`${BASE} border border-red-500/40 text-red-500`}
      >
        <X className="h-4 w-4" /> Rejeitado: {truncate(erro ?? "erro", 40)}
      </button>
    );
  }

  // nao_enviado
  return (
    <button
      onClick={() => enviar()}
      className={`${BASE} gold-border text-gold hover:bg-gold/10`}
    >
      <Send className="h-4 w-4" /> Enviar pra SNCF
    </button>
  );
}
