import { COLLECTION_ACCENT } from "@/data/productConstants";
import { Camera } from "lucide-react";

interface Props {
  colecao: string;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export function PhotoPlaceholder({ colecao, label, className, showIcon = true }: Props) {
  const accent = COLLECTION_ACCENT[colecao] ?? "oklch(0.5 0 0)";
  const initial = (label ?? colecao).charAt(0).toUpperCase();
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className ?? ""}`}
      style={{
        background: `linear-gradient(135deg, ${accent} 0%, oklch(0.18 0 0) 100%)`,
      }}
    >
      <span className="font-display text-4xl text-text-primary/40">{initial}</span>
      {showIcon && (
        <span className="absolute bottom-1.5 right-1.5 inline-flex items-center justify-center rounded-full bg-background/70 p-1 text-gold">
          <Camera className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}
