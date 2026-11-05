import { cn } from "@/lib/utils";

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

export function StockBadge({ className }: StockBadgeProps) {
  const color = "bg-stock-in/15 text-stock-in border border-stock-in/30";
  const label = "Pronta Entrega";

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
