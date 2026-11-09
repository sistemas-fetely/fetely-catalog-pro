import { z } from 'zod';
import type { CatalogClient } from './catalogProductPersistence';

export const catalogDimensionBodySchema = z.object({
  dimensao: z.literal('colecao'),
  nome: z.string().trim().min(2).max(60),
  quem: z.object({ id: z.uuid(), nome: z.string().trim().min(1).max(200) }).strict(),
}).strict();

export type CatalogDimensionBody = z.infer<typeof catalogDimensionBodySchema>;
export type CatalogDimensionResult = { ok: true; id: string; nome: string; criada: boolean };

export function normalizeDimensionName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

export async function createCatalogDimension(client: CatalogClient, body: CatalogDimensionBody): Promise<CatalogDimensionResult> {
  const nome = body.nome.trim();
  const { data: collections, error: readError } = await client.from('produto_colecoes').select('id,nome');
  if (readError) throw new Error(readError.message);

  const normalized = normalizeDimensionName(nome);
  const existing = (collections ?? []).find(collection => normalizeDimensionName(collection.nome) === normalized);
  if (existing) return { ok: true, id: existing.id, nome: existing.nome, criada: false };

  const { data: created, error: insertError } = await client
    .from('produto_colecoes')
    .insert({ nome: body.nome, ativo: true })
    .select('id,nome')
    .single();
  if (insertError) throw new Error(insertError.message);

  // SNCF identities stay in quem; only an existing FOP profile can fill the FK.
  const { data: profile, error: profileError } = await client.from('profiles').select('id').eq('id', body.quem.id).maybeSingle();
  if (profileError) throw new Error(`Coleção criada; auditoria falhou: ${profileError.message}`);
  const { error: auditError } = await client.from('catalog_audit').insert({
    usuario_id: profile?.id ?? null,
    usuario_nome: body.quem.nome,
    produto_sku: `dimensao:colecao:${created.id}`,
    produto_nome: `Coleção: ${created.nome}`,
    acao: 'criado',
    campos_alterados: {
      colecao: { antes: null, depois: created.nome },
      origem: 'planilha_sharepoint',
      quem: body.quem,
    },
  } as never);
  if (auditError) throw new Error(`Coleção criada; auditoria falhou: ${auditError.message}`);

  return { ok: true, id: created.id, nome: created.nome, criada: true };
}
