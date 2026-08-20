UPDATE public.products
SET cod_cadastro = lpad(cod_cadastro, 5, '0'),
    ean = lpad(ean, 13, '0')
WHERE (colecao ILIKE '%halloween%' OR colecao ILIKE '%fairytale%')
  AND (length(cod_cadastro) = 4 OR length(ean) = 11);