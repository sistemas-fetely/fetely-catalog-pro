// Lookup de CNPJ via BrasilAPI (pública, sem chave).
// Docs: https://brasilapi.com.br/docs#tag/CNPJ

export interface CnpjData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  telefone: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  situacao: string;
}

export function onlyDigits(v: string): string {
  return (v || "").replace(/\D/g, "");
}

export function formatCNPJ(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function isValidCNPJLength(v: string): boolean {
  return onlyDigits(v).length === 14;
}

export async function fetchCNPJ(cnpj: string): Promise<CnpjData> {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) throw new Error("CNPJ inválido");

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("CNPJ não encontrado");
    throw new Error("Erro ao consultar CNPJ");
  }
  const j = await res.json();
  const telefone = [j.ddd_telefone_1, j.ddd_telefone_2].filter(Boolean).join(" / ");
  return {
    cnpj: formatCNPJ(digits),
    razaoSocial: j.razao_social ?? "",
    nomeFantasia: j.nome_fantasia ?? "",
    email: j.email ?? "",
    telefone,
    logradouro: j.logradouro ?? "",
    numero: j.numero ?? "",
    complemento: j.complemento ?? "",
    bairro: j.bairro ?? "",
    municipio: j.municipio ?? "",
    uf: j.uf ?? "",
    cep: j.cep ?? "",
    situacao: j.descricao_situacao_cadastral ?? "",
  };
}
