// Ponte Balcão B2C: todas as chamadas passam pela edge enviar-para-sncf,
// que valida o papel (master/admin/vendedor) e injeta a identidade do
// vendedor pelo login. Fail-loud: erro do SNCF vira Error com a mensagem original.

import { supabase } from "@/integrations/supabase/client";

export async function balcao<T = Record<string, unknown>>(
  tipo: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("enviar-para-sncf", {
    body: { tipo, ...body },
  });

  if (error) {
    // FunctionsHttpError: a mensagem real do SNCF está no corpo da resposta.
    let msg = error.message ?? "Erro desconhecido";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const b = (await ctx.json()) as { error?: string; erro?: string };
        msg = b?.error ?? b?.erro ?? msg;
      }
    } catch {
      /* sem corpo legível — usa a mensagem genérica */
    }
    throw new Error(msg);
  }

  const d = data as { ok?: boolean; error?: string; erro?: string } | null;
  if (d?.ok !== true) {
    throw new Error(d?.error ?? d?.erro ?? "Resposta inválida do SNCF");
  }
  return data as T;
}

export function useBalcao() {
  return { balcao };
}

export type AlteracaoBalcao = {
  fop_profile_id: string;
  pedido_id: string;
  motivo: string;
  cliente: Record<string, string>;
  pedidoAlterado: boolean;
  meioAlterado: boolean;
  itens: { sku: string; quantidade: number }[];
  entrega: Record<string, unknown>;
  observacao: string;
  meio: "pix" | "cartao" | "cartao_maquininha";
};

// Somente coordenação das chamadas; permissões e regras comerciais pertencem ao SNCF.
export async function salvarAlteracaoBalcao(
  a: AlteracaoBalcao,
  chamar: (tipo: string, body: Record<string, unknown>) => Promise<Record<string, unknown>> = balcao,
) {
  if (a.motivo.trim().length < 3) throw new Error("Informe o motivo da alteração (mín. 3 caracteres).");
  const base = { fop_profile_id: a.fop_profile_id, pedido_id: a.pedido_id, motivo: a.motivo.trim() };
  let resultado: Record<string, unknown> = {};
  const clienteAlterado = Object.keys(a.cliente).length > 0;
  if (clienteAlterado) resultado = await chamar("balcao_cliente_atualizar", { ...base, cliente: a.cliente });
  if (a.pedidoAlterado || (a.meioAlterado && clienteAlterado)) {
    resultado = await chamar("balcao_editar", {
      ...base, itens: a.itens, entrega: a.entrega, observacao: a.observacao,
      meio: a.meioAlterado ? a.meio : null,
    });
  } else if (a.meioAlterado) {
    resultado = await chamar("balcao_trocar_meio", { ...base, meio: a.meio });
  }
  return resultado;
}
