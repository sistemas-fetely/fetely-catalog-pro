## Metas & Pace do Mês — Time Interno

Nova tela acessada por botão na página de Pedidos. Acompanha meta mensal do time e ritmo por dias úteis, com detalhamento por vendedor interno.

### 1. Banco (migração Supabase)

**`meta_mensal`** — meta global por mês/ano
- `id uuid pk`, `ano int`, `mes int`, `meta_global numeric default 500000`
- `atualizado_por uuid`, `atualizado_em timestamptz default now()`
- `unique(ano, mes)`

**`meta_vendedor`** — meta individual
- `id uuid pk`, `ano int`, `mes int`, `vendedor_id uuid ref profiles(id)`, `meta numeric`
- `unique(ano, mes, vendedor_id)`

**GRANTs + RLS:**
- `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role`
- SELECT: qualquer `authenticated` com papel `admin`, `master` ou `vendedor` interno (`profiles.tipo_vendedor = 'interno'`). Representantes bloqueados.
- INSERT/UPDATE/DELETE: só `admin`/`master` (usar `is_admin_or_master`).
- Helper: função `public.is_vendedor_interno(uuid)` (SECURITY DEFINER) usada nas policies.

Realizado é derivado de `orders` (não persistir).

### 2. Controle de acesso (front + rota)

- Botão **"Metas & Pace"** na toolbar de `src/routes/orders.tsx`, visível quando `isAdminOrMaster()` OR (`role vendedor` AND `profile.tipo_vendedor === 'interno'`).
- Nova rota `src/routes/metas-pace.tsx` com `beforeLoad` verificando o mesmo predicado; se não passar, redirect para `/orders` com toast "Painel exclusivo do time interno de vendas".
- Adicionar entrada em `src/security/routeMap.ts` (`telaId: "metas_pace"`) — mas o gate primário é o beforeLoad + RLS.

### 3. Motor de pace (`src/lib/metasPace.ts`)

Funções puras:
- `diasUteisNoMes(ano, mes)`, `diasUteisDecorridos(ano, mes, hoje)`
- `calcularPace({ meta, realizado, ano, mes, hoje })` → retorna `{ diasUteisTotal, diasUteisDecorridos, diasUteisRestantes, fracUtil, idealAteHoje, projecaoFimMes, ratio, faltaPorDiaUtil, status }`
- `statusPace(ratio)` → `"adiantado" | "no_ritmo" | "atrasado"`
- `serieAcumuladaIdeal(ano, mes, meta)` para gráfico (degrau em fim de semana)
- `serieAcumuladaRealizado(pedidos, ano, mes)` — acumula por dia
- `serieProjecao(...)` — reta do ponto de hoje até fim do mês na taxa atual

### 4. Fonte do realizado

Query em `orders`: filtrar pelo mês/ano usando data de faturamento (usar `aprovado_em` quando existir, senão `created_at`; confirmar coluna real via `orders` — pedidos "confirmados/faturados", excluindo `cancelado`, `pendente_aprovacao`, `recusado`).

Agrupar por `vendedor_responsavel_id` (ou campo equivalente em orders). Pedidos sem vendedor → bucket "sem vendedor" sinalizado (não somado nas metas individuais, mas somado no time).

Server function `getMetasPaceData(ano, mes)` em `src/lib/metasPace.functions.ts` com `requireSupabaseAuth`:
- valida papel (admin/master/vendedor interno);
- carrega meta_mensal, meta_vendedor, lista de vendedores internos, agregado de pedidos do mês;
- retorna payload consolidado.

Server function `upsertMetaMensal(ano, mes, valor)` e `upsertMetaVendedor(ano, mes, vendedor_id, valor)` — só admin/master.

### 5. UI (`src/routes/metas-pace.tsx`)

Layout conforme spec, usando design tokens já existentes (paleta vinho/dourado/marfim já está no tema).

- **Cabeçalho:** título + seletor de mês (‹ Mês Ano ›), botão "Editar metas" (só admin).
- **5 cartões KPI:** Meta, Realizado (%), Pace (badge + detalhe), Projeção (+gap), Falta/dia útil.
- **Gráfico** (recharts, já no projeto): linhas Realizado (vinho), Ideal (dourado, step), Projeção (cinza tracejado), Meta (ReferenceLine tracejada), ReferenceLine "hoje".
- **Tabela por vendedor:** Vendedor · Meta · Realizado · % (mini progress) · Pace (badge) · Projeção · Falta/dia útil. Linha rodapé com totais. Linha extra "Sem vendedor" quando aplicável.
- **Modal "Editar metas"** (admin): input meta global + inputs por vendedor + aviso reconciliação (soma individuais vs global).
- **Vendedor interno:** sem botão editar, sem inputs.
- Nota fixa no rodapé.

### 6. Critérios de aceite

Cobre todos os itens listados na spec: botão + gate por papel, RLS bloqueando representante, meta default 500k editável, metas individuais + reconciliação, pace por dias úteis, KPIs/gráfico/tabela, realizado dos pedidos faturados com bucket "sem vendedor", modo somente-visualização para vendedor interno, seletor de mês com resultado final para meses fechados.

### Ordem de execução

1. Migração (`meta_mensal`, `meta_vendedor`, RLS, helper `is_vendedor_interno`).
2. Server functions (`getMetasPaceData`, `upsertMetaMensal`, `upsertMetaVendedor`).
3. Motor de pace (`src/lib/metasPace.ts`).
4. Rota `/metas-pace` + botão em `orders.tsx` + entrada no route map.
5. UI: KPIs → tabela → gráfico → modal edição.

### Pontos para confirmar antes de codar

- **Coluna de data de faturamento** em `orders`: uso `aprovado_em` (fallback `created_at`) e status ∈ {`confirmado`}? Ou existe um `faturado_em` / `status = 'faturado'` que devo usar?
- **Vendedor responsável no pedido**: qual campo em `orders` (ex.: `vendedor_id`, `vendedor_responsavel_id`)?

Se quiser, sigo com as suposições acima (aprovado_em + status confirmado; campo de vendedor conforme o schema atual) e ajusto se destoar.
