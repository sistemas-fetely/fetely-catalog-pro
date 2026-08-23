// Academia Inteligente — server functions (wrappers finos; lógica em academiaAi.server).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  FaqConhecimentoRow,
  FaqPerguntaRow,
  FaqResposta,
} from "./academia";

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

// ------------------------------------------- Base de conhecimento manual

export const listarFaqConhecimento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ itens: FaqConhecimentoRow[] }> => {
    const { assertAdminAcademia, listarFaqBase } = await import(
      "./academiaAi.server"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdminAcademia(context.supabase as any, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return listarFaqBase(context.supabase as any);
  });

export const salvarFaqConhecimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        titulo: z.string().trim().min(2).max(200),
        conteudo: z.string().trim().min(10).max(20000),
        ativo: z.boolean(),
      })
      .parse(d),
  )
  .handler(
    async ({ context, data }): Promise<{ id: string; chunks: number }> => {
      const { assertAdminAcademia, salvarFaqBase } = await import(
        "./academiaAi.server"
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await assertAdminAcademia(context.supabase as any, context.userId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return salvarFaqBase(context.supabase as any, data);
    },
  );

export const excluirFaqConhecimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }): Promise<{ chunks: number }> => {
    const { assertAdminAcademia, excluirFaqBase } = await import(
      "./academiaAi.server"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdminAcademia(context.supabase as any, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return excluirFaqBase(context.supabase as any, data.id);
  });
