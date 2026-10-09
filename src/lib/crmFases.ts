// CRM Parte 4 — fases do ritual do representante e regras calculadas (classe, nível, temperatura, prioridade, alertas).
// Tudo aqui é puro (sem acesso a dados) para ser testado e usado igual no card, na rodada e no kanban.
// Classe e nível também são calculados no banco (trigger crm_leads_calc) com as mesmas regras.

export type Fase = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "X";
export type Classe = "A" | "B" | "C";
export type Nivel = "Lead" | "MQL" | "SQL" | "CLIENTE" | "NUTRIÇÃO";
export type Temperatura = "Quente" | "Morno" | "Frio";
export type TaskTipo = "Ligar" | "Visitar" | "Enviar catálogo" | "Enviar amostra" | "Cobrar devolutiva" | "Cobrar cadastro" | "Cobrar pagamento" | "Ver gôndola" | "Outro";
export type TaskResp = "Representante" | "Gestão";
export type Segmento = "Supermercado" | "Hortifruti" | "Empório" | "Padaria e confeitaria" | "Loja de departamento" | "Festas" | "Casa & decoração" | "Papelaria e presentes" | "Buffet" | "Decoradora" | "Outro";
export type EmQuePe = "Pediu catálogo" | "Pediu preço" | "Quer amostra" | "Vai levar ao comitê" | "Só olhou";
export type MotivoNaoAgora = "Preço" | "Prazo" | "Sem retorno" | "Não é perfil" | "Já tem fornecedor" | "Migrado" | "Outro";

export const FASES_ABERTAS: Fase[] = ["0", "1", "2", "3", "4", "5"];
export const TRILHA: Fase[] = ["0", "1", "2", "3", "4", "5", "6"];
export const SEG_ALIMENTAR: Segmento[] = ["Supermercado", "Hortifruti", "Empório", "Padaria e confeitaria"];
export const SEG_ESPECIALIZADO: Segmento[] = ["Loja de departamento", "Festas", "Casa & decoração", "Papelaria e presentes", "Buffet", "Decoradora"];
export const SEGMENTOS: Segmento[] = [...SEG_ALIMENTAR, ...SEG_ESPECIALIZADO, "Outro"];
export const SEG_COM_REDE: Segmento[] = ["Supermercado", "Loja de departamento", "Hortifruti"];
export const CATEGORIAS = ["Velas", "Mesa posta", "Festa premium", "Infantil", "Presentes & embalagem"];
export const EM_QUE_PE: EmQuePe[] = ["Pediu catálogo", "Pediu preço", "Quer amostra", "Vai levar ao comitê", "Só olhou"];
export const MOTIVOS: MotivoNaoAgora[] = ["Preço", "Prazo", "Sem retorno", "Não é perfil", "Já tem fornecedor", "Outro"];
export const TASK_TIPOS: TaskTipo[] = ["Ligar", "Visitar", "Enviar catálogo", "Enviar amostra", "Cobrar devolutiva", "Cobrar cadastro", "Cobrar pagamento", "Ver gôndola", "Outro"];
export const DESCOBERTAS = ["Pediu preço", "Quer amostra", "Vai ao comitê", "Tem fornecedor", "Mudou o comprador", "Abriu loja nova", "Pertence a rede"];

/** Campos do lead usados pelas regras (subconjunto de crm_leads). */
export interface LeadRegras {
  cnpj: string | null; numero_lojas: number | null; faturamento_esperado_mes: number | null;
  segmento: string | null; em_que_pe_ficou: string | null; tier_a: boolean;
  visita_em: string | null; catalogo_enviado_em: string | null; toque_d2_feito: boolean;
  valor_estimado: number | null; comissao_registrada: boolean; pago_em: string | null; forma_pagamento: string | null;
  motivo_nao_agora: string | null; retomar_em: string | null; ultimo_toque_em: string | null; stage_desde: string;
  amostra: boolean; cadastro_fornecedor: boolean; cliente_id: string | null; sell_out_em: string | null;
}

export interface FaseInfo { fase: Fase; nome: string; repFaz: string; frase?: string; avanco?: string; prazo: number | null }

