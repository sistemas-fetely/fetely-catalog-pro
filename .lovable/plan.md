# Destravar campos na edição de produto (decisão D3 — Flavio 07/10/2026)

## Objetivo

No diálogo "Editar: <código>" (abas Hierarquia / Visual / Preços / Técnico) de **Gestão de Produtos**, todos os campos passam a ser editáveis por quem já tem permissão de editar produto. Somente a identidade continua travada: **SKU, Cód. Cadastro, EAN e DUN-14** — com a legenda "emitido pelo cartório".

## Como funciona hoje

O travamento é centralizado em `src/routes/admin.products.tsx`:
- `donoDe(campo)` consulta a matriz `produto_fase_ficha` (via `useFichaDonos`) e devolve o dono do campo; qualquer dono diferente de `thomer` trava o campo.
- `ro(campo)` aplica `disabled`/`readOnly` nos inputs, e o componente `Field` desenha o cadeado + legenda ("editado no SNCF — Ficha do Produto", "preenchido pelo sistema").
- Salvar já grava o produto inteiro em `products` via `upsertProduct` → `productToRow` (catalogStore) — ou seja, o caminho de gravação já existe e não muda.

## Mudanças

### 1. `src/routes/admin.products.tsx` — função `donoDe`

Reescrever a regra de titularidade dentro do diálogo de edição:

```text
CAMPOS_IDENTIDADE = sku, cod_cadastro, ean, dun
```

- Se o campo está em `CAMPOS_IDENTIDADE` → retorna `"cartorio"` (travado, com cadeado e legenda "emitido pelo cartório").
- Qualquer outro campo → retorna `undefined` (editável), independentemente do dono na matriz.
- O comportamento de "falha fecha" (erro/carregando) passa a valer só para os 4 campos de identidade — os demais ficam editáveis mesmo sem o mapa carregado.
- Remover o aviso de erro "Não foi possível carregar as permissões de edição" se ele deixar de fazer sentido, ou mantê-lo apenas afetando os campos de identidade (decisão na implementação: manter o aviso, pois ainda governa a identidade).

Nada mais muda na tela: o mecanismo `ro()`/`Field` continua o mesmo, só a fonte da decisão muda. Isso destrava automaticamente, nas quatro abas:

- **Hierarquia:** marca, categoria, departamento, grupo, tipo, coleção, família (e demais campos da aba)
- **Visual:** cor, estampa, tamanho, descrição etc.
- **Preços:** preço varejo, preço atacado, múltiplos, qtd x kit, tipo de embalagem
- **Técnico:** material, peso, largura, altura, profundidade, NCM, CEST, origem fiscal (select), origem produção

### 2. `src/lib/fichaDonos.ts` — legenda

Acrescentar em `NOTA_DONO`:

```text
cartorio: "emitido pelo cartório"
```

(O hook `useFichaDonos` e a matriz `produto_fase_ficha` continuam existindo — a tela de pendências da ficha no portão SNCF os usa. Não remover.)

### 3. Verificação do caminho de gravação

Confirmar que `productToRow` (catalogStore) já inclui todos os campos destravados no upsert em `products`. Se algum campo destravado não estiver no mapeamento (ex.: `origem_prod`, `cest`), incluí-lo — sem isso o campo seria editável na tela mas não gravaria.

## O que NÃO muda

- Permissão: a mesma de hoje (quem vê o botão Salvar / `Can` de edição de produto). Nenhuma permissão nova.
- Selects continuam com as mesmas opções (origem fiscal usa `produto_origens_fiscais`; grupo usa o datalist atual etc.); numéricos continuam `type="number"`.
- Fase continua fora do diálogo (publicar/despublicar segue pelo portão SNCF).
- Nenhum gatilho, migration ou edge function. O envio ao SNCF por evento permanece como está.
- SKU/código/EAN/DUN continuam travados.

## Verificação

- `bunx tsgo --noEmit` e build.
- Conferir no preview: abrir "Editar" de um produto e confirmar que material, peso, NCM, origem fiscal etc. estão editáveis, e que SKU/EAN/código/DUN seguem travados com a legenda nova.

## Arquivos alterados

- `src/routes/admin.products.tsx` (regra `donoDe` + conjunto de identidade)
- `src/lib/fichaDonos.ts` (legenda "emitido pelo cartório")
- `src/store/catalogStore.ts` (somente se algum campo destravado estiver faltando em `productToRow`)
