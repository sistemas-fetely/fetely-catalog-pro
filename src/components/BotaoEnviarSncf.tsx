import { Send, Loader2, Check, AlertTriangle, X } from "lucide-react";
import { useEnviarParaSncf } from "@/hooks/useEnviarParaSncf";

function formatData(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mo} ${hh}h${mm}`;
}

const BASE =
  "flex items-center justify-center rounded-md border w-8 h-8 transition";

export function BotaoEnviarSncf({ orderId }: { orderId: string }) {
  const { status, estagio, erro, enviadoEm, enviar, isEnviando } = useEnviarParaSncf(orderId);

  if (status === "pendente") {
    return (
      <button
        disabled
        title="Enviando..."
        className={`${BASE} border-gold/40 text-gold opacity-60`}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </button>
    );
  }

  if (status === "enviado") {
    const quando = enviadoEm ? formatData(enviadoEm) : "";
    const onde = estagio ?? "";
    return (
      <button
        disabled
        title={`Enviado em ${quando}${onde ? ` • em ${onde}` : ""}`}
        className={`${BASE} border-green-500/40 text-green-500`}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
    );
  }

  if (status === "erro_persistente") {
    return (
      <button
        onClick={() => enviar()}
        title={`Falhou: ${erro ?? "erro"} (clique pra tentar de novo)`}
        className={`${BASE} border-amber-500/40 text-amber-500 hover:bg-amber-500/10`}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
      </button>
    );
  }

  if (status === "rejeitado") {
    return (
      <button
        disabled
        title={`Rejeitado: ${erro ?? "erro"}`}
        className={`${BASE} border-red-500/40 text-red-500`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <button
      onClick={() => enviar()}
      title="Enviar pra SNCF"
      className={`${BASE} gold-border text-gold hover:bg-gold/10`}
    >
      <Send className="h-3.5 w-3.5" />
    </button>
  );
}
