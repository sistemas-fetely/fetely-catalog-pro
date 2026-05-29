# V13 — Premissas Comerciais do Cliente

Adicionar condições comerciais homologadas por cliente (desconto fixo, frete garantido, condições preferenciais, faixa fixa, pedido mínimo, bônus PIX), aplicadas automaticamente em todo novo pedido.

## 1. Modelo de dados

`src/types/cliente.ts`
- Adicionar `PremissasComerciais` e `HistoricoPremissa` (conforme spec).
- Adicionar campo opcional `premissasComerciais?: PremissasComerciais` em `Cliente`.

## 2. Engine de cálculo

`src/lib/premissas.ts` (novo)
- `isPremissaVigente(inicio, fim)` — confere data atual contra vigência.
- `aplicarPremissas(faixaDetectada, premissas, condicaoTipo)` — devolve `{ faixaEfetiva, frete, descontoPercent, bonusPixPercent, pedidoMinimo, condicoesDisponiveis, premissasAplicadas }`.
- Regra de precedência: Premissa vigente → Faixa → Regras gerais.
- **Expiradas não aplicam** mas mantêm `premissasAtivas=true` (badge vermelho).

`src/lib/commercial.ts`
- Estender `calcularPedido` aceitando `cliente?: Cliente` opcional. Se cliente tem premissas vigentes, sobrepõe faixa/desconto/bonus.
- Manter API antiga funcional (cliente é opcional).

## 3. UI — Aba Comercial no cadastro

`src/components/clientes/PremissasComercialTab.tsx` (novo)
- 7 blocos com toggles conforme spec: Status+Vigência, Desconto homologado, Frete, Condições de pagamento, Faixa fixa, Pedido mínimo, Bônus PIX.
- Preview em tempo real do desconto (bloco 2).
- Modo readonly para vendedor (todos campos disabled + badge "🏅 Condições homologadas").
- Editável só para admin/master.
- Botão "Ver histórico" → dialog listando `historico[]`.
- Ao salvar: cria entrada em `historico` com diff de campos, grava em `clienteStore.upsertCliente`, toast.

`src/components/clientes/ClienteFormModal.tsx`
- Adicionar tab "Comercial" entre as existentes.

## 4. Integração no carrinho

`src/components/cart/CartCommercialPanel.tsx`
- Detectar `cliente.premissasComerciais` vigentes via `useOrder.meta.clienteId`.
- Se aplicadas: trocar título "Faixa X" por "✦ Condições Comerciais Homologadas" com badge dourado, exibir desconto homologado (substitui/acumula), bônus PIX personalizado, frete fixo, vigência.
- Senão: comportamento atual.

`src/store/orderStore.ts` (se necessário)
- Garantir que ao adicionar/recalcular o pedido, o cliente atual é passado para `calcularPedido`.

## 5. Alertas de expiração

`src/components/clientes/ClientesList.tsx` (ou onde a lista é renderizada em `clientes.tsx`)
- Badge âmbar `⚠ Premissas expiram em N dias` se faltam ≤30 dias.
- Badge vermelho `⛔ Premissas expiradas` se já passou e `premissasAtivas=true`.
- Badge dourado `🏅 Premissas ativas` quando vigentes.

Dashboard admin (se existir card de cliente, em `src/routes/index.tsx` ou settings): card "🏅 Premissas Comerciais" com 3 contadores. Pular se não houver dashboard relevante.

## 6. Exportação

`src/lib/exporter.ts`
- Se pedido tem `meta.cliente.premissasComerciais` aplicadas no momento da venda, adicionar seção "CONDIÇÕES COMERCIAIS APLICADAS" no PDF e CSV.

## 7. Snapshot no pedido

`src/store/orderStore.ts` + tipo do pedido
- Ao confirmar pedido, salvar snapshot `premissasAplicadas` no order para auditoria.

## Arquivos tocados

- src/types/cliente.ts (estender)
- src/lib/premissas.ts (novo)
- src/lib/commercial.ts (estender `calcularPedido`)
- src/components/clientes/PremissasComercialTab.tsx (novo)
- src/components/clientes/ClienteFormModal.tsx (nova aba)
- src/components/clientes/ClientesList.tsx (badges expiração)
- src/components/cart/CartCommercialPanel.tsx (badge + bloco homologadas)
- src/lib/exporter.ts (seção no PDF/CSV)
- src/store/orderStore.ts (snapshot)

## Notas

- Modo negociação continua somando ao desconto pós-premissas.
- Portal do cliente (V12) não é tocado — premissas são internas.
- Histórico imutável: append-only, sem delete.
- Dados ficam dentro de `Cliente` em `fetely_clientes` (localStorage), sem nova chave de store.

Aprovar para implementar?
