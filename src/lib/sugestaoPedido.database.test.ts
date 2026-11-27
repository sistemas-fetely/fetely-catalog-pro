import { afterAll, beforeAll, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE pre_selecoes(id text);
    CREATE TABLE orders(id text PRIMARY KEY,cliente_id uuid,created_at timestamptz,reprovado boolean);
    CREATE TABLE order_items(order_id text,product_id uuid,sku text,quantity int,preco_unit_override numeric,preco_unit_atacado numeric);
    CREATE TABLE products(id uuid PRIMARY KEY,sku text,cod_cadastro text,nome_comercial text,colecao text,grupo text,categoria text,cor_nome text,cor text,tamanho_numero text,tamanho_ref text,linha text,qtd_kit int,preco_varejo numeric,multiplos int,preco_atacado numeric,status_estoque text,pronta_entrega boolean,is_vela_numerica boolean,numero_vela int,ativo boolean);
    CREATE TABLE faixas(nome text,valor_min numeric,valor_max numeric,desconto_celebra numeric,frete text,ativa boolean);
    CREATE TABLE evento_catalogo(sessao_id uuid,tipo text,valor_parcial numeric,itens_parcial int,campos_preenchidos jsonb);
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY; ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
  `);
  await db.exec(readFileSync("drizzle/migrations/0022_public_order_suggestions.sql", "utf8"));
  await db.exec(
    readFileSync("drizzle/migrations/0023_suggestion_catalog_preserve_product_fields.sql", "utf8"),
  );
  await db.exec(`INSERT INTO products(id,sku,colecao,grupo,categoria,multiplos,preco_atacado,ativo,status_estoque) VALUES
    ('00000000-0000-4000-8000-000000000001','NOVO','Mesa','Prato','Celebrar à Mesa',12,10,true,'Disponível'),
    ('00000000-0000-4000-8000-000000000002','ANTIGO','Cristal','Taça','Celebrar à Mesa',12,10,true,'Esgotado');
    INSERT INTO orders VALUES('recente','00000000-0000-4000-8000-000000000010',now(),false),('antigo','00000000-0000-4000-8000-000000000011',now()-interval '100 days',NULL),('reprovado','00000000-0000-4000-8000-000000000012',now(),true);
    INSERT INTO order_items VALUES('recente','00000000-0000-4000-8000-000000000001','SKU-ANTERIOR',12,5,10),('recente','00000000-0000-4000-8000-000000000002','ANTIGO',12,NULL,10),('antigo','00000000-0000-4000-8000-000000000001','SKU-ANTERIOR',12,NULL,10),('reprovado','00000000-0000-4000-8000-000000000001','SKU-ANTERIOR',1000,NULL,10);
    INSERT INTO faixas VALUES('Convidado',1000,4999.99,0,'FOB',true),('Reservada',100000,NULL,15,'CIF',false);
  `);
}, 30000);
afterAll(() => db.close());
test("ranking exclui reprovados, usa preço override e agrupa SKU atual por product_id", async () => {
  const { rows } = await db.query<{
    sku: string;
    receita: string;
    unidades_vendidas: number;
    pedidos_distintos: number;
    clientes_distintos: number;
    caixas_medias_por_pedido: string;
  }>(`SELECT * FROM public_ranking_vendas() WHERE sku='NOVO'`);
  expect(rows[0]?.sku).toBe("NOVO");
  expect(Number(rows[0]?.receita)).toBe(180);
  expect(Number(rows[0]?.unidades_vendidas)).toBe(24);
  expect(Number(rows[0]?.pedidos_distintos)).toBe(2);
  expect(Number(rows[0]?.clientes_distintos)).toBe(2);
  expect(Number(rows[0]?.caixas_medias_por_pedido)).toBe(1);
});
test("recência pesa últimos 90 dias e score normalizado fica 0–100", async () => {
  const { rows } = await db.query<{
    sku: string;
    score_popularidade: string;
    score_recencia: string;
  }>("SELECT * FROM public_ranking_vendas()");
  expect(Number(rows.find((r) => r.sku === "NOVO")?.score_popularidade)).toBe(100);
  expect(Number(rows.find((r) => r.sku === "NOVO")?.score_recencia)).toBe(50);
  expect(Number(rows.find((r) => r.sku === "ANTIGO")?.score_popularidade)).toBe(75);
});
test("participação histórica do grupo é proporcional à receita", async () => {
  const { rows } = await db.query<{ participacao_receita_grupo: string }>(
    `SELECT participacao_receita_grupo FROM public_ranking_vendas() WHERE sku='NOVO'`,
  );
  expect(Number(rows[0]?.participacao_receita_grupo)).toBeCloseTo(0.6);
});
test("afinidade conta uma combinação por pedido sem nomes de clientes", async () => {
  const { rows } = await db.query<Record<string, unknown>>(
    "SELECT * FROM public_afinidade_colecoes()",
  );
  expect(rows).toHaveLength(1);
  expect(Number(rows[0]?.["pedidos_juntos"])).toBe(1);
  expect(Object.keys(rows[0] ?? {}).sort()).toEqual(
    ["colecao_a", "colecao_b", "grupo_a", "grupo_b", "pedidos_juntos", "score_afinidade"].sort(),
  );
});
test("anon executa agregados mas não lê orders/order_items", async () => {
  await db.exec("SET ROLE anon");
  try {
    const { rows } = await db.query<Record<string, unknown>>(
      "SELECT * FROM public_ranking_vendas()",
    );
    expect(rows.length).toBe(2);
    expect(rows.some((r) => "cliente_id" in r || "order_id" in r)).toBe(false);
    await expect(db.query("SELECT * FROM orders")).rejects.toThrow("permission denied");
    await expect(db.query("SELECT * FROM order_items")).rejects.toThrow("permission denied");
  } finally {
    await db.exec("RESET ROLE");
  }
});
test("catálogo público só retorna produtos ativos, preço atacado e não esgotados", async () => {
  const { rows } = await db.query<{ dados: { sku: string }[] }>(
    "SELECT public_catalogo_sugestao() dados",
  );
  expect(rows[0]?.dados.map((p) => p.sku)).toEqual(["NOVO"]);
});
test("faixas públicas omitem configuração e faixas inativas", async () => {
  const { rows } = await db.query<Record<string, unknown>>(
    "SELECT * FROM public_faixas_sugestao()",
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]?.["nome"]).toBe("Convidado");
  expect(Object.keys(rows[0] ?? {})).toHaveLength(5);
});
test("eventos da sugestão guardam preferências sem abrir INSERT público", async () => {
  await db.exec("SET ROLE anon");
  try {
    await db.query(
      `SELECT public_emit_evento_catalogo('00000000-0000-4000-8000-000000000020','sugestao_gerada',2500,20,'{"investimento":2500}')`,
    );
  } finally {
    await db.exec("RESET ROLE");
  }
  const { rows } = await db.query<{ tipo: string; campos_preenchidos: { investimento: number } }>(
    "SELECT * FROM evento_catalogo",
  );
  expect(rows[0]?.tipo).toBe("sugestao_gerada");
  expect(rows[0]?.campos_preenchidos.investimento).toBe(2500);
});
