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
  if (value % mult === 0) return true;
  // permite meia caixa (ex: 6 un. para multiplos de 12)
  if (mult % 2 === 0 && value % (mult / 2) === 0) return true;
  return false;
}
