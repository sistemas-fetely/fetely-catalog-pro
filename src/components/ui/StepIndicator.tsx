import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  key: string;
  label: string;
  value?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
}

export function StepIndicator({ steps, currentIndex, onStepClick }: StepIndicatorProps) {
  return (
    <ol className="relative space-y-5">
      <span
        aria-hidden
        className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-gold/60 via-gold/20 to-transparent"
      />
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const clickable = onStepClick && i <= currentIndex;

        return (
          <li key={step.key} className="relative pl-8">
            <span
              className={cn(
                "absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold",
                done && "border-gold bg-gold text-background",
                active && "border-gold bg-background text-gold",
                !done && !active && "border-border bg-surface text-text-muted",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(i)}
              className={cn(
                "block text-left",
                clickable && "cursor-pointer hover:text-gold-light",
              )}
            >
              <div
                className={cn(
                  "text-[10px] uppercase tracking-[0.18em]",
                  active ? "text-gold" : "text-text-muted",
                )}
              >
                Etapa {i + 1}
              </div>
              <div
                className={cn(
                  "font-display text-lg leading-tight",
                  active ? "text-text-primary" : done ? "text-text-secondary" : "text-text-muted",
                )}
              >
                {step.label}
              </div>
              {step.value && (
                <div className="text-xs text-text-secondary italic mt-0.5">{step.value}</div>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
