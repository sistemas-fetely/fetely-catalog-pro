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
  /** Quantidade disponível em estoque para venda firme. em_estoque = estoqueDisponivel > 0 */
  estoqueDisponivel?: number;
  /** V?? — Produto de pronta entrega: sempre disponível, roteia direto para pedido (sem gate de quantidade). */
  prontaEntrega?: boolean;

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
  /** V21 — Negociação por item: preço unitário manual (override). undefined = usa product.precoAtacado */
  precoOverride?: number;
  /** V21 — Negociação por item: desconto extra por linha em %, 0–100 */
  descontoItemPct?: number;
  /** V21 — Justificativa obrigatória quando há precoOverride ou descontoItemPct */
  justificativaNegociacao?: string;
}

export interface OrderMeta {
  cliente: string;
  cnpj: string;
  condicaoPagamento: string;
  /** Observações internas Fetély — NUNCA exibido para o cliente */
  observacoes: string;
  /** Observações do cliente — aparece no pedido, PDF impresso e email do cliente */
  observacoesCliente?: string;
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
  // V22: quando o carrinho está sendo usado para editar uma provisão existente
  provisaoEditandoId?: string;
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
  /** V15 — valor de frete efetivamente cobrado (0 quando CIF/isento) */
  freteValor?: number;
  /** V15 — percentual usado no cálculo do frete (referência) */
  fretePercent?: number;
  /** V15 — true quando frete não foi cobrado (CIF ou negociação grátis) */
  freteIsento?: boolean;
  /** V20 — UF usada no cálculo do frete (snapshot do momento do pedido) */
  freteUf?: string;
  /** V20 — origem da regra de frete aplicada */
  freteOrigem?: "negociacao_master" | "premissa_cliente" | "faixa";
  /** V20 — true quando a UF não tinha tabela cadastrada (usou fallback) */
  freteUsouFallback?: boolean;
  /** V21 — valor do acréscimo por cliente isento de Inscrição Estadual */
  acrescimoIsentoIEValor?: number;
  /** V21 — percentual do acréscimo de isento de IE aplicado */
  acrescimoIsentoIEPercent?: number;
  /** V21 — true quando o acréscimo de isento de IE foi aplicado neste pedido */
  acrescimoIsentoIEAplicado?: boolean;

  /** Pedido bonificado — bypass do valor mínimo, sem meta/pace/comissão */
  bonificado?: boolean;
  /** Motivo da bonificação (amostra, brinde, compensacao, marketing, outro:texto) */
  motivoBonificacao?: string;
}

export type StatusPedido =
  | "pendente_aprovacao"
  | "aprovado"
  | "recusado"
  | "confirmado"
  | "convertido"
  | "cancelado";

export type OrigemPerfilPedido = "vendedor" | "admin" | "master" | "cliente";

export interface PedidoHistoricoEvento {
  em: string;
  acao:
    | "criado"
    | "enviado_para_analise"
    | "aprovado"
    | "recusado"
    | "ajuste_solicitado"
    | "reenviado"
    | "cancelado";
  porId?: string | null;
  porNome?: string | null;
  obs?: string | null;
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
  // V16 — Aprovação de pedidos do portal do cliente
  origemPerfil?: OrigemPerfilPedido;
  statusPedido?: StatusPedido;
  aprovadoPorId?: string | null;
  aprovadoPorNome?: string | null;
  aprovadoEm?: string | null;
  aprovacaoObs?: string | null;
  recusadoPorId?: string | null;
  recusadoPorNome?: string | null;
  recusadoMotivoTexto?: string | null;
  recusadoObs?: string | null;
  recusadoEmAprovacao?: string | null;
  temSolicitacaoAjuste?: boolean;
  ajusteMensagem?: string | null;
  historico?: PedidoHistoricoEvento[];
  // V19 — Rastreabilidade de duplicação
  sncfPedidoId?: string | null;
  duplicadoDe?: string | null;
  modeloOrigemId?: string | null;
  grupoOrigemId?: string | null;
  // Pedido bonificado (amostra/brinde/marketing/compensação/outro)
  bonificado?: boolean;
  motivoBonificacao?: string | null;
  estadoLiberacao?: "aguardando_liberacao" | "enviado_sncf" | null;
}