export const FASES: Record<Fase, FaseInfo> = {
  "0": { fase: "0", nome: "A agendar", prazo: 10, repFaz: "Combina dia e hora com a loja.", avanco: "Visita agendada",
    frase: "Oi [nome], aqui é [rep], represento a Fetély aqui na região. Passo na sua loja [dia] com o mostruário — são 20 minutos e você já vê o que combina com a sua vitrine. Pode ser?" },
  "1": { fase: "1", nome: "Visita marcada", prazo: null, repFaz: "Confirma na véspera.", avanco: "A visita aconteceu" },
  "2": { fase: "2", nome: "Visita feita", prazo: 1, repFaz: "Preenche a ficha de 6 campos logo depois da visita.", avanco: "Ficha completa",
    frase: "[nome], foi ótimo te conhecer. Já estou mandando o catálogo só das linhas que a gente conversou, com a condição na sua faixa. Te chamo quinta para a gente montar a primeira seleção." },
  "3": { fase: "3", nome: "Catálogo e condições", prazo: 7, repFaz: "Entrega o catálogo das categorias da loja e a condição da faixa; cobra devolutiva em 48h.", avanco: "Ela pediu preço, lista, amostra ou call",
    frase: "[nome], conseguiu dar uma olhada? Se quiser, eu já monto uma seleção de R$ [valor] com o que mais sai em [segmento] e você só ajusta o que não quiser." },
  "4": { fase: "4", nome: "Em negociação", prazo: 15, repFaz: "Monta a seleção com a loja; resolve amostra, cadastro ou comitê.", avanco: "Pedido confirmado",
    frase: "O que define a condição aqui é o valor do pedido, não tempo de casa. E nenhum boleto tem entrada: a primeira parcela vence com a mercadoria já exposta e vendendo." },
  "5": { fase: "5", nome: "Pedido e pagamento", prazo: 10, repFaz: "Acompanha o pagamento e avisa o prazo de entrega.", avanco: "Pagamento aprovado",
    frase: "[nome], pedido fechado até [data] chega a tempo de você expor antes do pico. Depois entra na fila de produção e eu não consigo garantir." },
  "6": { fase: "6", nome: "Pós-venda", prazo: null, repFaz: "Volta em até 30 dias para ver a gôndola e tirar foto.",
    frase: "[nome], passo aí [dia] para ver como ficou a gôndola. Se tiver girando, já deixo a reposição separada antes da próxima data." },
  X: { fase: "X", nome: "Não vai agora", prazo: null, repFaz: "Encerra sem insistir e diz quando vale voltar." },
};

export function addDias(iso: string, n: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dias(de: string, ate: string) {
  return Math.round((Date.UTC(+ate.slice(0, 4), +ate.slice(5, 7) - 1, +ate.slice(8, 10)) - Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10))) / 86400000);
}

export function calcClasse(lojas: number | null, fat: number | null, cnpj: string | null): Classe {
  if (!(cnpj ?? "").replace(/\D/g, "")) return "C";
  const l = lojas ?? 0, f = fat ?? 0;
  if (l >= 3 || f >= 5000) return "A";
  if (l >= 1 && l <= 2 && f >= 1500) return "B";
  return "C";
}
export const ESFORCO: Record<Classe, string> = {
  A: "Visita presencial, call agendada, acompanhamento da Débora ou da Cintia",
  B: "Visita quando estiver na rota, WhatsApp no resto",
  C: "Não gastar visita; link da loja online com cupom",
};

export function fichaCompleta(l: Pick<LeadRegras, "numero_lojas" | "segmento" | "faturamento_esperado_mes" | "em_que_pe_ficou">): boolean {
  return l.numero_lojas != null && !!l.segmento && l.faturamento_esperado_mes != null && !!l.em_que_pe_ficou;
}

export function calcNivel(fase: Fase | null, l: LeadRegras): Nivel | null {
  switch (fase) {
    case "0": case "1": return "Lead";
    case "2": return fichaCompleta(l) ? "MQL" : "Lead";
    case "3": return "MQL";
    case "4": return "SQL";
    case "5": return l.pago_em ? "CLIENTE" : "SQL";
    case "6": return "CLIENTE";
    case "X": return "NUTRIÇÃO";
    default: return null;
  }
}

export function temperatura(ultimoToque: string | null, hoje: string): Temperatura {
  if (!ultimoToque) return "Frio";
  const d = dias(ultimoToque, hoje);
  return d <= 7 ? "Quente" : d <= 21 ? "Morno" : "Frio";
}

export type Prioridade = "Prioridade" | "Cadência" | "Recompra" | "Nutrição" | null;
export function prioridadeDia(nivel: Nivel | null, l: LeadRegras, temp: Temperatura): Prioridade {
  if (nivel === "SQL") return "Prioridade";
  if (nivel === "MQL" && l.catalogo_enviado_em) return "Cadência";
  if (nivel === "CLIENTE") return "Recompra";
  if (temp === "Frio") return "Nutrição";
  return null;
}

/** Motivos do alerta vermelho. */
export function alertasLead(fase: Fase | null, l: LeadRegras, tarefaVence: string | null, hoje: string): string[] {
  if (!fase || fase === "X") return [];
  const m: string[] = [];
  if (tarefaVence && tarefaVence < hoje) m.push("tarefa vencida");
  if (fase === "6") return m;
  if (fase === "1") {
    if (l.visita_em && l.visita_em.slice(0, 10) < hoje) m.push("visita passou");
  } else {
    const p = FASES[fase].prazo;
    if (p != null && dias(l.stage_desde, hoje) > p && (fase !== "2" || fichaCompleta(l))) m.push(`${dias(l.stage_desde, hoje)}d na fase`);
  }
  if (fase === "2" && !fichaCompleta(l) && dias(l.stage_desde, hoje) >= 1) m.push("visita sem ficha há +24h");
  return m;
}

