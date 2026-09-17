// Natureza da operação e CFOP de referência.
// Não calculamos imposto aqui — apenas registramos e expomos o dado.

export type NaturezaOperacao = "venda" | "remessa_brinde";

export const NATUREZA_LABEL: Record<NaturezaOperacao, string> = {
  venda: "Venda",
  remessa_brinde: "Remessa / Brinde (sem cobrança)",
};

/** UF de origem das saídas Fetély. */
export const UF_ORIGEM = "SP";

/**
 * CFOP de referência conforme natureza da operação e destino.
 * Venda: 5102 (dentro do estado) · 6102 (fora).
 * Remessa/brinde: 5910 (dentro) · 6910 (fora).
 */
export function cfopDe(
  natureza: NaturezaOperacao,
  ufDestino?: string | null,
  ufOrigem: string = UF_ORIGEM,
): string {
  const dentro = (ufDestino ?? "").toUpperCase() === ufOrigem.toUpperCase();
  if (natureza === "remessa_brinde") return dentro ? "5910" : "6910";
  return dentro ? "5102" : "6102";
}
