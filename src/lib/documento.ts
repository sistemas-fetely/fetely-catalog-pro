// Documentos de pessoa física + busca de endereço por CEP (ViaCEP).

export function digits(v: string): string {
  return (v || "").replace(/\D/g, "");
}

export function formatCPF(v: string): string {
  const d = digits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** Validação do dígito verificador do CPF. */
export function isValidCPF(v: string): boolean {
  const d = digits(v);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function formatCEP(v: string): string {
  const d = digits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export interface CepData {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

/** Busca endereço no ViaCEP. Lança erro com mensagem clara em caso de falha. */
export async function fetchCEP(cep: string): Promise<CepData> {
  const d = digits(cep);
  if (d.length !== 8) throw new Error("CEP deve ter 8 dígitos.");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: ctrl.signal });
    if (!res.ok) throw new Error("Não foi possível consultar o CEP agora.");
    const j = (await res.json()) as Record<string, unknown>;
    if (j.erro) throw new Error("CEP não encontrado. Preencha o endereço manualmente.");
    return {
      cep: formatCEP(d),
      logradouro: String(j.logradouro ?? ""),
      bairro: String(j.bairro ?? ""),
      cidade: String(j.localidade ?? ""),
      uf: String(j.uf ?? "").toUpperCase(),
    };
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("Não foi possível consultar o CEP agora.");
  } finally {
    clearTimeout(t);
  }
}
