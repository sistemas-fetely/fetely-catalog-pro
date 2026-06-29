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

  const tryFetch = async (url: string, timeoutMs = 8000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  };

  let lastErr: unknown = null;

  // 1) BrasilAPI
  try {
    const res = await tryFetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (res.status === 404) throw new Error("CNPJ não encontrado");
    if (res.ok) {
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
    lastErr = new Error(`BrasilAPI HTTP ${res.status}`);
  } catch (e) {
    if (e instanceof Error && e.message === "CNPJ não encontrado") throw e;
    lastErr = e;
  }

  // 2) Fallback: publica.cnpj.ws
  try {
    const res = await tryFetch(`https://publica.cnpj.ws/cnpj/${digits}`);
    if (res.status === 404) throw new Error("CNPJ não encontrado");
    if (res.ok) {
      const j: any = await res.json();
      const est = j.estabelecimento ?? {};
      const tel = est.ddd1 && est.telefone1 ? `(${est.ddd1}) ${est.telefone1}` : "";
      return {
        cnpj: formatCNPJ(digits),
        razaoSocial: j.razao_social ?? "",
        nomeFantasia: est.nome_fantasia ?? "",
        email: est.email ?? "",
        telefone: tel,
        logradouro: [est.tipo_logradouro, est.logradouro].filter(Boolean).join(" "),
        numero: est.numero ?? "",
        complemento: est.complemento ?? "",
        bairro: est.bairro ?? "",
        municipio: est.cidade?.nome ?? "",
        uf: est.estado?.sigla ?? "",
        cep: est.cep ?? "",
        situacao: est.situacao_cadastral ?? "",
      };
    }
    lastErr = new Error(`cnpj.ws HTTP ${res.status}`);
  } catch (e) {
    if (e instanceof Error && e.message === "CNPJ não encontrado") throw e;
    lastErr = e;
  }

  console.warn("[fetchCNPJ] todas as fontes falharam:", lastErr);
  throw new Error("Não foi possível consultar agora. Preencha os dados manualmente.");
}
