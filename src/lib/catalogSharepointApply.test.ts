// @ts-ignore Bun supplies the test runner
import { expect, test } from 'bun:test';
import { prepareSharepointCell, sharepointBodySchema, applySharepointCells } from './catalogSharepointApply';
import { saveProductFields, type CatalogClient } from './catalogProductPersistence';
import type { CatalogLists, CatalogRow } from './catalogSpreadsheet';
const lists: CatalogLists = { grupo: [], colecao: [{ id: 'c', nome: 'Clássica' }], cor: [{ id: 'v', nome: 'Verde' }], canais: ['b2b'], categorias: [] };
const product = { cod_cadastro: '01497', sku: 'SKU', peso_g: 42, material: 'Papel', cor: 'Azul', cor_nome: 'Azul', is_vela_numerica: false };
const cell = { id: '8f9fb178-260b-40ce-a9ae-63b263b1665f', cod_cadastro: '01497', campo: 'material', valor_novo: ' Vidro ', valor_esperado: 'Papel' };
const prepare = (patch = {}) => prepareSharepointCell({ ...cell, ...patch }, product, lists);
for (const field of ['fase', 'ativo', 'sku', 'cod_cadastro', 'preco_atacado', 'preco_varejo', 'preco_site', '_ativo', 'ncm']) test(`${field} barrado na porta diária`, () => { expect(prepare({ campo: field }).result.status).toBe('erro'); expect(prepare({ campo: field }).patch).toEqual({}); });
test('texto aparado e permitido', () => expect(prepare().patch).toEqual({ material: 'Vidro' }));
test('valor esperado diferente resulta em conflito sem patch', () => { expect(prepare({ valor_esperado: 'Outro' }).result).toMatchObject({ status: 'conflito', valor_atual: 'Papel' }); expect(prepare({ valor_esperado: 'Outro' }).patch).toEqual({}); });
test('número com vírgula usa comparação e parse do importador', () => expect(prepare({ campo: 'peso_g', valor_esperado: '42,0', valor_novo: '43,5' }).patch).toEqual({ peso_g: 43.5 }));
test('booleano usa Sim/Não na comparação', () => expect(prepare({ campo: 'is_vela_numerica', valor_esperado: 'Não', valor_novo: 'Sim' }).patch).toEqual({ is_vela_numerica: true }));
test('inexistente não nasce', () => expect(prepareSharepointCell(cell, undefined, lists).result.erro).toBe('produto não existe no FOP'));
test('peso inválido gera erro por célula', () => expect(prepare({ campo: 'peso_g', valor_esperado: 42, valor_novo: '0' }).result.erro).toContain('> 0'));
test('vazio preserva valor', () => expect(prepare({ valor_novo: '' }).patch).toEqual({}));
test('zero legado igual não é validado como alteração', () => expect(prepareSharepointCell({ ...cell, campo: 'peso_g', valor_esperado: '0', valor_novo: '0' }, { ...product, peso_g: 0 }, lists).result.status).toBe('aplicada'));
test('cor resolve dimensão e pareia cor_nome', () => expect(prepare({ campo: 'cor', valor_esperado: 'Azul', valor_novo: ' verde ' }).patch).toEqual({ cor: 'Verde', cor_nome: 'Verde' }));
test('dimensão desconhecida não é criada automaticamente', () => expect(prepare({ campo: 'cor', valor_esperado: 'Azul', valor_novo: 'Inexistente' }).result.status).toBe('erro'));
test('canal inválido barrado', () => expect(prepareSharepointCell({ ...cell, campo: 'canal_venda', valor_esperado: null, valor_novo: 'xyz' }, product, lists).result.status).toBe('erro'));
const body = { quem: { id: 'd9ba28af-7398-45f9-b04e-db458c9aa65d', nome: 'Operador SNCF' }, leitura_id: '79e9eb11-9310-439a-ab0a-7b9386daffcb', celulas: [cell] };
test('teto concreto de 500 células', () => { const cells = Array.from({ length: 501 }, (_, index) => ({ ...cell, id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` })); expect(sharepointBodySchema.safeParse({ ...body, celulas: cells.slice(0,500) }).success).toBe(true); expect(sharepointBodySchema.safeParse({ ...body, celulas: cells }).success).toBe(false); });
function fakeClient(failCode?: string) {
  const rows: CatalogRow[] = [{ ...product }, { ...product, cod_cadastro: '01513' }];
  const audits: CatalogRow[] = [];
  const client = { from(table: string) {
    let op = 'read'; let patch: CatalogRow = {}; const conditions: [string, unknown][] = [];
    const query = { select() { return query; }, update(value: CatalogRow) { op = 'update'; patch = value; return query; }, insert(value: CatalogRow) { if (table === 'catalog_audit') audits.push(value); return Promise.resolve({ error: null }); }, eq(key: string, value: unknown) { conditions.push([key,value]); return query; }, is(key: string, value: unknown) { conditions.push([key,value]); return query; }, maybeSingle() { return query; }, single() { return query; }, then(resolve: (value: unknown) => unknown) {
      if (table.startsWith('produto_')) return Promise.resolve({ data: [], error: null }).then(resolve);
      if (table === 'profiles') return Promise.resolve({ data: null, error: null }).then(resolve);
      const row = rows.find(row => conditions.every(([key,value]) => row[key] === value));
      if (op === 'update' && row?.cod_cadastro === failCode) return Promise.resolve({ data: null, error: { message: 'Recusa do trigger' } }).then(resolve);
      if (op === 'update' && row) Object.assign(row, patch);
      return Promise.resolve({ data: row ? { ...row } : null, error: null }).then(resolve);
    } }; return query;
  } } as unknown as CatalogClient;
  return { client, rows, audits };
}
test('persistência compartilhada audita operador externo sem violar FK', async () => {
  const {client,audits} = fakeClient();
  await saveProductFields(client,'01497',{material:'Vidro'}, {usuarioId:body.quem.id,usuarioNome:body.quem.nome},{origem:'planilha_sharepoint',leitura_id:body.leitura_id,quem:body.quem},product,true);
  expect(audits[0]?.usuario_id).toBeNull(); expect(audits[0]?.usuario_nome).toBe('Operador SNCF');
  expect(audits[0]?.campos_alterados).toMatchObject({ material: { antes:'Papel',depois:'Vidro' }, origem:'planilha_sharepoint',leitura_id:body.leitura_id,quem:body.quem });
});
test('falha de um produto não derruba o outro', async () => {
  const {client,rows,audits} = fakeClient('01497');
  const result = await applySharepointCells(client,{...body,celulas:[cell,{...cell,id:'13a92c96-24f7-4f51-a5c1-23ca9a33eb60',cod_cadastro:'01513'}]});
  expect(result.resultados[0]?.status).toBe('erro'); expect(result.resultados[1]?.status).toBe('aplicada');
  expect(rows[0]?.material).toBe('Papel'); expect(rows[1]?.material).toBe('Vidro'); expect(audits).toHaveLength(1);
});
test('conflito de uma célula não impede outra válida do mesmo produto', async () => {
  const {client,rows} = fakeClient();
  const result = await applySharepointCells(client,{...body,celulas:[{...cell,valor_esperado:'Divergente'},{...cell,id:'13a92c96-24f7-4f51-a5c1-23ca9a33eb60',campo:'peso_g',valor_esperado:42,valor_novo:'43'}]});
  expect(result.resultados.map(item => item.status)).toEqual(['conflito','aplicada']); expect(rows[0]?.material).toBe('Papel'); expect(rows[0]?.peso_g).toBe(43);
});
