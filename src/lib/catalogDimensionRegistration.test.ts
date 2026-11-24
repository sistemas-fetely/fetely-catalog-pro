// @ts-ignore Bun supplies the test runner
import { expect, test } from 'bun:test';
import { registerCatalogDimension } from './catalogDimensionRegistration';
import { handleCatalogDimensionRegistration } from './catalogDimensionRegistrationHandler';
import type { CatalogClient } from './catalogProductPersistence';
import type { CatalogRow } from './catalogSpreadsheet';
import { createCatalogDimensionValue } from './catalogProductPersistence';

const quem = { id: 'd9ba28af-7398-45f9-b04e-db458c9aa65d', nome: 'Operador SNCF' };
const categoriaId = 'b16239f5-91d1-4f1c-948a-c8f8f872a20f';

function fakeClient(initial: Partial<Record<'grupo' | 'colecao' | 'cor', CatalogRow[]>> = {}) {
  const rows = {
    grupo: [...(initial.grupo ?? [])],
    colecao: [...(initial.colecao ?? [])],
    cor: [...(initial.cor ?? [])],
  };
  const audits: CatalogRow[] = [];
  const tableKind = { produto_grupos: 'grupo', produto_colecoes: 'colecao', produto_cores: 'cor' } as const;

  const client = {
    auth: { getUser: async () => ({ data: { user: { id: quem.id, email: 'operador@example.test' } }, error: null }) },
    rpc: async (name: string) => name === 'get_vault_secret'
      ? { data: 'expected-test-token', error: null }
      : { data: null, error: { message: 'RPC inesperada' } },
    from(table: string) {
      if (table === 'catalog_audit') {
        return { insert: async (value: CatalogRow) => { audits.push(value); return { error: null }; } };
      }
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
      }
      if (table === 'produto_canal_dim') return { select: async () => ({ data: [], error: null }) };
      if (table === 'produto_categorias') {
        return { select: async () => ({ data: [{ id: categoriaId, nome: 'Categoria' }], error: null }) };
      }
      const kind = tableKind[table as keyof typeof tableKind];
      if (!kind) throw new Error(`Tabela inesperada: ${table}`);
      return {
        select: async () => ({ data: rows[kind].map(row => ({ ...row })), error: null }),
        update(value: CatalogRow) {
          return { eq: (_field: string, id: string) => ({ select: () => ({ single: async () => {
            const row = rows[kind].find(row => row['id'] === id);
            if (!row) return { data: null, error: { message: 'Não encontrado' } };
            Object.assign(row, value);
            return { data: { ...row }, error: null };
          } }) }) };
        },
        insert(value: CatalogRow) {
          return {
            select: () => ({
              single: async () => {
                const created = { id: `${kind}-${rows[kind].length + 1}`, ...value };
                rows[kind].push(created);
                return { data: created, error: null };
              },
            }),
          };
        },
      };
    },
  } as unknown as CatalogClient;
  return { client, rows, audits };
}

function request(body: unknown, token = 'expected-test-token') {
  return new Request('http://localhost/api/public/catalogo-dimensao-cadastrar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('cria cor pela função compartilhada e registra autoria SNCF', async () => {
  const { client, rows, audits } = fakeClient();
  const result = await registerCatalogDimension(client, { quem, kind: 'cor', nome: 'Quadrillë' });
  expect(result).toEqual({ ok: true, criado: true, kind: 'cor', id: 'cor-1', nome: 'Quadrillë' });
  expect(rows.cor[0]).toMatchObject({ id: 'cor-1', nome: 'Quadrillë' });
  expect(audits).toHaveLength(1);
  expect(audits[0]).toMatchObject({ usuario_id: null, usuario_nome: quem.nome, acao: 'criado' });
  expect(audits[0]?.campos_alterados).toMatchObject({ origem: 'planilha_sharepoint', quem });
});

test('é idempotente com caixa e acento diferentes e não grava auditoria', async () => {
  const { client, rows, audits } = fakeClient({ cor: [{ id: 'cor-existente', nome: 'Quadrillë' }] });
  const result = await registerCatalogDimension(client, { quem, kind: 'cor', nome: 'QUADRILLE' });
  expect(result).toEqual({ ok: true, criado: false, kind: 'cor', id: 'cor-existente', nome: 'Quadrillë' });
  expect(rows.cor).toHaveLength(1);
  expect(audits).toHaveLength(0);
});

