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

  // Gestão (V8)
  ativo?: boolean;
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
  nomeFantasia?: string;
  email?: string;
  telefone?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  situacao?: string;
  // Vínculo com cadastro de clientes (V6)
  clienteId?: string;
  clienteSnapshot?: import("./cliente").ClienteSnapshot;
  // V7: quando o carrinho vem de uma provisão convertida
  provisaoOrigemId?: string;
  // V15: quando o carrinho/pedido foi gerado a partir de uma cotação
  cotacaoOrigemId?: string;
  pedidoOrigem?: "direto" | "cotacao" | "provisao" | "portal_cliente";
}

export interface OrderCommercial {
  faixaId: number;
  faixaNome: string;
  frete: "FOB" | "CIF";
  condicaoId: number | null;
  condicaoDescricao: string;
  bruto: number;
  descontoCelebraPct: number;
  descontoCelebraValor: number;
  descontoMasterPct: number;
  descontoMasterValor: number;
  bonusPixValor: number;
  aplicouPix: boolean;
  totalFinal: number;
  totalSemPix: number;
  negociacao: boolean;
  justificativa: string;
  observacaoInterna: string;
  usouReservada: boolean;
  /** V13 — premissas comerciais homologadas foram aplicadas neste pedido */
  premissasAplicadas?: boolean;
}

export interface SavedOrder {
  id: string;
  createdAt: string;
  items: CartItem[];
  meta: OrderMeta;
  total: number;
  commercial?: OrderCommercial;
  // Dono do pedido (gravado uma única vez na criação, imutável)
  vendedorId?: string;
  vendedorNome?: string;
  vendedorLogin?: string;
  vendedorTipo?: "interno" | "representante" | null;
  // Reprovação (vendedor responsável pelo cliente ou admin/master)
  reprovado?: boolean;
  reprovadoEm?: string | null;
  reprovadoMotivo?: string | null;
  reprovadoPorId?: string | null;
  reprovadoPorNome?: string | null;
}

