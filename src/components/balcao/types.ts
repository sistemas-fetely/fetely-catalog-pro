// Existing SNCF bridge contracts shared by the B2C form and order list.
import type { MeioPagamentoB2c } from "@/lib/balcaoPagamento";
export type BalcaoCliente = {
  id: string; nome: string; cpf: string | null; telefone: string | null; email: string | null;
  cep: string | null; logradouro: string | null; numero: string | null; complemento: string | null;
  bairro: string | null; cidade: string | null; uf: string | null;
};
export type BalcaoProduto = {
  sku: string; cod_cadastro: string | null; ean: string | null; nome: string; preco_varejo: number;
  disponivel_site_sp?: number; disponivel?: number; disponivel_sc?: number; centro?: string; colecao: string | null; cor_nome: string | null;
};
export type CdInfo = { codigo: string; rotulo: string; padrao: boolean; balcao?: boolean };
export const CD_PADRAO: CdInfo = { codigo: "SITE-SP", rotulo: "Site SP", padrao: true };
export const saldoDo = (p: BalcaoProduto) => p.disponivel ?? p.disponivel_site_sp ?? 0;
export const saldoScDo = (p: BalcaoProduto) => p.disponivel_sc ?? 0;
export const CD_SITE_SP = CD_PADRAO.codigo;
// SNCF decides availability: the XPM SC balance only counts as an alternative while the sale leaves Site SP.
export const saldoScVale = (centro: string) => centro === CD_SITE_SP;
export const cobreEmAlgumCd = (p: BalcaoProduto, qtd: number) => saldoDo(p) >= qtd || saldoScDo(p) >= qtd;
export type SeloSaldo = { rotulo: string; classe: string };
const SELO_OK = "border-success/40 bg-success/10 text-success";
const SELO_SC = "border-info/40 bg-info/10 text-info";
const SELO_AVISO = "border-warning/50 bg-warning/10 text-warning";
// Stock never blocks the sale (SNCF rule: the system suggests, the human decides) — this only labels it.
export function seloSaldoB2c(p: BalcaoProduto, qtd: number, centro: string, rotuloCd: string): SeloSaldo {
  if (!saldoScVale(centro)) {
    return saldoDo(p) >= qtd ? { rotulo: `${rotuloCd}: ${saldoDo(p)} disp.`, classe: SELO_OK } : { rotulo: `Sem saldo no ${rotuloCd}`, classe: SELO_AVISO };
  }
  if (saldoDo(p) >= qtd) return { rotulo: `SP: ${saldoDo(p)} disp.`, classe: SELO_OK };
  if (saldoScDo(p) >= qtd) return { rotulo: `Sem saldo em SP — SC cobre (${saldoScDo(p)})`, classe: SELO_SC };
  return { rotulo: "Sem saldo em SP e SC", classe: SELO_AVISO };
}
export const linhaSaldoBusca = (p: BalcaoProduto, centro: string, rotuloCd: string) =>
  saldoScVale(centro) ? `SP: ${saldoDo(p)} · SC: ${saldoScDo(p)} disp.` : `${rotuloCd}: ${saldoDo(p)} disp.`;
export type Item = BalcaoProduto & { quantidade: number };
export type ModoEntrega = "retirada" | "sedex" | "pac" | "frete_fetely" | "balcao" | "transportadora";
export type OpcaoTransportadora = { transportadora_id: string; nome: string; valor: number; prazo_dias: number | null };
export type CotacaoTransportadora = { ok: boolean; peso_usado?: number; opcoes: OpcaoTransportadora[]; recomendada?: string | OpcaoTransportadora | null; erro?: string };
export type OpcaoEntrega = {
  modo: ModoEntrega; ok: boolean; valor_itens: number; desconto_pedido: number; frete_cobrado: number;
  valor_total: number; prazo_dias: number | null; gratis: boolean; fonte: string | null;
  avisos: { sku?: string; aviso: string }[]; erro?: string;
};
export type Cotacao = { cotacao_id: string; valida_ate: string; correios_erro: string | null; opcoes: OpcaoEntrega[] };
export type BeneficioNivel = { tipo: "nenhum" | "pct" | "valor" | "gratis"; valor?: number; motivo: string };
export type Beneficio = { frete: BeneficioNivel; pedido: BeneficioNivel };
export type MeioPagamento = MeioPagamentoB2c;
export type PedidoCriado = {
  pedido_id: string; id_externo: string; valor_total: number; link_pagamento: string | null;
  pix_copia_cola?: string | null; link_erro?: string | null; endereco_gravado_no_cadastro?: boolean;
  avisos?: { sku?: string; aviso: string }[];
};
export type PagamentoDeclarado = { ok: true; id_externo: string; meio: string; estagio: string };
export type PedidoDetalhe = {
  pedido: {
    id: string; id_externo: string; estagio: string | null; situacao: string | null;
    valor_bruto: number; valor_frete: number; valor_liquido: number; frete_tipo: string | null; modal: string | null;
    endereco_entrega: Record<string, unknown> | null;
    itens: { sku: string; descricao: string; quantidade: number; valor_unitario: number }[];
    observacao: string | null; pagamento: MeioPagamento | "sem_pagamento"; link_pagamento: string | null;
    pagamento_confirmado_em: string | null; nf_numero: string | null; vendedor_nome: string | null; cancelado_em: string | null;
  };
  cliente: BalcaoCliente;
  permissoes: { eh_dono: boolean; editar_itens: boolean; trocar_meio: boolean; editar_cliente: boolean; motivo_bloqueio: string | null };
};
export const FORM_VAZIO = {
  nome: "", cpf: "", telefone: "", email: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
};
export type ClienteForm = typeof FORM_VAZIO;