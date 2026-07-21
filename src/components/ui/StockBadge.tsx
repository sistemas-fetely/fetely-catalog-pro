import { cn } from "@/lib/utils";

interface StockBadgeProps {
  status: string;
  /** Fatia 3: quando informado, mostra a quantidade disponível no rótulo "Em estoque · N". */
  estoqueDisponivel?: number;
  className?: string;
}

export function StockBadge({ status, estoqueDisponivel, className }: StockBadgeProps) {
  const s = (status || "").trim().toLowerCase();
  const disp = Number(estoqueDisponivel ?? 0);
  let color = "bg-muted text-text-muted";
  let label = "Consultar";

  if (s === "em estoque") {
    color = "bg-stock-in/15 text-stock-in border border-stock-in/30";
    label = disp > 0 ? `Em Estoque · ${disp}` : "Em Estoque";
  } else if (s.startsWith("prev")) {
    // Se tem estoque numérico apesar da previsão, prioriza mostrar o firme disponível
    if (disp > 0) {
      color = "bg-stock-in/15 text-stock-in border border-stock-in/30";
      label = `Em Estoque · ${disp}`;
    } else {
      color = "bg-stock-pre/15 text-stock-pre border border-stock-pre/30";
      label = status;
    }
  } else if (s === "indisponivel" || s === "indisponível") {
    color = "bg-stock-out/15 text-stock-out border border-stock-out/30";
    label = "Indisponível";
  } else if (disp > 0) {
    color = "bg-stock-in/15 text-stock-in border border-stock-in/30";
    label = `Em Estoque · ${disp}`;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full font-medium",
        color,
        className,
      )}
    >
      {label}
    </span>
  );
}