export function tags(l: LeadRegras, classe: Classe): string[] {
  const t = ["ORIGEM:REP", `CLASSE:${classe}`];
  if (l.catalogo_enviado_em) t.push("CATALOGO:ENVIADO");
  if (l.sell_out_em) t.push("CASE:SELL-OUT");
  return t;
}

/** O que falta para o botão de avanço da fase. Vazio = pode avançar. */
export function faltaParaAvancar(fase: Fase, l: LeadRegras, extra: { temPedido: boolean }): string[] {
  const f: string[] = [];
  switch (fase) {
    case "0": if (!l.visita_em) f.push("data e hora da visita"); break;
    case "2":
      if (l.numero_lojas == null) f.push("quantas lojas");
      if (!l.segmento) f.push("segmento");
      if (l.faturamento_esperado_mes == null) f.push("faturamento esperado");
      if (!l.em_que_pe_ficou) f.push("em que pé ficou");
      break;
    case "3": if (!l.catalogo_enviado_em) f.push("catálogo enviado"); break;
    case "4":
      if (l.valor_estimado == null || l.valor_estimado <= 0) f.push("valor estimado");
      if (l.tier_a && !l.comissao_registrada) f.push("regra de comissão registrada");
      if (!l.cliente_id) f.push("cliente vinculado");
      else if (!extra.temPedido) f.push("pedido do cliente");
      break;
    case "5":
      if (!l.forma_pagamento) f.push("forma de pagamento");
      if (!l.pago_em) f.push("pago");
      break;
    case "6": f.push("fase final"); break;
    case "X":
      if (!l.motivo_nao_agora) f.push("motivo");
      if (!l.retomar_em) f.push("data para retomar");
      break;
  }
  return f;
}
export const proximaFase = (f: Fase): Fase | null => (f === "X" || f === "6" ? null : (String(+f + 1) as Fase));

export interface Sugestao { tipo: TaskTipo; vence_em: string; responsavel: TaskResp; descricao?: string }
/** Próxima atividade sugerida pela fase (já para a fase em que o lead está ou vai entrar). */
export function sugerirTarefa(fase: Fase, l: Pick<LeadRegras, "visita_em" | "amostra" | "cadastro_fornecedor" | "pago_em">, hoje: string): Sugestao {
  switch (fase) {
    case "0": return { tipo: "Ligar", vence_em: addDias(hoje, 3), responsavel: "Representante" };
    case "1": return { tipo: "Visitar", vence_em: l.visita_em?.slice(0, 10) ?? addDias(hoje, 3), responsavel: "Representante" };
    case "2": return { tipo: "Enviar catálogo", vence_em: hoje, responsavel: "Gestão" };
    case "3": return { tipo: "Cobrar devolutiva", vence_em: addDias(hoje, 2), responsavel: "Representante" };
    case "4":
      if (l.amostra) return { tipo: "Enviar amostra", vence_em: addDias(hoje, 2), responsavel: "Representante" };
      if (l.cadastro_fornecedor) return { tipo: "Cobrar cadastro", vence_em: addDias(hoje, 3), responsavel: "Representante" };
      return { tipo: "Ligar", vence_em: addDias(hoje, 3), responsavel: "Representante" };
    case "5": return { tipo: "Cobrar pagamento", vence_em: addDias(hoje, 10), responsavel: "Gestão" };
    case "6": return { tipo: "Ver gôndola", vence_em: addDias(l.pago_em ?? hoje, 30), responsavel: "Representante" };
    default: return { tipo: "Ligar", vence_em: addDias(hoje, 7), responsavel: "Representante" };
  }
}

export function preencherFrase(txt: string, v: { nome?: string; rep?: string; dia?: string; valor?: string; segmento?: string; data?: string }): string {
  return txt
    .replaceAll("[nome]", v.nome || "[nome]").replaceAll("[rep]", v.rep || "[rep]")
    .replaceAll("[dia]", v.dia || "[dia]").replaceAll("[valor]", v.valor || "[valor]")
    .replaceAll("[segmento]", (v.segmento || "[segmento]").toLowerCase()).replaceAll("[data]", v.data || "[data]");
}

/** Ordem da fila da rodada: alertas → Prioridade (SQL) → Cadência (MQL) → Recompra → demais. */
export function pesoFila(temAlerta: boolean, p: Prioridade): number {
  if (temAlerta) return 0;
  return p === "Prioridade" ? 1 : p === "Cadência" ? 2 : p === "Recompra" ? 3 : 4;
}
