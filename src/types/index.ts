export interface Product {
  // Identificação
  sku: string;
  codCadastro: string;
  ean: string;

  // Marca / Hierarquia
  marca: string;
  linha: string;
  categoria: string;
  departamento?: string;
  grupo: string;
  tipo: string;
  familia: string;
  colecao: string;
  subColecao?: string;
  subColecao2?: string;

  // Atributos visuais
  corNome: string;
  cor: string;
  estampa: string;
  tamanhoNumero: string;
  tamanhoRef: string;

  // Nomes / descrições
  nomeComercial: string;
  nomeCompleto?: string;
  metaDescricao?: string;
  descricaoColecao?: string;
  descricaoProduto?: string;

  // Fiscal
  ncm?: string;
  cest?: string;
  origemFisc?: string;
  origemProd?: string;

  // Embalagem / material
  tipoEmbalagem?: string;
  material: string;
  materialDescritivo?: string;

  // Dimensões
  pesoG: number;
  larguraCm: number;
  alturaCm: number;
  profundidadeCm?: number;

  // Comercial
  multiplos: number;
  qtdKit: number;
  precoVarejo: number;
  precoAtacado: number;
  statusEstoque: string;

  // Vela numérica
  isVelaNumerica: boolean;
  numeroVela?: number | null;
}

export interface CartItem {
  sku: string;
  product: Product;
  quantity: number;
}

export interface OrderMeta {
  cliente: string;
  cnpj: string;
  condicaoPagamento: string;
  observacoes: string;
  vendedor: string;
}

export interface SavedOrder {
  id: string;
  createdAt: string;
  items: CartItem[];
  meta: OrderMeta;
  total: number;
}
