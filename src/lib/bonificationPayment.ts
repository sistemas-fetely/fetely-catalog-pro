type PaymentContext = { bonificado?: boolean; condicaoDescricao?: string };

export function isBonification(c?: PaymentContext | null): boolean {
  return c?.bonificado === true || c?.condicaoDescricao === "Pedido bonificado";
}

export function orderPayment(c: PaymentContext | undefined, current: string): string {
  return isBonification(c) ? "sem_pagamento" : current;
}

export function selectionAfterBonification<T>(wasBonified: boolean, bonified: boolean, selected: T | null): T | null {
  return wasBonified && !bonified ? null : selected;
}