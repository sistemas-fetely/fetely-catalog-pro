# Snapshot de preço + Override por item

## Diagnóstico — o que já funciona

Boa parte do snapshot **já existe** no projeto:

- **`order_items`** já grava `preco_unit_atacado` (preço congelado) e `product_snapshot` (jsonb do produto inteiro) no momento do insert.
- **`cotacoes.items`** (jsonb) já guarda o `product` completo com `precoAtacado` dentro de cada item — quando você reabre uma cotação, ela lê o preço do snapshot, não o preço vigente. O `ConverterEmPedidoModal` inclusive já carrega `precoAtacadoReferencia` para detectar reajustes.

Ou seja: **cotações e pedidos antigos já estão protegidos** contra reajuste futuro de preços. Não precisa migração nem mudança de fluxo nesse ponto.

O que falta é (a) garantir que ao **converter cotação em pedido** o snapshot da cotação prevaleça sobre o preço vigente, e (b) adicionar o **override por linha no modo negociação**.

## Escopo desta entrega

### 1. Override de preço/desconto por item (modo negociação)

**Tipos** — `src/types/index.ts` (CartItem ganha):
- `precoOverride?: number` — preço unitário manual
- `descontoItemPct?: number` — desconto extra por linha (0–100)
- `justificativaNegociacao?: string` — obrigatória quando qualquer override está ativo

**Store** — `src/store/orderStore.ts`:
- Ações: `setItemPrecoOverride`, `setItemDesconto`, `setItemJustificativa`, `clearItemNegociacao`
- Recalcular subtotal do item: `(precoOverride ?? precoAtacado) * qty * (1 - descontoItemPct/100)`
- `clearNegociacao` (ao desativar modo) limpa todos os overrides

**UI** — `src/routes/cart.tsx`:
- Quando `useNegotiation().ativo === true`, cada linha do carrinho mostra dois campos inline editáveis:
  - "Preço unit." (input numérico, default = preço de tabela)
  - "Desc. %" (input 0–100)
- Badge "Negociado" + tooltip com diferença vs. tabela
- Campo "Justificativa" (textarea pequena) obrigatório por item alterado — bloqueia confirmação se vazio
- Botão "Resetar item" volta ao preço de tabela

**Persistência** — migração adiciona a `order_items`:
- `preco_unit_override numeric NULL`
- `desconto_item_pct numeric NULL`
- `justificativa_negociacao text NULL`
- `preco_unit_efetivo numeric GENERATED` (calculado) — para queries

Em cotações, os mesmos campos vão dentro do jsonb `items` (sem migração de schema).

**Auditoria**:
- `negociacaoLog` já existe; estender `NegociacaoLog` com `overridesPorItem: Array<{sku, precoTabela, precoOverride, descontoPct, justificativa}>`.

### 2. Garantia de snapshot na conversão cotação → pedido

`ConverterEmPedidoModal` hoje recarrega produtos vigentes. Ajustar para:
- Usar `i.product.precoAtacado` (do snapshot da cotação) como preço base no novo pedido.
- Mostrar aviso visual se o preço vigente diverge do snapshot, mas **não recalcular automaticamente** (regra "congelar tudo" escolhida).

## Detalhes técnicos

**Cálculo do subtotal por item:**
```text
precoEfetivo = precoOverride ?? product.precoAtacado
subtotalItem = precoEfetivo * quantity * (1 - (descontoItemPct ?? 0) / 100)
```

O `CartCommercialPanel` (faixas, frete, bonus PIX) continua usando `subtotalBruto = Σ subtotalItem` — toda a régua comercial existente passa a operar sobre o bruto já negociado, sem mudança.

**Validação na confirmação do pedido:**
- Se houver override em alguma linha E `justificativaNegociacao` vazia → bloqueia + toast
- Se modo negociação não estiver ativo mas houver override → limpar overrides (defensivo)

**Permissão:**
- Override só liberado quando `useNegotiation().ativo === true` (já protegido por senha master)

## Arquivos afetados

- `src/types/index.ts` — campos novos em CartItem
- `src/store/orderStore.ts` — ações + recálculo
- `src/store/negotiationStore.ts` — extensão do log
- `src/routes/cart.tsx` — UI inline de override
- `src/components/cart/FinalConfirmModal.tsx` — exibir resumo de negociações por item
- `src/components/cotacoes/ConverterEmPedidoModal.tsx` — respeitar snapshot
- `supabase/migrations/<novo>.sql` — colunas em order_items

## Fora de escopo

- Piso por produto (`preco_minimo`) — não foi escolhido
- UI de auditoria histórica das negociações (log já é gravado, leitura fica para depois)
- Alteração no fluxo de cotações antigas (snapshot já funciona)