test('grupo sem categoria_id retorna 400', async () => {
  const { client } = fakeClient();
  const response = await handleCatalogDimensionRegistration(request({ quem, kind: 'grupo', nome: 'Prato' }), async () => client);
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ ok: false, erro: 'Corpo inválido' });
});
test('cadastro compartilhado resolve Pink & Cristal sem duplicar cor', async () => {
  const { client, rows, audits } = fakeClient({ cor: [{ id: 'pink', nome: 'Pink Cristal' }] });
  expect(await registerCatalogDimension(client, { quem, kind: 'cor', nome: 'Pink & Cristal' })).toEqual({ ok: true, criado: false, kind: 'cor', id: 'pink', nome: 'Pink Cristal' });
  expect(rows.cor).toHaveLength(1);
  expect(audits).toHaveLength(0);
});

test('token inválido retorna 401', async () => {
  const { client, rows, audits } = fakeClient();
  const response = await handleCatalogDimensionRegistration(
    request({ quem, kind: 'colecao', nome: 'Quadrillë' }, 'invalid-test-token'),
    async () => client,
  );
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ ok: false, erro: 'Token inválido' });
  expect(rows.colecao).toHaveLength(0);
  expect(audits).toHaveLength(0);
});
for (const kind of ['grupo', 'colecao', 'cor'] as const) {
  test(`${kind}: ativa vence inativa equivalente sem gravar`, async () => {
    const category = kind === 'grupo' ? { categoria_id: categoriaId } : {};
    const { client, rows, audits } = fakeClient({ [kind]: [
      { id: 'inativa', nome: 'Pink & Cristal', ativo: false, ...category },
      { id: 'ativa', nome: 'Pink Cristal', ativo: true, ...category },
    ] });
    expect(await registerCatalogDimension(client, { quem, kind, nome: 'Pink & Cristal', ...category })).toMatchObject({ id: 'ativa', nome: 'Pink Cristal', criado: false });
    expect(rows[kind]).toHaveLength(2);
    expect(audits).toHaveLength(0);
  });
  test(`${kind}: só inativa reativa o mesmo id sem duplicar e audita SNCF`, async () => {
    const category = kind === 'grupo' ? { categoria_id: categoriaId } : {};
    const { client, rows, audits } = fakeClient({ [kind]: [{ id: 'inativa', nome: 'Pink Cristal', ativo: false, ...category }] });
    expect(await registerCatalogDimension(client, { quem, kind, nome: 'Pink & Cristal', ...category })).toMatchObject({ id: 'inativa', nome: 'Pink Cristal', criado: false });
    expect(rows[kind]).toHaveLength(1);
    expect(rows[kind][0]?.['ativo']).toBe(true);
    expect(audits[0]).toMatchObject({ acao: 'reativado', campos_alterados: { ativo: { antes: false, depois: true }, origem: 'planilha_sharepoint', quem } });
    expect(audits).toHaveLength(1);
  });
}
test('reativação manual registra usuário e mantém lista sem duplicação', async () => {
  const { client, rows, audits } = fakeClient({ colecao: [{ id: 'antiga', nome: 'Butterfly -B&W', ativo: false }] });
  const lists = { grupo: [], colecao: [{ id: 'antiga', nome: 'Butterfly -B&W', ativo: false }], cor: [], categorias: [], canais: [] };
  expect(await createCatalogDimensionValue(client, { kind: 'colecao', nome: 'Butterfly - B&W' }, lists)).toMatchObject({ id: 'antiga', ativo: true, criado: false });
  expect(rows.colecao).toHaveLength(1);
  expect(lists.colecao).toEqual([{ id: 'antiga', nome: 'Butterfly -B&W', ativo: true }]);
  expect(audits[0]).toMatchObject({ acao: 'reativado', campos_alterados: { origem: 'planilha', quem: { id: quem.id, nome: 'operador@example.test' } } });
});
test('grupo inativo de outra categoria não é reativado', async () => {
  const { client, rows } = fakeClient({ grupo: [{ id: 'outra', nome: 'Bandeja', ativo: false, categoria_id: 'outra-categoria' }] });
  expect(await registerCatalogDimension(client, { quem, kind: 'grupo', nome: 'Bandeja', categoria_id: categoriaId })).toMatchObject({ criado: true });
  expect(rows.grupo).toHaveLength(2);
  expect(rows.grupo[0]?.['ativo']).toBe(false);
});
