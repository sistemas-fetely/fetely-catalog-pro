export interface Product {
  sku: string;
  codCadastro: string;
  marca: string;
  linha: string;
  categoria: string;
  grupo: string;
  tipo: string;
  colecao: string;
  familia: string;
  corNome: string;
  cor: string;
  estampa: string;
  tamanhoNumero: string;
  tamanhoRef: string;
  nomeComercial: string;
  multiplos: number;
  qtdKit: number;
  precoVarejo: number;
  precoAtacado: number;
  statusEstoque: string;
  material: string;
  pesoG: number;
  larguraCm: number;
  alturaCm: number;
  ean: string;
  isVelaNumerica: boolean;
  numeroVela?: number;
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
