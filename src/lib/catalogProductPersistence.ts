import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { PRODUCT_FIELDS, type CatalogRow } from './catalogSpreadsheet';

export type CatalogClient = SupabaseClient<Database>;
export interface ProductAuditMeta { usuarioId: string; usuarioNome: string }
export interface ProductSaveContext { origem: 'planilha' | 'planilha_sharepoint'; arquivo?: string; leitura_id?: string; quem?: { id: string; nome: string } }
export class ProductConcurrentChange extends Error {}
export async function persistProductRow(client: CatalogClient, row: CatalogRow, code?: string, expected?: CatalogRow): Promise<CatalogRow> {
  let query = code ? client.from('products').update(row as never).eq('cod_cadastro', code) : client.from('products').upsert(row as never, { onConflict: 'sku' });
  if (expected) for (const [field, value] of Object.entries(expected)) query = value == null ? query.is(field, null) : query.eq(field, value as string);
  const { data, error } = await query.select('*').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ProductConcurrentChange('Produto mudou durante a gravação');
  return data as CatalogRow;
}
export async function saveProductFields(client: CatalogClient, code: string, patch: CatalogRow, meta: ProductAuditMeta, context: ProductSaveContext, before?: CatalogRow, optimistic = false): Promise<CatalogRow> {
  const clean = Object.fromEntries(Object.entries(patch).filter(([key, value]) => PRODUCT_FIELDS.includes(key as typeof PRODUCT_FIELDS[number]) && value != null && value !== ''));
  if (!Object.keys(clean).length) throw new Error('Nenhum campo de Produto para atualizar');
  let oldRow = before;
  if (!oldRow) {
    const { data, error } = await client.from('products').select('*').eq('cod_cadastro', code).single();
    if (error) throw new Error(error.message);
    oldRow = data as CatalogRow;
  }
  const expected = optimistic ? Object.fromEntries(Object.keys(clean).map(key => [key, oldRow?.[key] ?? null])) : undefined;
  const newRow = await persistProductRow(client, clean, code, expected);
  const changes = Object.fromEntries(PRODUCT_FIELDS.filter(key => JSON.stringify(oldRow?.[key]) !== JSON.stringify(newRow[key])).map(key => [key, { antes: oldRow?.[key] ?? null, depois: newRow[key] ?? null }]));
  // External operator UUIDs do not necessarily exist in FOP profiles. Preserve
  // their exact identity in quem without violating the audit foreign key.
  let auditUser: string | null = meta.usuarioId;
  if (context.origem === 'planilha_sharepoint') {
    const { data: profile, error: profileError } = await client.from('profiles').select('id').eq('id', meta.usuarioId).maybeSingle();
    if (profileError) throw new Error(`Produto atualizado; auditoria falhou: ${profileError.message}`);
    auditUser = profile?.id ?? null;
  }
  const { error } = await client.from('catalog_audit').insert({ usuario_id: auditUser, usuario_nome: meta.usuarioNome, produto_sku: String(newRow.sku), produto_nome: String(newRow.nome_comercial ?? ''), acao: 'editado', campos_alterados: { ...changes, ...context } } as never);
  if (error) throw new Error(`Produto atualizado; auditoria falhou: ${error.message}`);
  return newRow;
}
export async function loadCatalogLists(client: CatalogClient) {
  const results = await Promise.all([client.from('produto_grupos').select('id,nome,categoria_id'), client.from('produto_colecoes').select('id,nome'), client.from('produto_cores').select('id,nome'), client.from('produto_canal_dim').select('slug'), client.from('produto_categorias').select('id,nome')]);
  for (const result of results) if (result.error) throw new Error(result.error.message);
  return { grupo: results[0].data ?? [], colecao: results[1].data ?? [], cor: results[2].data ?? [], canais: (results[3].data ?? []).map(row => row.slug), categorias: results[4].data ?? [] };
}
