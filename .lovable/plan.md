# V7 — Divisão de Carrinho: Pedido Firme + Provisão Futura

## Objetivo
Quando o carrinho mistura itens "em estoque" e itens com previsão (ex: "Prev. Jun 2026"), separar automaticamente em **Pedido Firme** (faturável, com todas as regras comerciais) e **Provisão Futura** (rascunho sem cálculo comercial, salvo para acompanhamento).

---

## 1. Tipos e classificação

**Novo arquivo `src/types/provisao.ts`:**
- `ProvisaoFutura` (id `P0001`, vendedor, cliente snapshot, itens, datasPrevisao, proximaPrevisao, status, totalReferencia, pedidoFirmeId opcional, observacoes)
- `ItemProvisao` (sku, nome, coleção, cor, tamanho, quantidade, precoAtacadoReferencia, statusEstoque, previsaoData)
- `StatusProvisao`: `aguardando_estoque | estoque_liberado | convertido_em_pedido | cancelado`

**`src/lib/classifyItem.ts`:**
- `classificarItem(statusEstoque)` → `'firme' | 'provisao'` (apenas `em estoque` = firme)
- `extrairDataPrevisao(status)` → "Jun 2026" (regex `Prev. <mês> <ano>`)

---

## 2. Store de provisões

**`src/store/provisaoStore.ts`** (zustand + persist `fetely_provisoes_v1`):
- `provisoes: ProvisaoFutura[]`
- `counter: number` (persistido em `fetely_provisao_counter`)
- `createProvisao(input)` → gera ID `P` + zero-pad 4 dígitos
- `updateStatus(id, status)`
- `setObservacoes(id, txt)`
- `cancelar(id)`
- Hook `useVisibleProvisoes()` — admin/master vê todas, vendedor só as próprias

---

## 3. Carrinho (split visual + comercial)

**`src/routes/cart.tsx`:**
- Computar `itensFirmes` e `itensProvisao` via `classificarItem`
- Banner topo quando ambos existem ("Carrinho misto detectado")
- Renderizar dois blocos:
  - **Pedido Firme** — agrupado por coleção como hoje, com `QuantityInput`/remover/comercial
  - **Provisão Futura** — bg `#0F0F0F`, opacidade reduzida, badge âmbar com previsão, aviso "Não faturado / sem desconto", subtotal de referência
- Passar **apenas itens firmes** ao `CartCommercialPanel` (novo prop `items`)
- Validações:
  - 100% provisão → bloquear "Confirmar pedido", oferecer "Salvar como Provisão"
  - Firme < mínimo → mensagem específica explicando que provisão não conta

**`src/components/cart/CartCommercialPanel.tsx`:** aceitar `items: CartItem[]` opcional e usar para o cálculo bruto (fallback ao comportamento atual). Substituir `cartTotal(items)` da page por `cartTotal(itensFirmes)`.

---

## 4. Confirmação do pedido misto

**`src/routes/cart.tsx` → handleConfirm:**
- Se há itens de provisão, abrir modal de confirmação final com os dois cards (Pedido Firme #ID temporário + Provisão Futura)
- Ao confirmar:
  1. `saveOrder(commercial)` apenas com itens firmes → para isso, temporariamente filtrar items, ou aceitar `saveOrder(commercial, itemsOverride?)`
  2. `createProvisao({ itens: provisaoItens, clienteSnapshot, pedidoFirmeId: order.id, ... })`
  3. Limpar carrinho, ir para `/confirmation?id=...&provisaoId=...`

**`src/store/orderStore.ts`:**
- `saveOrder(commercial?, itemsOverride?)` — usa override se passado, senão `state.items`
- Após save, limpa apenas os itens consumidos (firmes) — chamada de `clearCart()` continua na page

**`src/routes/confirmation.tsx`:** exibir bloco extra "Provisão Futura #Pxxxx" quando search param `provisaoId` presente, com link para `/provisoes/$id`.

---

## 5. Caso 100% provisão

Botão "Salvar como Provisão" → abre `ClienteSelector` se não houver cliente, depois `createProvisao` sem `pedidoFirmeId`, limpa carrinho, navega para `/provisoes`.

---

## 6. Módulo de Provisões

**`src/routes/provisoes.tsx`** (lista):
- Tabs status: Aguardando estoque / Estoque liberado / Todas
- Tabela: #, Cliente, Itens, Próxima previsão, Ref R$, Status
- Click → drawer/sheet com ficha

**`src/routes/provisoes.$id.tsx`** (ou sheet inline):
- Itens com status atual (re-leitura de `products`), valor referência, alerta se preço mudou
- Observações editáveis
- Botões:
  - **Converter em Pedido** (sempre disponível; destaque visual quando `estoque_liberado`) → popula carrinho via `useOrder.addBulk`, navega `/cart`, marca provisão como `convertido_em_pedido` apenas após confirmação do pedido (via metadata no carrinho `meta.provisaoOrigemId`)
  - **Cancelar provisão** (confirm dialog)
  - **Admin/master**: "Marcar estoque como liberado"

**Header/BottomNav:** adicionar item "Provisões" no menu.

---

## 7. Conversão provisão → pedido

- `useOrder.setMeta({ provisaoOrigemId: id })`
- Ao salvar pedido, se `meta.provisaoOrigemId`, chamar `useProvisao.getState().updateStatus(id, 'convertido_em_pedido')` e gravar `pedidoFirmeId`
- Banner amarelo no carrinho enquanto `provisaoOrigemId` ativo

---

## 8. Dashboard (V5)

**`src/routes/index.tsx`** (se já existe seção dashboard): novo card "Provisões em aberto" — totais, próximas liberações por mês, contagem `estoque_liberado`, link para `/provisoes`. Respeita isolamento por vendedor.

---

## Arquivos

**Novos:**
- `src/types/provisao.ts`
- `src/lib/classifyItem.ts`
- `src/store/provisaoStore.ts`
- `src/components/cart/MixedCartBanner.tsx`
- `src/components/cart/ProvisaoSection.tsx`
- `src/components/cart/FinalConfirmModal.tsx`
- `src/routes/provisoes.tsx`
- `src/routes/provisoes.$id.tsx`

**Editados:**
- `src/routes/cart.tsx` — split, modal, fluxo
- `src/components/cart/CartCommercialPanel.tsx` — aceitar items
- `src/store/orderStore.ts` — `saveOrder` aceita override; `OrderMeta.provisaoOrigemId`
- `src/types/index.ts` — campo `provisaoOrigemId` em `OrderMeta`
- `src/routes/confirmation.tsx` — exibir provisão gerada
- `src/components/layout/Header.tsx` + `BottomNav.tsx` — link "Provisões"
- `src/routes/index.tsx` — card dashboard de provisões (se aplicável)

## Notas técnicas
- IDs `P0001+` via counter persistido
- Valores de referência sempre `precoAtacado` puro
- Isolamento por `vendedorId` igual a pedidos
- Cor de provisão: `bg-[#0F0F0F]` + badge âmbar (`bg-stock-pre` se existir, senão `bg-amber-500/15 text-amber-300`)
