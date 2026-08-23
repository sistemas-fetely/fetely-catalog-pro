// Academia Inteligente — server functions (wrappers finos; lógica em academiaAi.server).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FaqPerguntaRow, FaqResposta } from "./academia";

export const perguntarAcademia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ pergunta: z.string().trim().min(3).max(600) }).parse(d),
  )
  .handler(async ({ context, data }): Promise<FaqResposta> => {
    const { responderPergunta } = await import("./academiaAi.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return responderPergunta(context.supabase as any, context.userId, data.pergunta);
  });

export const reindexAcademiaModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ moduloId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }): Promise<{ chunks: number }> => {
    const { assertAdminAcademia, reindexarModulo } = await import(
      "./academiaAi.server"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdminAcademia(context.supabase as any, context.userId);
    return reindexarModulo(data.moduloId);
  });

export const reindexAcademiaTudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ modulos: number; chunks: number }> => {
      const { assertAdminAcademia, reindexarTudo } = await import(
        "./academiaAi.server"
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await assertAdminAcademia(context.supabase as any, context.userId);
      return reindexarTudo();
    },
  );

export const listarDuvidasAcademia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ perguntas: FaqPerguntaRow[] }> => {
    const { assertAdminAcademia, listarDuvidas } = await import(
      "./academiaAi.server"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdminAcademia(context.supabase as any, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return listarDuvidas(context.supabase as any);
  });
