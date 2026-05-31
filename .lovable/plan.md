# V15 — Pedido Firme vs Cotação

Adicionar o conceito de **Cotação** ao lado do **Pedido Firme**. Cotações ficam separadas dos pedidos (não entram em faturamento) e podem ser convertidas em pedido firme a qualquer momento dentro da validade.

## 1. Modelo de dados

`src/types/cotacao.ts` (novo)
- `TipoRegistro = 'pedido' | 'cotacao'`
- `StatusCotacao = 'aberta' | 'em_negociacao' | 'aprovada' | 'convertida' | 'expirada' | 'perdida'`
- `MotivoPerdaCotacao` (enum spec)
- `interface Cotacao` — espelha `SavedOrder` + `validoAte`, `status`, `pedidoConvertidoId`, `motivoPerda`, `motivoPerdaObs`.

`src/types/index.ts`
- Estender `SavedOrder` com `pedidoOrigem?: 'direto' | 'cotacao' | 'provisao' | 'portal_cliente'` e `cotacaoOrigemId?: string`.

## 2. Store de cotações

`src/store/cotacaoStore.ts` (novo, padrão Zustand igual a `orderStore`)
- Estado: `cotacoes: Cotacao[]`, `counter: number` (chave `fetely_cotacao_counter`).
- `nextId()` → `C0001`, `C0002`…
- `criarCotacao(payload)` — gera id, `validoAte = criadoEm + 15 dias`, status `aberta`.
- `atualizarCotacao(id, patch)`, `atualizarStatus(id, status, motivo?)`, `duplicar(id)`, `marcarConvertida(id, pedidoId)`.
- `expirarVencidas()` — chamado no boot, vira `expirada` quando `validoAte < hoje` e status ∈ `aberta|em_negociacao`.
- Helper `getCotacoesVisiveis(perfil, userId, clienteId)` aplicando o mesmo isolamento de `orders` (vendedor vê só as suas; admin/master tudo; cliente portal só as próprias).

Persistência via localStorage `fetely_cotacoes` (alinhado ao padrão existente de stores; SEM nova tabela Supabase neste V15 — explicitar em nota).

## 3. Checkout — escolha Pedido vs Cotação

`src/components/cart/FinalConfirmModal.tsx`
- Substituir o único botão "Confirmar ambos →" por dois CTAs lado a lado:
  - `📋 Salvar como Cotação` — borda dourada, fundo transparente, texto ouro. Subtítulo "Sem compromisso · válida 15 dias".
  - `✦ Confirmar Pedido` — fundo dourado sólido, texto preto. Subtítulo "Pedido firme faturável".
- Props novas: `onConfirmPedido`, `onSalvarCotacao` (substituem `onConfirm`).

`src/routes/cart.tsx` (e/ou handler que abre o modal)
- `handleSalvarCotacao()` — monta payload idêntico ao do pedido, chama `cotacaoStore.criarCotacao()`, toast "Cotação #C012 salva (válida até …)", navega para `/cotacoes/C012` (ou volta ao catálogo).
- `handleConfirmarPedido()` — fluxo atual mantido (gera pedido firme + envia SNCF).
- Provisão futura continua sendo gerada independentemente do tipo escolhido.

## 4. Tela de Cotações

`src/routes/cotacoes.tsx` (novo)
- Filtros por status (Abertas / Em negociação / Aprovadas / Todas), busca por cliente/número, filtro de período.
- Tabela: `#`, Cliente, Valor, Válida até, Status (badge colorido), ações.
- Badge `⚠ Expira em N dias` quando `validoAte - hoje ≤ 3`.
- Botão `+ Nova Cotação` → `/new-order?modo=cotacao` (apenas marca intent; o tipo final é decidido no checkout — para V15 basta abrir `/new-order`).

`src/components/cotacoes/CotacaoDetailDrawer.tsx` (novo)
- Resumo idêntico ao de pedido (reaproveitar componentes existentes do `orders.tsx` se já houver; senão inline simples).
- Bloco de Ações:
  - `✦ Converter em Pedido` (dourado)
  - `✏ Editar cotação` — carrega itens no `useCartStore`, marca `editandoCotacaoId` em `uiStore`, navega `/cart`. Ao salvar, `atualizarCotacao(id, payload)` em vez de criar nova; renova `validoAte`.
  - `⬇ Exportar PDF`
  - `📋 Duplicar`
  - Botões de status: `Em negociação`, `Aprovada`, `Perdida` (abre modal de motivo).

`src/components/cotacoes/MarcarPerdidaModal.tsx` (novo)
- Radio com os 7 motivos da spec + textarea de observação. Salva via `atualizarStatus(id, 'perdida', { motivo, obs })`.

