import { digits, isValidCPF } from "./documento";
import type { ClienteForm, ModoEntrega, OpcaoEntrega } from "../components/balcao/types";

export const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function cpfPrivado(cpf: string | null) {
  const d = digits(cpf ?? "");
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : "sem CPF";
}

// Only compare valid SNCF quotes; never calculate a commercial price locally.
export function modalidadesVisiveis(opcoes: OpcaoEntrega[]) {
  const sedex = opcoes.find(o => o.modo === "sedex" && o.ok);
  const pac = opcoes.find(o => o.modo === "pac" && o.ok);
  const domina = (a: OpcaoEntrega, b: OpcaoEntrega) =>
    a.prazo_dias != null && b.prazo_dias != null &&
    a.frete_cobrado <= b.frete_cobrado && a.prazo_dias <= b.prazo_dias &&
    (a.frete_cobrado < b.frete_cobrado || a.prazo_dias < b.prazo_dias);
  const oculto: ModoEntrega | null = sedex && pac ? domina(sedex, pac) ? "pac" : domina(pac, sedex) ? "sedex" : null : null;
  return { opcoes: opcoes.filter(o => o.modo !== oculto), oculto };
}

// The bridge has only observacao. Keep the expedition instruction at its start.
export function separarObservacao(valor: string) {
  if (!valor.startsWith("EXPEDIÇÃO: ")) return { expedicao: "", observacao: valor };
  const [primeira = "", ...resto] = valor.split("\n\n");
  return { expedicao: primeira.slice("EXPEDIÇÃO: ".length), observacao: resto.join("\n\n") };
}
export function juntarObservacao(expedicao: string, observacao: string) {
  return [expedicao.trim() ? `EXPEDIÇÃO: ${expedicao.trim()}` : "", observacao.trim()].filter(Boolean).join("\n\n");
}

export type Pendencia = { card: "cliente" | "itens" | "entrega" | "beneficio" | "pagamento" | "resumo"; campo?: string; mensagem: string };
export function pendenciaBasica(a: {
  clienteSelecionado: boolean; novoCliente: boolean; form: ClienteForm; cpf: string;
  itens: { quantidade: number }[]; modo: ModoEntrega; cotando: boolean; entregaDisponivel: boolean;
  motivoBeneficioOk: boolean; pagamento: string | null; bonificacaoOk: boolean;
  emailCartaoOk: boolean;
}): Pendencia | null {
  if (!a.clienteSelecionado && !a.novoCliente) return { card: "cliente", campo: "balcao-busca-cliente", mensagem: "Selecione ou cadastre um cliente" };
  if (a.novoCliente && a.form.nome.trim().length < 2) return { card: "cliente", campo: "balcao-cliente-nome", mensagem: "Informe o nome do cliente" };
  if (!isValidCPF(a.cpf)) return { card: "cliente", campo: "balcao-cliente-cpf", mensagem: digits(a.cpf).length ? "Informe um CPF válido" : "CPF obrigatório para a NF" };
  if (a.novoCliente && !digits(a.form.telefone)) return { card: "cliente", campo: "balcao-cliente-telefone", mensagem: "Informe o telefone/WhatsApp" };
  if (!a.itens.length) return { card: "itens", campo: "balcao-busca-produto", mensagem: "Adicione um item ao pedido" };
  if (a.itens.some(i => !Number.isInteger(i.quantidade) || i.quantidade <= 0)) return { card: "itens", mensagem: "Informe quantidades inteiras maiores que zero" };
  if (a.modo !== "retirada") {
    if (digits(a.form.cep).length !== 8) return { card: "entrega", campo: "balcao-entrega-cep", mensagem: "Informe o CEP de entrega" };
    for (const [campo, rotulo] of [["logradouro", "logradouro"], ["numero", "número"], ["bairro", "bairro"], ["cidade", "cidade"], ["uf", "UF"]] as const) {
      if (!a.form[campo].trim() || (campo === "uf" && a.form.uf.length !== 2)) return { card: "entrega", campo: `balcao-entrega-${campo}`, mensagem: `Informe ${rotulo} do endereço de entrega` };
    }
  }
  if (a.cotando) return { card: "entrega", mensagem: "Aguarde a cotação da entrega" };
  if (!a.entregaDisponivel) return { card: "entrega", mensagem: "A entrega precisa de uma cotação válida" };
  if (!a.motivoBeneficioOk) return { card: "beneficio", mensagem: "Informe o motivo de cada benefício (mín. 3 caracteres)" };
  if (!a.pagamento) return { card: "pagamento", mensagem: "Selecione o meio de pagamento" };
  if (!a.emailCartaoOk) return { card: "cliente", campo: "balcao-cliente-email", mensagem: "Informe o e-mail para o link do cartão" };
  if (a.pagamento === "bonificacao" && !a.bonificacaoOk) return { card: "pagamento", campo: "bonif-autorizado", mensagem: "Informe a autorização e o motivo da bonificação" };
  return null;
}