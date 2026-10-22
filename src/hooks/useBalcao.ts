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
