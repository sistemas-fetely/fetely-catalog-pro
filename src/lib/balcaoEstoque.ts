export type BalcaoEstoqueLinha = {
  sku: string;
  cod_cadastro: string | null;
  nome: string;
  colecao_codigo: string | null;
  colecao: string | null;
  disponivel: number;
  reservado: number;
  centro: string;
};

export type BalcaoEstoqueResposta = {
  ok: boolean;
  centro: string;
  linhas: BalcaoEstoqueLinha[];
};

export type OrdenacaoEstoque = {
  campo: "nome" | "colecao" | "disponivel";
  direcao: "asc" | "desc";
};

export function normalizarBuscaEstoque(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

export function chaveColecaoEstoque(linha: BalcaoEstoqueLinha) {
  if (linha.colecao_codigo) return `codigo:${linha.colecao_codigo}`;
  return linha.colecao?.trim() ? `nome:${normalizarBuscaEstoque(linha.colecao)}` : "sem-colecao";
}

export function colecoesEstoque(linhas: BalcaoEstoqueLinha[]) {
  const colecoes = new Map<string, { chave: string; nome: string; codigo: string; skus: Set<string> }>();
  for (const linha of linhas) {
    const chave = chaveColecaoEstoque(linha);
    const colecao = colecoes.get(chave) ?? {
      chave,
      nome: linha.colecao?.trim() || "Sem coleção",
      codigo: linha.colecao_codigo ?? "",
      skus: new Set<string>(),
    };
    colecao.skus.add(linha.sku);
    colecoes.set(chave, colecao);
  }
  return Array.from(colecoes.values())
    .map(({ skus, ...colecao }) => ({ ...colecao, quantidade: skus.size }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function filtrarEstoque(linhas: BalcaoEstoqueLinha[], busca: string, colecoes: string[]) {
  const termo = normalizarBuscaEstoque(busca);
  const selecionadas = new Set(colecoes);
  return linhas.filter((linha) => {
    if (selecionadas.size > 0 && !selecionadas.has(chaveColecaoEstoque(linha))) return false;
    return !termo || [linha.sku, linha.cod_cadastro ?? "", linha.nome]
      .some((valor) => normalizarBuscaEstoque(valor).includes(termo));
  });
}

export function ordenarEstoque(linhas: BalcaoEstoqueLinha[], ordem: OrdenacaoEstoque) {
  const fator = ordem.direcao === "asc" ? 1 : -1;
  return [...linhas].sort((a, b) => {
    const comparacao = ordem.campo === "disponivel"
      ? a.disponivel - b.disponivel
      : (a[ordem.campo] ?? "").localeCompare(b[ordem.campo] ?? "", "pt-BR");
    return comparacao * fator || a.nome.localeCompare(b.nome, "pt-BR") || a.sku.localeCompare(b.sku, "pt-BR");
  });
}

export function resumoEstoque(linhas: BalcaoEstoqueLinha[]) {
  return {
    skus: new Set(linhas.map((linha) => linha.sku)).size,
    unidades: linhas.reduce((total, linha) => total + linha.disponivel, 0),
  };
}