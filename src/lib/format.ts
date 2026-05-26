export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function nearestMultiple(value: number, mult: number): number {
  if (mult <= 1) return Math.max(0, Math.round(value));
  return Math.max(mult, Math.round(value / mult) * mult);
}

export function isValidMultiple(value: number, mult: number): boolean {
  if (mult <= 1) return value >= 0 && Number.isInteger(value);
  return value % mult === 0;
}
