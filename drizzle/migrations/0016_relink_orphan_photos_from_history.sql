WITH ren AS (
  SELECT DISTINCT p.colecao, a.campos_alterados->'cor_nome'->>'antes' antigo, p.cor_nome novo
  FROM catalog_audit a JOIN products p ON p.sku = a.produto_sku
  WHERE a.campos_alterados ? 'cor_nome' AND p.cor_nome IS NOT NULL
)
UPDATE photos ph SET cor = r.novo
FROM ren r
WHERE ph.kind='produto' AND ph.colecao=r.colecao AND ph.cor=r.antigo
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.colecao=ph.colecao AND (p.sku=ph.cor OR p.cor_nome=ph.cor))
  AND NOT EXISTS (SELECT 1 FROM photos x WHERE x.kind='produto' AND x.colecao=ph.colecao AND x.cor=r.novo)
  AND (SELECT count(DISTINCT r2.novo) FROM ren r2 WHERE r2.colecao=r.colecao AND r2.antigo=r.antigo)=1;

UPDATE photos ph SET cor = p.sku
FROM products p
WHERE ph.kind='produto' AND p.colecao=ph.colecao AND ph.cor LIKE '%/%'
  AND split_part(p.sku,'/',2) <> '' AND split_part(p.sku,'/',2) = split_part(ph.cor,'/',2)
  AND NOT EXISTS (SELECT 1 FROM products q WHERE q.colecao=ph.colecao AND (q.sku=ph.cor OR q.cor_nome=ph.cor))
  AND NOT EXISTS (SELECT 1 FROM photos x WHERE x.kind='produto' AND x.colecao=ph.colecao AND x.cor=p.sku);