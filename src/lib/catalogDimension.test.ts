// @ts-ignore Bun supplies the test runner
import { expect, test } from 'bun:test';
import { catalogDimensionBodySchema, createCatalogDimension } from './catalogDimension';
import { handleCatalogDimension } from './catalogDimensionHandler';
import type { CatalogClient } from './catalogProductPersistence';
import type { CatalogRow } from './catalogSpreadsheet';

const quem = { id: 'd9ba28af-7398-45f9-b04e-db458c9aa65d', nome: 'Operador SNCF' };

function fakeClient(initial: CatalogRow[] = []) {
  const rows: CatalogRow[] = initial.map(row => ({ ...row }));
  const audits: CatalogRow[] = [];
  const client = {
    from(table: string) {
      if (table === 'produto_colecoes') {
        return {
          select: async () => ({ data: rows.map(({ id, nome }) => ({ id, nome })), error: null }),
          insert(value: CatalogRow) {
            const created = { id: 'colecao-1', ...value };
            rows.push(created);
            return {
              select: () => ({
                single: async () => ({ data: { id: created.id, nome: created.nome }, error: null }),
              }),
            };
          },
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        };
      }
      if (table === 'catalog_audit') {
        return {
          insert: async (value: CatalogRow) => {
            audits.push(value);
            return { error: null };
          },
        };
      }
      throw new Error(`Tabela inesperada: ${table}`);
    },
  } as unknown as CatalogClient;
  return { client, rows, audits };
}

test('cria coleção ativa preservando caixa e acentos e registra auditoria', async () => {
  const { client, rows, audits } = fakeClient();
  const result = await createCatalogDimension(client, { dimensao: 'colecao', nome: '  Quadrillë  ', quem });
  expect(result).toEqual({ ok: true, id: 'colecao-1', nome: 'Quadrillë', criada: true });
  expect(rows[0]).toMatchObject({ nome: 'Quadrillë', ativo: true });
  expect(audits).toHaveLength(1);
  expect(audits[0]).toMatchObject({ usuario_id: null, usuario_nome: quem.nome, acao: 'criado' });
  expect(audits[0]?.campos_alterados).toMatchObject({ origem: 'planilha_sharepoint', quem });
});

test('é idempotente ignorando caixa, acentos e espaços extras sem gravar auditoria', async () => {
  const { client, rows, audits } = fakeClient([{ id: 'existente', nome: 'Quadrillë', ativo: true }]);
  const result = await createCatalogDimension(client, { dimensao: 'colecao', nome: '  QUADRILLE   ', quem });
  expect(result).toEqual({ ok: true, id: 'existente', nome: 'Quadrillë', criada: false });
  expect(rows).toHaveLength(1);
  expect(audits).toHaveLength(0);
});

test('recusa nome inválido', () => {
  expect(catalogDimensionBodySchema.safeParse({ dimensao: 'colecao', nome: ' A ', quem }).success).toBe(false);
  expect(catalogDimensionBodySchema.safeParse({ dimensao: 'colecao', nome: 'A'.repeat(61), quem }).success).toBe(false);
});

test('recusa dimensão diferente de coleção', () => {
  expect(catalogDimensionBodySchema.safeParse({ dimensao: 'cor', nome: 'Verde', quem }).success).toBe(false);
});

test('recusa chamada sem token antes de acessar o banco', async () => {
  const response = await handleCatalogDimension(new Request('http://localhost/api/public/catalogo-dimensao-criar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dimensao: 'colecao', nome: 'Quadrillë', quem }),
  }));
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ erro: 'Token inválido' });
});
