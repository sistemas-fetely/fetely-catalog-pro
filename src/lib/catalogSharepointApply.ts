import { z } from 'zod';
import { PRODUCT_FIELDS, dimensionFor, equalProductValue, normalizeName, resolveProductChange, type CatalogLists, type CatalogRow, type ProductField } from './catalogSpreadsheet';
import { loadCatalogLists, ProductConcurrentChange, saveProductFields, type CatalogClient } from './catalogProductPersistence';

export const sharepointBodySchema = z.object({
  quem: z.object({ id: z.uuid(), nome: z.string().trim().min(1).max(200) }).strict(),
  leitura_id: z.uuid(),
  celulas: z.array(z.object({ id: z.uuid(), cod_cadastro: z.string().trim().min(1).max(80), campo: z.string().min(1).max(80), valor_novo: z.string().max(50000), valor_esperado: z.union([z.string().max(50000), z.number().finite(), z.boolean(), z.null()]) }).strict()).min(1).max(500),
}).strict().superRefine((body, ctx) => {
  const ids = new Set<string>();
  for (const cell of body.celulas) { if (ids.has(cell.id)) ctx.addIssue({ code: 'custom', message: 'ID de célula duplicado', path: ['celulas'] }); ids.add(cell.id); }
});
export type SharepointBody = z.infer<typeof sharepointBodySchema>;
export type SharepointCell = SharepointBody['celulas'][number];
export type CellResult = { id: string; status: 'aplicada' | 'conflito' | 'erro'; valor_atual: unknown; erro?: string };
export const SHAREPOINT_FIELDS: readonly string[] = PRODUCT_FIELDS.filter(field => !['preco_atacado', 'preco_varejo', 'preco_site'].includes(field));
export function prepareSharepointCell(cell: SharepointCell, product: CatalogRow | undefined, lists: CatalogLists, category?: unknown): { result: CellResult; patch: CatalogRow } {
  const current = product?.[cell.campo] ?? null;
  const result: CellResult = { id: cell.id, status: 'aplicada', valor_atual: current };
  const error = (message: string) => ({ result: { ...result, status: 'erro' as const, erro: message }, patch: {} });
  if (!product) return error('produto não existe no FOP');
  if (!SHAREPOINT_FIELDS.includes(cell.campo)) return error(`Campo fora da allowlist: ${cell.campo}`);
  const field = cell.campo as ProductField;
  if (!equalProductValue(field, cell.valor_esperado, current)) return { result: { ...result, status: 'conflito' }, patch: {} };
  try {
    const categoriaId = lists.categorias.find(item => normalizeName(item.nome) === normalizeName(category ?? product.categoria))?.id;
    const change = resolveProductChange(field, cell.valor_novo, product, lists, categoriaId);
    if (!change) return { result, patch: {} }; // Empty preserves and unchanged legacy data remains unchanged.
    if (change.newKey) return error(`Valor de dimensão não cadastrado: ${cell.campo} = ${change.after}`);
    const patch: CatalogRow = { [field]: change.after };
    if (field === 'cor') patch.cor_nome = change.after;
    return { result, patch };
  } catch (cause) { return error(cause instanceof Error ? cause.message : String(cause)); }
}
export async function applySharepointCells(client: CatalogClient, body: SharepointBody): Promise<{ resultados: CellResult[] }> {
  const results = new Map<string, CellResult>();
  const groups = new Map<string, SharepointCell[]>();
  for (const cell of body.celulas) { const group = groups.get(cell.cod_cadastro) ?? []; group.push(cell); groups.set(cell.cod_cadastro, group); }
  const lists = await loadCatalogLists(client);
  for (const [code, cells] of groups) {
    try {
      const { data, error } = await client.from('products').select('*').eq('cod_cadastro', code).maybeSingle();
      if (error) throw new Error(error.message);
      const product = data ? data as CatalogRow : undefined;
      const duplicateFields = new Set(cells.filter((cell, index) => cells.findIndex(other => other.campo === cell.campo) !== index).map(cell => cell.campo));
      // A category submitted in this batch influences group resolution only if itself valid.
      const categoryCell = cells.find(cell => cell.campo === 'categoria');
      const category = categoryCell ? prepareSharepointCell(categoryCell, product, lists).patch.categoria : undefined;
      const prepared = cells.map(cell => ({ cell, ...prepareSharepointCell(cell, product, lists, category) }));
      const patch: CatalogRow = {};
      for (const entry of prepared) {
        if (duplicateFields.has(entry.cell.campo)) { entry.result.status = 'erro'; entry.result.erro = 'Campo duplicado no produto'; entry.patch = {}; }
        results.set(entry.cell.id, entry.result);
        Object.assign(patch, entry.patch);
      }
      // Never let a derived color overwrite an explicitly conflicting/invalid cor_nome cell.
      const nameCell = prepared.find(entry => entry.cell.campo === 'cor_nome');
      const colorCell = prepared.find(entry => entry.cell.campo === 'cor');
      if (colorCell?.patch.cor_nome !== undefined && nameCell && (nameCell.result.status !== 'aplicada' || (nameCell.patch.cor_nome !== undefined && nameCell.patch.cor_nome !== colorCell.patch.cor_nome))) {
        colorCell.result.status = 'erro'; colorCell.result.erro = 'cor e cor_nome incompatíveis nesta chamada'; colorCell.patch = {};
        for (const key of Object.keys(patch)) delete patch[key];
        for (const entry of prepared) Object.assign(patch, entry.patch);
      }
      if (product && Object.keys(patch).length) {
        try {
          const updated = await saveProductFields(client, code, patch, { usuarioId: body.quem.id, usuarioNome: body.quem.nome }, { origem: 'planilha_sharepoint', leitura_id: body.leitura_id, quem: body.quem }, product, true);
          for (const entry of prepared) if (entry.result.status === 'aplicada') entry.result.valor_atual = updated[entry.cell.campo] ?? null;
        } catch (cause) {
          if (cause instanceof ProductConcurrentChange) {
            const { data: fresh, error: freshError } = await client.from('products').select('*').eq('cod_cadastro', code).maybeSingle();
            if (freshError) throw new Error(freshError.message);
            for (const entry of prepared) if (Object.keys(entry.patch).length) { entry.result.status = 'conflito'; entry.result.valor_atual = (fresh as CatalogRow | null)?.[entry.cell.campo] ?? null; }
          } else {
            for (const entry of prepared) if (Object.keys(entry.patch).length) { entry.result.status = 'erro'; entry.result.erro = cause instanceof Error ? cause.message : String(cause); }
          }
        }
      }
    } catch (cause) {
      for (const cell of cells) results.set(cell.id, { id: cell.id, status: 'erro', valor_atual: null, erro: cause instanceof Error ? cause.message : String(cause) });
    }
  }
  return { resultados: body.celulas.map(cell => results.get(cell.id) ?? { id: cell.id, status: 'erro', valor_atual: null, erro: 'Célula não processada' }) };
}
