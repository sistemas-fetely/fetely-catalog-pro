import { z } from 'zod';
import { createCatalogDimensionValue, type CatalogClient } from './catalogProductPersistence';

export const catalogDimensionRegistrationBodySchema = z.object({
  quem: z.object({ id: z.uuid(), nome: z.string().trim().min(1).max(200) }).strict(),
  kind: z.enum(['grupo', 'colecao', 'cor']),
  nome: z.string().trim().min(1).max(120),
  categoria_id: z.uuid().optional(),
}).strict().superRefine((body, context) => {
  if (body.kind === 'grupo' && !body.categoria_id) {
    context.addIssue({ code: 'custom', path: ['categoria_id'], message: 'categoria_id é obrigatório para grupo' });
  }
});

export type CatalogDimensionRegistrationBody = z.infer<typeof catalogDimensionRegistrationBodySchema>;
export type CatalogDimensionRegistrationResult = {
  ok: true;
  criado: boolean;
  kind: 'grupo' | 'colecao' | 'cor';
  id: string;
  nome: string;
};

export async function registerCatalogDimension(
  client: CatalogClient,
  body: CatalogDimensionRegistrationBody,
): Promise<CatalogDimensionRegistrationResult> {
  const created = await createCatalogDimensionValue(client, {
    kind: body.kind,
    nome: body.nome,
    categoriaId: body.categoria_id,
  }, undefined, { quem: body.quem, origem: 'planilha_sharepoint' });

  return { ok: true, criado: created.criado, kind: body.kind, id: created.id, nome: created.nome };
}
