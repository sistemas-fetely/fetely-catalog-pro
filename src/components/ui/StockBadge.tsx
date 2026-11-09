import { cn } from "@/lib/utils";

interface StockBadgeProps {
  status: string;
  /** Fatia 3: quando informado, mostra a quantidade disponível no rótulo "Em estoque · N". */
  estoqueDisponivel?: number;
  /** Selo visual, exibido somente com estoque positivo. */
  prontaEntrega?: boolean;
  /** Jingle Pop volta a exibir seu estado real de estoque/previsão. */
  colecao?: string;
  className?: string;
}

export function StockBadge({ status, estoqueDisponivel = 0, colecao, className }: StockBadgeProps) {
  const jinglePop = colecao?.trim().toLocaleLowerCase("pt-BR") === "jingle pop";
  const emEstoque = !jinglePop || estoqueDisponivel > 0;
  const emPrevisao = jinglePop && !emEstoque && /^prev/i.test(status.trim());
  const color = emEstoque
    ? "bg-stock-in/15 text-stock-in border border-stock-in/30"
    : emPrevisao
      ? "bg-stock-pre/15 text-stock-pre border border-stock-pre/30"
      : "bg-stock-out/15 text-stock-out border border-stock-out/30";
  const label = emEstoque ? "Pronta Entrega" : emPrevisao ? status : "Esgotado";

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