`src/components/cotacoes/ConverterEmPedidoModal.tsx` (novo)
- Mostra resumo financeiro, permite escolher/ajustar condição de pagamento, confirma:
  - `orderStore.criarPedido({ ...cotacao, pedidoOrigem: 'cotacao', cotacaoOrigemId: cotacao.id })`
  - `cotacaoStore.marcarConvertida(id, pedidoId)`
  - Toast `Cotação #C012 convertida no Pedido #0044`.

## 5. Navegação

`src/components/layout/Header.tsx` (e `BottomNav.tsx` se aplicável)
- Adicionar item **Cotações** (ícone `FileText`) entre Pedidos e Provisões. Visível para admin/master/vendedor (e cliente no portal — ver §7).

## 6. PDF de cotação

`src/lib/exporter.ts` (ou `orderPdf.ts`)
- Nova função `exportCotacaoPdf(cotacao)` reaproveitando o layout de pedido com:
  - Cabeçalho `COTAÇÃO #C012`
  - Linha `Válida até: dd/mm/yyyy`
  - Condição de pagamento exibida como "a confirmar na conversão"
  - Rodapé `Este documento é uma cotação e não representa compromisso de compra.`

## 7. Portal do cliente

`src/components/layout/PortalSidebar.tsx`
- Adicionar item **Cotações** entre Pedidos e Provisões.

`src/routes/portal.cotacoes.tsx` (novo)
- Lista das cotações do `clienteId` logado.
- Permite `Converter em Pedido` (reaproveita `ConverterEmPedidoModal`).

## 8. Dashboard

`src/routes/dashboard.tsx`
- Card **📋 Pipeline de Cotações**: contadores e valor por status (Abertas / Em negociação / Aprovadas), total potencial, taxa de conversão 30d, tempo médio até conversão.
- Card **Cotações prestes a expirar**.
- Admin/master: agregado da equipe. Vendedor: só as próprias.

## 9. Relatórios

`src/routes/commercial.tsx` (ou onde estão os relatórios V5)
- Nova aba **Cotações**: métricas do período (geradas, convertidas, perdidas, expiradas, em aberto, valores) e top motivos de perda.

## 10. Marcação de origem em pedidos

`src/routes/orders.tsx`
- Quando `pedido.pedidoOrigem === 'cotacao'`, badge `📋 Cotação` com tooltip do `cotacaoOrigemId`.

## 11. Boot / expiração automática

`src/lib/fopBootstrap.ts` (ou `src/start.ts` lado cliente)
- Chamar `useCotacaoStore.getState().expirarVencidas()` no boot do app.

## Arquivos tocados

**Novos**
- src/types/cotacao.ts
- src/store/cotacaoStore.ts
- src/routes/cotacoes.tsx
- src/routes/portal.cotacoes.tsx
- src/components/cotacoes/CotacaoDetailDrawer.tsx
- src/components/cotacoes/MarcarPerdidaModal.tsx
- src/components/cotacoes/ConverterEmPedidoModal.tsx

**Editados**
- src/types/index.ts (campos `pedidoOrigem`, `cotacaoOrigemId` em `SavedOrder`)
- src/components/cart/FinalConfirmModal.tsx (dois botões)
- src/routes/cart.tsx (handlers)
- src/components/layout/Header.tsx + PortalSidebar.tsx + BottomNav.tsx (item Cotações)
- src/lib/exporter.ts ou src/lib/orderPdf.ts (`exportCotacaoPdf`)
- src/routes/dashboard.tsx (pipeline)
- src/routes/commercial.tsx (aba Cotações)
- src/routes/orders.tsx (badge origem cotação)
- src/lib/fopBootstrap.ts (expirar vencidas no boot)

## Notas

- **Persistência**: cotações ficam em `localStorage` (`fetely_cotacoes`, `fetely_cotacao_counter`), seguindo o padrão de stores existentes. Quando quisermos sync server-side, criamos tabela Supabase em V16 — não é escopo agora.
- **Validade**: hardcoded 15 dias (constante `COTACAO_VALIDADE_DIAS` em `cotacaoStore.ts`); migrar para `regras_gerais` no futuro.
- **Cotação NÃO entra em faturamento** — dashboards de vendas continuam usando apenas `orderStore`.
- **Edição de cotação** atualiza in-place e renova `validoAte` a partir da edição.
- **Duplicar** gera novo ID, copia itens/condições, status `aberta`, nova validade.
- Isolamento por perfil reusa o mesmo padrão de `getPedidos` para evitar divergência.

Aprovar para implementar?
