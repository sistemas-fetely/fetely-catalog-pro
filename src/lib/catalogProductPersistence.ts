import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { PRODUCT_FIELDS, normalizeName, type CatalogLists, type CatalogRow, type Dimension, type NewValue } from './catalogSpreadsheet';

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
export async function saveProductFields(client: CatalogClient, code: string, patch: CatalogRow, meta: ProductAuditMeta, context: ProductSaveContext, before?: CatalogRow, optimistic = false, allowed: readonly string[] = PRODUCT_FIELDS): Promise<CatalogRow> {
  const clean = Object.fromEntries(Object.entries(patch).filter(([key, value]) => allowed.includes(key) && value != null && value !== ''));
  if (!Object.keys(clean).length) throw new Error('Nenhum campo de Produto para atualizar');
  let oldRow = before;
  if (!oldRow) {
    const { data, error } = await client.from('products').select('*').eq('cod_cadastro', code).single();
    if (error) throw new Error(error.message);
    oldRow = data as CatalogRow;
  }
  const expected = optimistic ? Object.fromEntries(Object.keys(clean).map(key => [key, oldRow?.[key] ?? null])) : undefined;
  const newRow = await persistProductRow(client, clean, code, expected);
  const changes = Object.fromEntries(allowed.filter(key => JSON.stringify(oldRow?.[key]) !== JSON.stringify(newRow[key])).map(key => [key, { antes: oldRow?.[key] ?? null, depois: newRow[key] ?? null }]));
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
export async function loadCatalogLists(client: CatalogClient): Promise<CatalogLists> {
  const results = await Promise.all([client.from('produto_grupos').select('id,nome,categoria_id'), client.from('produto_colecoes').select('id,nome'), client.from('produto_cores').select('id,nome'), client.from('produto_canal_dim').select('slug'), client.from('produto_categorias').select('id,nome')]);
  for (const result of results) if (result.error) throw new Error(result.error.message);
  return { grupo: results[0].data ?? [], colecao: results[1].data ?? [], cor: results[2].data ?? [], canais: (results[3].data ?? []).map(row => row.slug), categorias: results[4].data ?? [] };
}

export type CatalogDimensionInput = Omit<NewValue, 'key'>;
export interface CatalogDimensionAudit {
  quem: { id: string; nome: string };
  origem: 'planilha_sharepoint';
}
export interface CatalogDimensionValue extends Dimension { criado: boolean }

const dimensionLabels = { grupo: 'Grupo', colecao: 'Coleção', cor: 'Cor' } as const;

/** Shared by the manual spreadsheet importer and the authenticated SNCF door. */
export async function createCatalogDimensionValue(
  client: CatalogClient,
  value: CatalogDimensionInput,
  lists?: CatalogLists,
  audit?: CatalogDimensionAudit,
): Promise<CatalogDimensionValue> {
  const table = value.kind === 'grupo' ? 'produto_grupos' : value.kind === 'colecao' ? 'produto_colecoes' : 'produto_cores';
  const fresh = await loadCatalogLists(client);
  const existing = fresh[value.kind].find(dimension =>
    normalizeName(dimension.nome) === normalizeName(value.nome)
    && (value.kind !== 'grupo' || dimension.categoria_id === value.categoriaId));
  if (existing) return { ...existing, criado: false };
  if (value.kind === 'grupo' && !value.categoriaId) throw new Error(`Grupo ${value.nome}: categoria não encontrada para criar este valor`);

  const { data: created, error } = await client.from(table).insert({
    nome: value.nome,
    ...(value.kind === 'grupo' ? { categoria_id: value.categoriaId } : {}),
  } as never).select('id,nome').single();
  if (error) throw new Error(error.message);

  const dimension: Dimension = {
    id: created.id,
    nome: created.nome,
    ...(value.kind === 'grupo' ? { categoria_id: value.categoriaId } : {}),
  };
  lists?.[value.kind].push(dimension);

  if (audit) {
    // External SNCF identities stay in quem; only an existing FOP profile fills the FK.
    const { data: profile, error: profileError } = await client.from('profiles').select('id').eq('id', audit.quem.id).maybeSingle();
    if (profileError) throw new Error(`Dimensão criada; auditoria falhou: ${profileError.message}`);
    const { error: auditError } = await client.from('catalog_audit').insert({
      usuario_id: profile?.id ?? null,
      usuario_nome: audit.quem.nome,
      produto_sku: `dimensao:${value.kind}:${created.id}`,
      produto_nome: `${dimensionLabels[value.kind]}: ${created.nome}`,
      acao: 'criado',
      campos_alterados: {
        [value.kind]: { antes: null, depois: created.nome },
        ...(value.kind === 'grupo' ? { categoria_id: value.categoriaId } : {}),
        origem: audit.origem,
        quem: audit.quem,
      },
    } as never);
    if (auditError) throw new Error(`Dimensão criada; auditoria falhou: ${auditError.message}`);
  }

  return { ...dimension, criado: true };
}
