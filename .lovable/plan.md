# Aprovação de Pedidos do Portal do Cliente (V16)

Pedidos feitos pelo perfil `cliente` no portal entram como **pendentes de aprovação** e só viram pedido firme / provisão depois que admin ou master aprova.

## 1. Banco de dados (migration)

Adicionar colunas em `public.orders`:
- `origem_perfil text not null default 'vendedor'` — `vendedor | admin | master | cliente`
- `status_pedido text not null default 'confirmado'` — `pendente_aprovacao | aprovado | recusado | confirmado | convertido | cancelado`
- `aprovado_por_id uuid`, `aprovado_por_nome text`, `aprovado_em timestamptz`, `aprovacao_obs text`
- `recusado_por_id uuid`, `recusado_por_nome text`, `recusado_motivo text`, `recusado_obs timestamptz não — text`, `recusado_em timestamptz`
- `tem_solicitacao_ajuste boolean not null default false`
- `ajuste_mensagem text`
- `historico jsonb not null default '[]'::jsonb` (log de eventos do pedido)

Política RLS adicional: cliente pode `UPDATE` o próprio pedido somente quando `status_pedido = 'pendente_aprovacao'` (para reenviar após ajuste/cancelar). Admin/master atualizam qualquer um (já coberto).

Backfill: marcar `origem_perfil = 'vendedor'` e `status_pedido = 'confirmado'` para todos os existentes (default cobre).

## 2. Tipos

- `src/types/index.ts` (ou onde mora `SavedOrder`): adicionar `origemPerfil`, `statusPedido`, campos de aprovação/recusa/ajuste e `historico`.

## 3. Salvar pedido do portal do cliente

`src/routes/portal.*` — fluxo de checkout do cliente:
- Ao salvar, marcar `origem_perfil='cliente'`, `status_pedido='pendente_aprovacao'`, salvar **todos** os itens (firme + provisão) na própria order (sem separar provisão ainda).
- Tela de sucesso substituída pelo card "📋 Pedido enviado para análise" com resumo (itens em estoque / com previsão).
- Lista de pedidos do cliente (`portal.pedidos.tsx`): exibir status amigável (⏳ Em análise / ✅ Confirmado / ❌ Não aprovado / ⚠ Ajuste solicitado).
- Quando `tem_solicitacao_ajuste`: mostrar mensagem + botões "Editar e reenviar" (repopula carrinho) e "Cancelar pedido".

Vendedor/admin/master continuam salvando com `status_pedido='confirmado'` (fluxo atual intacto).

## 4. Fila de aprovação (admin/master)

- **Hook** `usePendingApprovals` (TanStack Query) consulta `orders` com `status_pedido='pendente_aprovacao'`.
- **Badge no header** (`src/components/layout/Header.tsx`): sino com contador, dropdown listando últimos pendentes, link "Ver todos pendentes →" para `/orders?status=pendente_aprovacao`.
- **Card no Dashboard** (`src/routes/dashboard.tsx`): card âmbar com lista dos pendentes; some quando zera. Botão "Aprovar todos" só habilita se nenhum pedido tem itens de provisão.
- **Filtro em `/orders`**: chips `Todos | Pendentes ⏳ N | Aprovados | Confirmados | Recusados`.

## 5. Tela de revisão (admin/master)

Na ficha do pedido (`src/routes/orders.tsx` drawer/detail):
- Banner âmbar "⏳ Pedido aguardando sua aprovação".
- Bloco "Composição": separa itens firmes vs provisão usando `classificarItem` (`src/lib/classifyItem.ts`).
- Botões: **Aprovar**, **Solicitar ajuste**, **Recusar** (somente admin/master; vendedor responsável vê tudo, mas sem botões).

### Aprovar
- Server fn `aprovarPedidoCliente({ orderId, obs })`:
  1. Lê pedido + itens.
  2. Separa firme vs provisão.
  3. Se houver firme: atualiza a própria order (mantém ID, remove itens de provisão de `order_items`, atualiza totais), seta `status_pedido='aprovado'` + campos de aprovação.
  4. Se houver provisão: cria registro em `provisoes` + `provisao_itens` (com `pedido_firme_id` se aplicável e `cliente_snapshot`).
  5. Se 100% provisão: marca order como `convertido` e cria só provisão.
  6. Append no `historico`.
- Toast: "Pedido #X aprovado. Pedido firme + Provisão #P00YY criada."

### Recusar
- Modal com motivo (radio) + mensagem opcional → server fn seta `status_pedido='recusado'`, grava motivo/obs, append histórico.

### Solicitar ajuste
- Modal com mensagem obrigatória → mantém `status_pedido='pendente_aprovacao'`, seta `tem_solicitacao_ajuste=true`, `ajuste_mensagem`, append histórico.

## 6. Histórico do pedido

- Cada ação faz append em `historico` (jsonb array) com `{ em, acao, por_id, por_nome, obs }`.
- Exibido na ficha (admin/master/vendedor: completo; cliente: versão simplificada sem nomes internos).

## 7. Detalhes técnicos

- Aprovação/recusa/ajuste implementados como `createServerFn` em `src/lib/orderApprovals.functions.ts` com `requireSupabaseAuth` e checagem `is_admin_or_master` (via `user_roles`).
- Reuso de `classificarItem` para separar firme vs provisão.
- Atualizar `cotacaoStore`/`orderStore` se necessário para refletir os novos campos no listing.
- Sem push real — apenas badge/dropdown + card de dashboard + log no histórico.

## 8. Arquivos previstos

- `supabase/migrations/<new>.sql` (schema + RLS update)
- `src/lib/orderApprovals.functions.ts` (novo)
- `src/types/index.ts` (campos extras em SavedOrder)
- `src/routes/portal.*` (checkout success + lista de pedidos + reenviar)
- `src/components/layout/Header.tsx` (sino de pendentes)
- `src/components/orders/PendingApprovalPanel.tsx` (novo — banner + botões na ficha)
- `src/components/orders/ApproveOrderDialog.tsx`, `RecusarPedidoDialog.tsx`, `SolicitarAjusteDialog.tsx` (novos)
- `src/routes/orders.tsx` (filtros + integração drawer)
- `src/routes/dashboard.tsx` (card de pendentes)
- `src/integrations/supabase/types.ts` (regenerado pela migration)
