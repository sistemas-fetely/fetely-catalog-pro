import { z } from 'zod';
import type { CatalogClient } from './catalogProductPersistence';
import { dimensionKey } from './catalogSpreadsheet';

const common = {
  quem: z.object({ id: z.uuid(), nome: z.string().trim().min(1).max(200) }).strict(),
  categoria_id: z.uuid().optional(),
};
const name = z.string().trim().min(1).max(120);
export const catalogDimensionAdjustmentBodySchema = z.discriminatedUnion('acao', [
  z.object({ ...common, acao: z.literal('renomear'), kind: z.enum(['grupo', 'colecao']), de: name, para: name,
    dry_run: z.boolean().optional(),
    cod_cadastros: z.array(z.string().trim().min(1).max(120)).min(1).max(2000) }).strict(),
  z.object({ ...common, acao: z.literal('inativar_se_vazio'), kind: z.enum(['grupo', 'colecao', 'cor']), nome: name }).strict(),
]).superRefine((body, context) => {
  if (body.kind === 'grupo' && !body.categoria_id) {
    context.addIssue({ code: 'custom', path: ['categoria_id'], message: 'categoria_id é obrigatório para grupo' });
  }
});
export type CatalogDimensionAdjustmentBody = z.infer<typeof catalogDimensionAdjustmentBodySchema>;

export async function adjustCatalogDimension(client: CatalogClient, body: CatalogDimensionAdjustmentBody) {
  const table = body.kind === 'grupo' ? 'produto_grupos' : body.kind === 'colecao' ? 'produto_colecoes' : 'produto_cores';
  const rows: { id: string; nome: string; ativo: boolean }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const query = body.kind === 'grupo' && body.categoria_id
      ? client.from('produto_grupos').select('id,nome,ativo').order('id').range(offset, offset + 999).eq('categoria_id', body.categoria_id)
      : client.from(table).select('id,nome,ativo').order('id').range(offset, offset + 999);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const sourceName = body.acao === 'renomear' ? body.de : body.nome;
  const source = rows.find(row => dimensionKey(row.nome) === dimensionKey(sourceName) && row.ativo)
    ?? (body.acao === 'inativar_se_vazio' ? rows.find(row => dimensionKey(row.nome) === dimensionKey(sourceName)) : undefined);
  if (!source) return { ok: true, [body.acao === 'renomear' ? 'renomeado' : 'inativado']: false, motivo: 'nao_encontrado' };
  if (body.acao === 'renomear') {
    if (rows.some(row => row.ativo && dimensionKey(row.nome) === dimensionKey(body.para))) {
      return { ok: true, renomeado: false, motivo: 'destino_existe' };
    }
    if (rows.some(row => !row.ativo && dimensionKey(row.nome) === dimensionKey(body.para))) {
      return { ok: true, renomeado: false, motivo: 'destino_inativo' };
    }
    const { data, error } = await client.rpc('fn_catalogo_dimensao_renomear', {
      p_kind: body.kind, p_id: source.id, p_para: body.para, p_cods: body.cod_cadastros, p_quem: body.quem,
      p_dry_run: body.dry_run ?? false,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Resposta inválida');
    return { ok: true, ...data, ...(data['renomeado'] === true ? { nome: body.para } : {}) };
  }
  const { data, error } = await client.rpc('fn_catalogo_dimensao_inativar_se_vazio', { p_kind: body.kind, p_id: source.id, p_quem: body.quem });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Resposta inválida');
  return { ok: true, ...data };
}