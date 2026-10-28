import { cn } from "@/lib/utils";
import { colecaoLiberada } from "@/lib/classifyItem";

interface StockBadgeProps {
  status: string;
  /** Fatia 3: quando informado, mostra a quantidade disponível no rótulo "Em estoque · N". */
  estoqueDisponivel?: number;
  /** Selo visual, exibido somente com estoque positivo. */
  prontaEntrega?: boolean;
  /** Coleções liberadas sem estoque aparecem como Pronta Entrega. */
  colecao?: string;
  className?: string;
}

export function StockBadge({ status, estoqueDisponivel, prontaEntrega, colecao, className }: StockBadgeProps) {
  const s = (status || "").trim().toLowerCase();
  const disp = Number(estoqueDisponivel ?? 0);
  let color = "bg-muted text-text-muted";
  let label = "Consultar";

  if (colecaoLiberada(colecao) || (prontaEntrega && disp > 0)) {
    color = "bg-stock-in/15 text-stock-in border border-stock-in/30";
    label = "Pronta Entrega";
  } else if (disp > 0) {
    color = "bg-stock-in/15 text-stock-in border border-stock-in/30";
    label = `Em Estoque · ${disp}`;
  } else if (s.startsWith("prev")) {
    if (disp > 0) {
      color = "bg-stock-in/15 text-stock-in border border-stock-in/30";
      label = `Em Estoque · ${disp}`;
    } else {
      color = "bg-stock-pre/15 text-stock-pre border border-stock-pre/30";
      label = status;
    }
  } else {
    color = "bg-stock-out/15 text-stock-out border border-stock-out/30";
    label = "Esgotado";
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
