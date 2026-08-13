export type SituacaoFiscal =
  | "contribuinte"
  | "isento"
  | "nao_contribuinte"
  | "pendente_saneamento";

/**
 * Espelha fn_situacao_fiscal_parceiro do SNCF, sem a tabela de formato por UF.
 * O SNCF é a autoridade e é mais estrito: onde ele diverge, ele cai em
 * pendente_saneamento, que também não cobra. A divergência nunca cobra a mais.
 */
export function situacaoFiscalCliente(args: {
  inscricaoEstadual?: string | null;
  isentoIE?: boolean | null;
}): SituacaoFiscal {
  const dig = (args.inscricaoEstadual ?? "").replace(/\D/g, "");
  const semIE = dig === "" || /^(.)*$/.test(dig); // vazio ou dígito repetido (000...)

  if (!semIE && dig.length >= 8 && dig.length <= 14) return "contribuinte";
  if (!semIE) return "pendente_saneamento"; // tem número, formato não fecha
  return args.isentoIE ? "isento" : "nao_contribuinte";
}

/** Só isento e não contribuinte pagam o acréscimo. Na dúvida não se cobra. */
export function deveAplicarAcrescimoIE(s: SituacaoFiscal): boolean {
  return s === "isento" || s === "nao_contribuinte";
}
