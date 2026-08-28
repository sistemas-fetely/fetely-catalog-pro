import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { halfBox, isValidMultiple, nearestMultiple } from "@/lib/format";
import { cn } from "@/lib/utils";

interface QuantityInputProps {
  value: number;
  onChange: (v: number) => void;
  multiplos: number;
  compact?: boolean;
  disabled?: boolean;
}

export function QuantityInput({ value, onChange, multiplos, compact, disabled }: QuantityInputProps) {
  const [focused, setFocused] = useState(false);
  const valid = value === 0 || isValidMultiple(value, multiplos);
  const step = Math.max(1, halfBox(multiplos));

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex items-stretch rounded-md border bg-surface-2",
          valid ? "border-border" : "border-stock-out/60",
          focused && "ring-1 ring-gold border-gold",
          compact ? "h-8" : "h-10",
        )}
      >
        <button
          type="button"
          disabled={disabled || value <= 0}
          onClick={() => onChange(value - step < step ? 0 : value - step)}
          className="px-2 text-text-secondary hover:text-gold disabled:opacity-30"
          aria-label="Diminuir"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          min={0}
          disabled={disabled}
          value={value === 0 ? "" : value}
          placeholder="0"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const v = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
            if (!Number.isNaN(v)) onChange(Math.max(0, v));
          }}
          className={cn(
            "flex-1 min-w-0 bg-transparent text-center font-medium outline-none",
            compact ? "text-sm" : "text-base",
          )}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(value <= 0 ? step : value + step)}
          className="px-2 text-text-secondary hover:text-gold disabled:opacity-30"
          aria-label="Aumentar"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {!valid && value > 0 && (
        <button
          type="button"
          onClick={() => onChange(nearestMultiple(value, multiplos))}
          className="text-[10px] text-stock-pre hover:text-gold underline underline-offset-2"
        >
          Ajustar para {nearestMultiple(value, multiplos)} un.
        </button>
      )}
    </div>
  );
}
