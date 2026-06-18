# V19 — Grupos de Clientes + Duplicar Pedido

Implementação unificada de dois recursos interligados: agrupamento de CNPJs e duplicação de pedidos (mesmo cliente, grupo, manual) com fila de revisão e biblioteca de modelos.

## 1. Modelo de dados

**Novos tipos** (`src/types/grupo.ts`, `src/types/modelo.ts`):
- `GrupoCliente` — id, nome, descricao, cor, clienteIds[], criadoPorVendedorId, criadoEm, atualizadoEm, ativo
- `ModeloPedido` — id, nome, descricao, criadoEm, criadoPorVendedorId, itens[{sku, nomeComercial, quantidade}]

**Cliente** (`src/types/cliente.ts`): adicionar `gruposIds?: string[]` (derivado — não persistido no cliente; calculado do grupo).

**SavedOrder** (`src/types/index.ts`): adicionar `duplicadoDe?`, `modeloOrigemId?`, `grupoOrigemId?`.

## 2. Persistência

**Tabelas Lovable Cloud:**
- `grupos_clientes` (id uuid, nome, descricao, cor, cliente_ids uuid[], criado_por_vendedor_id, criado_em, atualizado_em, ativo)
- `modelos_pedido` (id uuid, nome, descricao, itens jsonb, criado_por_vendedor_id, criado_em)

RLS: vendedor lê/escreve só os próprios; admin/master vê todos (via `has_role`/`is_admin_or_master`). GRANTs para `authenticated` + `service_role`.

**Colunas em `orders`:** `duplicado_de text`, `modelo_origem_id uuid`, `grupo_origem_id uuid`.

## 3. Stores

- `src/store/grupoStore.ts` — Zustand + persist + hydrate/upsert/delete (mesmo padrão de `clienteStore`).
- `src/store/modeloStore.ts` — idem para modelos.
- `src/store/duplicacaoStore.ts` — fila ativa: `{ origem, itens, fila: {clienteId, status: 'pendente'|'feito'|'pulado', pedidoGerado?}[], indiceAtual }`, com `iniciar()`, `avancar()`, `pular()`, `finalizar()`.

## 4. UI — Grupos

**Rota Clientes (`src/routes/clientes.tsx`):** adicionar Tabs no topo `Lista | Grupos`.

**Componentes** (`src/components/grupos/`):
- `GruposListPage.tsx` — lista com busca, badge de cor, contagem, ações Duplicar/Editar/Excluir.
- `GrupoFormModal.tsx` — 2 passos (Identidade com seletor de cor; Selecionar Clientes com busca/checkbox).
- `GrupoBadgeList.tsx` — badges na ficha do cliente (`ClienteFormModal`).

## 5. UI — Duplicar Pedido

**Componente central** `src/components/duplicar/DuplicarPedidoModal.tsx`:
- Seção ORIGEM: radio Pedido / Modelo + busca/select.
- Seção DESTINO: radio Mesmo cliente / Grupo / Manual; lista editável de clientes selecionados (marcador "via grupo").
- Seção MODO: radio Revisar carrinho (sequencial) / Gerar como cotações.
- Estado pré-preenchido conforme ponto de entrada.

**Pontos de entrada:**
- `src/routes/orders.tsx` — botão 📋 por linha + dropdown na ficha.
- `src/components/grupos/GruposListPage.tsx` — botão "Duplicar pedido p/ grupo".
- `src/routes/cart.tsx` — botão "💾 Salvar como modelo" (abre `SalvarModeloModal`).
- `src/routes/new-order.tsx` — botão "Usar modelo".

**Fila de revisão** `src/components/duplicar/FilaDuplicacaoBar.tsx`:
- Barra fixa no topo enquanto fila ativa, mostrando "[N/M] cliente", botões Revisar/Pular/Pausar.
- Quando "Revisar agora": navega para `/cart` com itens pré-populados via `cartStore` + `clienteStore` + `negotiationStore` (recalcula faixa/desconto com premissas do cliente destino).
- Ao confirmar pedido (em `confirmation.tsx`/`orderStore`), se houver fila ativa: marca item como feito, salva `duplicadoDe`/`grupoOrigemId`, avança para próximo.
- Tela final: `FilaConclusaoModal` com lista de pedidos gerados.

**Modo cotações:** loop que cria N cotações via `cotacaoStore.criar()` com snapshot de cada cliente e itens recalculados; mostra `ConclusaoCotacoesModal`.

## 6. Recálculo

`src/lib/duplicar.ts`:
```ts
prepararCarrinhoDuplicado(origem, clienteDestino) {
  // mapeia itens → preço atual, statusEstoque, ativo
  // filtra inativos
  // marca precoAlterado quando diverge do original
  // NÃO copia faixa/desconto/frete — deixa o cartCommercial recalcular
}
```

Alertas no carrinho: banner "Preço atualizado em X itens", badge âmbar em provisão (já existente), item removido listado em toast inicial.

## 7. Rastreabilidade

- `SavedOrder.historico` ganha evento `duplicado` com referência ao original/grupo/modelo.
- Ficha do pedido (`orders.tsx` drawer): mostra "Duplicado do Pedido #XXXX" e "Parte da duplicação para Rede X (N pedidos)".

## 8. Isolamento por vendedor

RLS no banco + filtro no store (`useVisibleGrupos`, `useVisibleModelos`) seguindo padrão de `useVisibleClientes`.

## Arquivos novos

- `src/types/grupo.ts`, `src/types/modelo.ts`
- `src/store/grupoStore.ts`, `src/store/modeloStore.ts`, `src/store/duplicacaoStore.ts`
- `src/lib/duplicar.ts`
- `src/components/grupos/{GruposListPage,GrupoFormModal,GrupoBadgeList}.tsx`
- `src/components/duplicar/{DuplicarPedidoModal,FilaDuplicacaoBar,FilaConclusaoModal,SalvarModeloModal,UsarModeloModal}.tsx`
- 1 migration (tabelas + colunas em orders + RLS + GRANTs)

## Arquivos alterados

- `src/types/index.ts` (campos de origem em SavedOrder)
- `src/types/cliente.ts` (gruposIds opcional)
- `src/routes/clientes.tsx` (tabs)
- `src/routes/orders.tsx` (botões duplicar + histórico)
- `src/routes/cart.tsx` (salvar modelo + integração fila)
- `src/routes/new-order.tsx` (usar modelo)
- `src/routes/confirmation.tsx` (avança fila ao confirmar)
- `src/routes/__root.tsx` (FilaDuplicacaoBar global)
- `src/components/clientes/ClienteFormModal.tsx` (badges de grupo)
- `src/store/orderStore.ts` (grava duplicadoDe/grupoOrigemId/modeloOrigemId)

## Confirmações antes de prosseguir

1. Posso criar as 2 tabelas novas + colunas em `orders` via migration?
2. A "fila" durante a revisão sequencial deve persistir entre reloads? (proposta: sim, em localStorage via Zustand persist, para sobreviver a F5).
3. "Salvar como modelo" no carrinho — captura apenas SKU+qtd (sem preços/condições), correto?