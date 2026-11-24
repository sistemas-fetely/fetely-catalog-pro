import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { adjustCatalogDimension, catalogDimensionAdjustmentBodySchema } from './catalogDimensionAdjustment';
import { handleCatalogDimensionAdjustment } from './catalogDimensionAdjustmentHandler';
import type { CatalogClient } from './catalogProductPersistence';

const quem = { id: '00000000-0000-4000-8000-000000000099', nome: 'Operador SNCF' };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const db = new PGlite();
beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE profiles (id uuid PRIMARY KEY);
    CREATE TABLE produto_departamentos (id uuid PRIMARY KEY, nome text);
    CREATE TABLE produto_categorias (id uuid PRIMARY KEY, nome text, departamento_id uuid);
    CREATE TABLE produto_grupos (id uuid PRIMARY KEY, nome text, categoria_id uuid, ativo boolean DEFAULT true);
    CREATE TABLE produto_colecoes (id uuid PRIMARY KEY, nome text, descricao text, ativo boolean DEFAULT true);
    CREATE TABLE produto_cores (id uuid PRIMARY KEY, nome text, ativo boolean DEFAULT true);
    CREATE TABLE products (id uuid PRIMARY KEY, cod_cadastro text, sku text, nome_comercial text,
      grupo_id uuid, colecao_id uuid, cor_id uuid, grupo text, colecao text, cor text, cor_nome text,
      categoria text, departamento text, fase text DEFAULT 'registrado', ativo boolean DEFAULT true);
    CREATE TABLE photos (kind text, colecao text, url text);
    CREATE TABLE catalogos_pdf (id uuid PRIMARY KEY, colecao text, titulo text);
    CREATE TABLE catalog_audit (usuario_id uuid REFERENCES profiles(id), usuario_nome text, produto_sku text,
      produto_nome text, acao text, campos_alterados jsonb);
  `);
  await db.exec(readFileSync('drizzle/migrations/0018_scope_product_group_to_category.sql', 'utf8'));
  await db.exec(`CREATE TRIGGER gate BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION fn_products_gate_dimensoes();`);
  await db.exec(readFileSync('drizzle/migrations/0019_catalogo_dimensao_ajustar_atomico.sql', 'utf8'));
  await db.exec(readFileSync('drizzle/migrations/0020_catalogo_dimensao_dry_run_e_vinculo_pdf.sql', 'utf8'));
}, 30000);
beforeEach(async () => {
  await db.exec(`TRUNCATE products, photos, catalogos_pdf, catalog_audit, produto_grupos, produto_colecoes, produto_cores, produto_categorias, produto_departamentos;
    INSERT INTO produto_departamentos VALUES ('${id(20)}', 'Depto');
    INSERT INTO produto_categorias VALUES ('${id(10)}', 'A', '${id(20)}'), ('${id(11)}', 'B', '${id(20)}');
    INSERT INTO produto_grupos VALUES ('${id(1)}', 'Travessa', '${id(10)}', true), ('${id(2)}', 'Travessa', '${id(11)}', true);
    INSERT INTO produto_colecoes VALUES ('${id(3)}', 'Antiga', 'Descrição preservada', true);
    INSERT INTO produto_cores VALUES ('${id(4)}', 'Verde', true);
    INSERT INTO products (id, cod_cadastro, sku, nome_comercial, grupo_id, colecao_id, grupo, colecao, categoria, ativo)
      VALUES ('${id(30)}','01569','SKU-1','Produto 1','${id(1)}','${id(3)}','Travessa','Antiga','A',true),
        ('${id(31)}','01570','SKU-2','Produto 2','${id(1)}','${id(3)}','Travessa','Antiga','A',false),
        ('${id(32)}','01571','SKU-3','Produto 3','${id(2)}',NULL,'Travessa',NULL,'B',true);
    INSERT INTO photos VALUES ('colecao','Antiga','capa'), ('produto','Antiga','produto');
    INSERT INTO catalogos_pdf VALUES ('${id(50)}','Antiga','PDF original'), ('${id(51)}','Outra','PDF intocado');
  `);
});
afterAll(async () => { await db.close(); });

// Exercise the handler and actual migration together, never the hosted product data.
const client = {
  from(table: string) {
    const allowed = ['produto_grupos', 'produto_colecoes', 'produto_cores'];
    if (!allowed.includes(table)) throw new Error('Tabela inesperada');
    let category: string | undefined;
    let start = 0;
    const query = {
      select: () => query, order: () => query,
      range: (offset: number) => { start = offset; return query; },
      eq: (_field: string, value: string) => { category = value; return query; },
      then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
        return db.query(`SELECT id,nome,ativo FROM ${table} ${category ? 'WHERE categoria_id = $1' : ''} ORDER BY id LIMIT 1000 OFFSET ${start}`, category ? [category] : [])
          .then(result => resolve({ data: result.rows, error: null }), reject);
      },
    };
    return query;
  },
  async rpc(name: string, args: Record<string, unknown>) {
    if (name === 'get_vault_secret') return { data: 'test-token', error: null };
    const rename = name === 'fn_catalogo_dimensao_renomear';
    if (!rename && name !== 'fn_catalogo_dimensao_inativar_se_vazio') throw new Error('RPC inesperada');
    const values = rename ? [args['p_kind'], args['p_id'], args['p_para'], args['p_cods'], args['p_quem'], args['p_dry_run'] ?? false]
      : [args['p_kind'], args['p_id'], args['p_quem']];
    const result = await db.query<{ result: Record<string, unknown> }>(`SELECT ${name}(${rename ? '$1,$2,$3,$4,$5,$6' : '$1,$2,$3'}) AS result`, values);
    return { data: result.rows[0]?.result, error: null };
  },
} as unknown as CatalogClient;
const renameBody = (kind: 'grupo' | 'colecao' = 'grupo') => ({ quem, acao: 'renomear' as const, kind,
  de: kind === 'grupo' ? ' TRÁVESSA ' : 'Antiga', para: 'Bandeja', cod_cadastros: ['01570', '01569'],
  ...(kind === 'grupo' ? { categoria_id: id(10) } : {}) });
const request = (body: unknown, token = 'test-token') => new Request('http://localhost/api/public/catalogo-dimensao-ajustar', {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const handle = (body: unknown, token = 'test-token') => handleCatalogDimensionAdjustment(request(body, token), async () => client);
const snapshot = async () => (await db.query(`SELECT jsonb_build_object(
  'products',(SELECT jsonb_agg(p ORDER BY id) FROM products p),
  'groups',(SELECT jsonb_agg(g ORDER BY id) FROM produto_grupos g),
  'collections',(SELECT jsonb_agg(c ORDER BY id) FROM produto_colecoes c),
  'photos',(SELECT jsonb_agg(p) FROM photos p),
  'pdfs',(SELECT jsonb_agg(p ORDER BY id) FROM catalogos_pdf p),
  'audit',(SELECT jsonb_agg(a) FROM catalog_audit a)) AS value`)).rows;

test('renomeia grupo no mesmo id, inclui inativos e deixa outra categoria intacta', async () => {
  const response = await handle(renameBody());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, renomeado: true, id: id(1), nome: 'Bandeja', produtos: 2 });
  expect((await db.query('SELECT cod_cadastro,grupo,grupo_id,categoria,sku FROM products ORDER BY cod_cadastro')).rows).toEqual([
    { cod_cadastro: '01569', grupo: 'Bandeja', grupo_id: id(1), categoria: 'A', sku: 'SKU-1' },
    { cod_cadastro: '01570', grupo: 'Bandeja', grupo_id: id(1), categoria: 'A', sku: 'SKU-2' },
    { cod_cadastro: '01571', grupo: 'Travessa', grupo_id: id(2), categoria: 'B', sku: 'SKU-3' },
  ]);
  const audits = (await db.query<{ usuario_id: string | null; produto_sku: string; campos_alterados: unknown }>('SELECT * FROM catalog_audit')).rows;
  expect(audits).toHaveLength(3);
  expect(audits.find(a => a.produto_sku === `dimensao:grupo:${id(1)}`)?.campos_alterados).toEqual({ grupo: { antes: 'Travessa', depois: 'Bandeja' }, origem: 'planilha_sharepoint_renomear', quem });
  expect(audits.map(a => a.usuario_id)).toEqual([null, null, null]);
});
test('renomeia coleção preservando descrição, id, fotos de capa e produto', async () => {
  expect(await adjustCatalogDimension(client, renameBody('colecao'))).toMatchObject({ renomeado: true, produtos: 2 });
  expect((await db.query('SELECT * FROM produto_colecoes')).rows).toEqual([{ id: id(3), nome: 'Bandeja', descricao: 'Descrição preservada', ativo: true }]);
  expect((await db.query('SELECT kind,colecao,url FROM photos ORDER BY kind')).rows).toEqual([
    { kind: 'colecao', colecao: 'Bandeja', url: 'capa' }, { kind: 'produto', colecao: 'Bandeja', url: 'produto' },
  ]);
  expect((await db.query('SELECT colecao_id,colecao FROM products WHERE colecao_id IS NOT NULL')).rows).toEqual([
    { colecao_id: id(3), colecao: 'Bandeja' }, { colecao_id: id(3), colecao: 'Bandeja' },
  ]);
});
test('destino equivalente existente na mesma categoria não grava', async () => {
  await db.exec(`INSERT INTO produto_grupos VALUES ('${id(5)}','Bándeja','${id(10)}',true)`);
  const before = await snapshot();
  expect(await adjustCatalogDimension(client, renameBody())).toEqual({ ok: true, renomeado: false, motivo: 'destino_existe' });
  expect(await snapshot()).toEqual(before);
});
test('renomeação de coleção atualiza somente PDFs vinculados pelo nome antigo', async () => {
  await adjustCatalogDimension(client, renameBody('colecao'));
  expect((await db.query('SELECT * FROM catalogos_pdf ORDER BY id')).rows).toEqual([
    { id: id(50), colecao: 'Bandeja', titulo: 'PDF original' },
    { id: id(51), colecao: 'Outra', titulo: 'PDF intocado' },
  ]);
});
test.each(['grupo', 'colecao'] as const)('dry_run de %s valida e conta sem nenhuma gravação', async kind => {
  const before = await snapshot();
  const response = await handle({ ...renameBody(kind), dry_run: true });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ renomeado: true, produtos: 2 });
  expect(await snapshot()).toEqual(before);
});
test.each(['nao_encontrado', 'parcial', 'destino_existe', 'destino_inativo'] as const)('dry_run devolve %s sem gravar', async motivo => {
  if (motivo.startsWith('destino')) await db.exec(`INSERT INTO produto_colecoes VALUES ('${id(5)}','Bándeja',NULL,${motivo === 'destino_existe'})`);
  const before = await snapshot();
  const response = await handle({ ...renameBody('colecao'), dry_run: true,
    ...(motivo === 'nao_encontrado' ? { de: 'Ausente' } : {}), ...(motivo === 'parcial' ? { cod_cadastros: ['01569'] } : {}),
  });
  expect(await response.json()).toEqual({ ok: true, renomeado: false, motivo });
  expect(await snapshot()).toEqual(before);
});
test('destino inativo bloqueia tanto a porta quanto a RPC', async () => {
  await db.exec(`INSERT INTO produto_colecoes VALUES ('${id(5)}','Bándeja',NULL,false)`);
  const before = await snapshot();
  expect(await adjustCatalogDimension(client, renameBody('colecao'))).toEqual({ ok: true, renomeado: false, motivo: 'destino_inativo' });
  expect((await client.rpc('fn_catalogo_dimensao_renomear', { p_kind: 'colecao', p_id: id(3), p_para: 'Bandeja', p_cods: ['01569', '01570'], p_quem: quem })).data).toEqual({ renomeado: false, motivo: 'destino_inativo' });
  expect(await snapshot()).toEqual(before);
});
test('origem ativa vence equivalente inativa na renomeação', async () => {
  await db.exec(`INSERT INTO produto_grupos VALUES ('${id(0)}','Trávessa','${id(10)}',false)`);
  expect(await adjustCatalogDimension(client, renameBody())).toMatchObject({ renomeado: true, id: id(1), produtos: 2 });
});
test('origem somente inativa não é renomeada', async () => {
  await db.exec(`UPDATE produto_colecoes SET ativo=false WHERE id='${id(3)}'`);
  expect(await adjustCatalogDimension(client, renameBody('colecao'))).toMatchObject({ renomeado: false, motivo: 'nao_encontrado' });
});
test('inativação escolhe ativa antes de equivalente inativa', async () => {
  await db.exec(`INSERT INTO produto_cores VALUES ('${id(0)}','Vérde',false)`);
  expect(await adjustCatalogDimension(client, { quem, acao: 'inativar_se_vazio', kind: 'cor', nome: 'Verde' })).toEqual({ ok: true, inativado: true, id: id(4) });
});
test('contrato RPC antigo também atualiza o vínculo PDF', async () => {
  await db.query('SELECT fn_catalogo_dimensao_renomear($1,$2,$3,$4,$5)', ['colecao', id(3), 'Bandeja', ['01569', '01570'], quem]);
  expect((await db.query('SELECT colecao FROM catalogos_pdf WHERE id=$1', [id(50)])).rows).toEqual([{ colecao: 'Bandeja' }]);
});
test('destino em outra categoria não impede renomear', async () => {
  await db.exec(`UPDATE produto_grupos SET nome='Bandeja' WHERE id='${id(2)}'`);
  expect(await adjustCatalogDimension(client, renameBody())).toMatchObject({ renomeado: true, id: id(1) });
});
test('parcial sem produto inativo não grava nada', async () => {
  const before = await snapshot();
  expect(await adjustCatalogDimension(client, { ...renameBody(), cod_cadastros: ['01569'] })).toEqual({ ok: true, renomeado: false, motivo: 'parcial' });
  expect(await snapshot()).toEqual(before);
});
test('erro do gate desfaz dimensão, produtos e auditoria na mesma transação', async () => {
  await db.exec(`ALTER TABLE products DISABLE TRIGGER gate; UPDATE products SET categoria='Inexistente' WHERE cod_cadastro='01570'; ALTER TABLE products ENABLE TRIGGER gate;`);
  const before = await snapshot();
  expect((await handle(renameBody())).status).toBe(500);
  expect(await snapshot()).toEqual(before);
});
test('lista com código extra também é parcial', async () => {
  expect(await adjustCatalogDimension(client, { ...renameBody(), cod_cadastros: ['01569', '01570', '99999'] })).toMatchObject({ renomeado: false, motivo: 'parcial' });
});
test('lista é comparada como conjunto, sem depender de ordem ou duplicação', async () => {
  expect(await adjustCatalogDimension(client, { ...renameBody(), cod_cadastros: ['01570', '01569', '01569'] })).toMatchObject({ renomeado: true, produtos: 2 });
});
test('RPC verifica destino novamente, mesmo sem checagem da porta', async () => {
  await db.exec(`INSERT INTO produto_colecoes VALUES ('${id(5)}','Bándeja',NULL,true)`);
  expect((await client.rpc('fn_catalogo_dimensao_renomear', { p_kind: 'colecao', p_id: id(3), p_para: 'Bandeja', p_cods: ['01569', '01570'], p_quem: quem })).data).toEqual({ renomeado: false, motivo: 'destino_existe' });
});
test.each(['grupo', 'colecao'] as const)('inativar %s com produto é recusado', async kind => {
  expect(await adjustCatalogDimension(client, { quem, acao: 'inativar_se_vazio', kind, nome: kind === 'grupo' ? 'Travessa' : 'Antiga', ...(kind === 'grupo' ? { categoria_id: id(10) } : {}) })).toEqual({ ok: true, inativado: false, motivo: 'tem_produtos' });
});
test('cor usada só por products.cor, mesmo produto inativo, não inativa', async () => {
  await db.exec(`UPDATE products SET cor='Verde' WHERE cod_cadastro='01570'`);
  expect(await adjustCatalogDimension(client, { quem, acao: 'inativar_se_vazio', kind: 'cor', nome: 'Vérde' })).toEqual({ ok: true, inativado: false, motivo: 'tem_produtos' });
});
test('cor usada pelo cor_id não inativa', async () => {
  await db.exec(`UPDATE products SET cor_nome='Verde' WHERE cod_cadastro='01569'`);
  expect(await adjustCatalogDimension(client, { quem, acao: 'inativar_se_vazio', kind: 'cor', nome: 'Verde' })).toMatchObject({ inativado: false, motivo: 'tem_produtos' });
});
test('inativa dimensão vazia, audita e repetição retorna ja_inativo', async () => {
  const body = { quem, acao: 'inativar_se_vazio' as const, kind: 'cor' as const, nome: 'Verde' };
  expect(await adjustCatalogDimension(client, body)).toEqual({ ok: true, inativado: true, id: id(4) });
  expect((await db.query('SELECT ativo FROM produto_cores')).rows).toEqual([{ ativo: false }]);
  expect((await db.query('SELECT acao FROM catalog_audit')).rows).toEqual([{ acao: 'desativado' }]);
  expect(await adjustCatalogDimension(client, body)).toEqual({ ok: true, inativado: false, motivo: 'ja_inativo' });
});
test.each(['grupo', 'colecao'] as const)('inativa %s vazio no escopo correto', async kind => {
  await db.exec(kind === 'grupo'
    ? `INSERT INTO produto_grupos VALUES ('${id(5)}','Vazio','${id(10)}',true)`
    : `INSERT INTO produto_colecoes VALUES ('${id(5)}','Vazio','Descrição',true)`);
  expect(await adjustCatalogDimension(client, { quem, acao: 'inativar_se_vazio', kind, nome: 'Vazio', ...(kind === 'grupo' ? { categoria_id: id(10) } : {}) })).toEqual({ ok: true, inativado: true, id: id(5) });
});
test('nome não encontrado não grava', async () => {
  expect(await adjustCatalogDimension(client, { ...renameBody(), de: 'Ausente' })).toMatchObject({ renomeado: false, motivo: 'nao_encontrado' });
  expect(await adjustCatalogDimension(client, { quem, acao: 'inativar_se_vazio', kind: 'cor', nome: 'Ausente' })).toMatchObject({ inativado: false, motivo: 'nao_encontrado' });
});
test('token inválido retorna 401 sem gravação', async () => {
  const before = await snapshot();
  expect((await handle(renameBody(), 'bad-token')).status).toBe(401);
  expect(await snapshot()).toEqual(before);
});
test('grupo exige categoria, corpo strict e lista limitada a 1..2000', async () => {
  expect((await handle({ ...renameBody(), categoria_id: undefined })).status).toBe(400);
  expect(catalogDimensionAdjustmentBodySchema.safeParse({ ...renameBody(), extra: true }).success).toBe(false);
  expect(catalogDimensionAdjustmentBodySchema.safeParse({ ...renameBody(), cod_cadastros: [] }).success).toBe(false);
  expect(catalogDimensionAdjustmentBodySchema.safeParse({ ...renameBody(), cod_cadastros: Array(2000).fill('01569') }).success).toBe(true);
  expect(catalogDimensionAdjustmentBodySchema.safeParse({ ...renameBody(), cod_cadastros: Array(2001).fill('01569') }).success).toBe(false);
});
test('chave SQL segue acentos, pontuação, palavra e e ordem', async () => {
  const keys = await db.query(`SELECT fn_catalogo_dimension_key('Butterfly - B&W') = fn_catalogo_dimension_key('Butterfly -B&W') AS butterfly,
    fn_catalogo_dimension_key('Pink & Cristal') = fn_catalogo_dimension_key('Pink Cristal') AS pink,
    fn_catalogo_dimension_key('Azul e Amarelo') <> fn_catalogo_dimension_key('Amarelo e Azul') AS ordem`);
  expect(keys.rows).toEqual([{ butterfly: true, pink: true, ordem: true }]);
});
test('RPCs não podem ser executadas por anon ou authenticated', async () => {
  expect((await db.query(`SELECT has_function_privilege('anon','fn_catalogo_dimensao_renomear(text,uuid,text,text[],jsonb)','EXECUTE') AS anon,
    has_function_privilege('authenticated','fn_catalogo_dimensao_inativar_se_vazio(text,uuid,jsonb)','EXECUTE') AS authenticated,
    has_function_privilege('service_role','fn_catalogo_dimensao_renomear(text,uuid,text,text[],jsonb)','EXECUTE') AS integration`)).rows).toEqual([{ anon: false, authenticated: false, integration: true }]);
  expect((await db.query(`SELECT has_function_privilege('anon','fn_catalogo_dimensao_renomear(text,uuid,text,text[],jsonb,boolean)','EXECUTE') AS anon,
    has_function_privilege('authenticated','fn_catalogo_dimensao_renomear(text,uuid,text,text[],jsonb,boolean)','EXECUTE') AS authenticated`)).rows).toEqual([{ anon: false, authenticated: false }]);
});