# Módulo Reuniões — Catálogo de Pré-seleção

Nova feature composta por duas frentes independentes que se conectam via localStorage compartilhado + endpoint opcional.

## Escopo em 2 partes

### 1. Rota pública `/pre-selecao` (sem login)
Catálogo interativo mobile-first para o cliente marcar interesse antes da reunião.

- Lê `?v=<login>` para vincular ao vendedor (silencioso).
- Sidebar/drawer com hierarquia Categoria → Coleção → Grupo (mesma taxonomia do B2B, via `PRODUCTS`).
- Cards mostram: foto/placeholder, nome, cor, tamanho, **preço varejo**, badge de estoque, input qtd com múltiplos, botão ♡ (interesse sem qtd = quantidade 0).
- **Nunca** exibe preço atacado, SKU interno, NCM, CEST, códigos.
- Rodapé fixo com resumo: itens, unidades, total varejo de referência, botão "Enviar interesse".
- Modal de dados da empresa: CNPJ (com busca via `fetchCNPJ` já existente), razão social, fantasia, contato, cargo, email, WhatsApp, cidade/UF (autopreenchidos), segmento (select), observação, checkbox newsletter.
- Tela de confirmação com protocolo `#PSxxxx` e validade 72h.
- Busca por nome/coleção no topo.

### 2. Painel "Reuniões" no B2B (`/reunioes`)
Item novo no menu principal, entre Cotações e Clientes.

- Tabs de status: Novas 🔴 / Visualizadas / Em contato / Convertidas / Todas.
- KPIs: nº de novas, valor ref. potencial, taxa de conversão.
- Tabela com colunas: #, empresa, itens/unidades, ref. varejo, status, tempo.
- Drawer lateral com abas Empresa / Lista / Ações.
- Ações: Converter em Cotação, Criar/Vincular Cliente, WhatsApp, Copiar lista, Descartar.
- Botão "Gerar meu link" com copiar, WhatsApp pré-formatado, QR code (usa lib `qrcode`).
- Isolamento por vendedor idêntico ao dos pedidos; admin/master veem tudo.
- Badge vermelho pulsante no menu lateral quando há novas; card de destaque no dashboard.
- Expiração automática após 72h (configurável em Regras Gerais) via checagem na abertura.

## Modelo de dados & storage

- `localStorage: fetely_pre_selecoes` (array `PreSelecao[]`)
- `localStorage: fetely_pre_selecao_counter` (sequencial)
- Novo tipo `PreSelecao` e `ItemPreSelecao` conforme spec.
- Novo store Zustand `preSelecaoStore` seguindo o padrão dos demais stores.
- Regra em Regras Gerais: `expiracaoPreSelecaoHoras` (default 72).

## Conversão em cotação
Ao clicar "Converter em Cotação":
1. Busca `clientes` por CNPJ; se não existir, abre `ClienteFormModal` pré-preenchido.
2. Popula `cotacaoStore` com cliente + itens (♡ recebe `quantidade = multiplos` e flag `qtdAConfirmar`).
3. Navega para `/cotacoes` no modo edição, com badge "Qtd. a confirmar" nos itens ♡.
4. Muda status da pré-seleção para `convertida`, grava `cotacaoGeradaId`.

## Sincronização (MVP)
O catálogo público roda em outro dispositivo/navegador — não compartilha localStorage com o painel B2B.
- **MVP:** ao enviar, gera link `/reunioes/importar#<base64>` com o payload. O vendedor recebe por WhatsApp (ou o próprio cliente é redirecionado com essa URL que ele reenvia) e ao abrir no B2B, o sistema faz o import automático. Também exibimos a string base64 na tela de confirmação para copiar/colar manualmente como fallback.
- **Opcional Fase 2:** endpoint TanStack `POST /api/public/pre-selecao` que grava numa tabela Lovable Cloud — deixarei um TODO documentado sem implementar agora.

## Arquivos novos
```
src/types/preSelecao.ts
src/store/preSelecaoStore.ts
src/lib/preSelecao.ts               (helpers: gerar id, converter para cotação, base64)
src/routes/pre-selecao.tsx          (catálogo público)
src/routes/reunioes.tsx             (painel)
src/routes/reunioes.importar.tsx    (import via hash)
src/components/reunioes/
  PreSelecaoDrawer.tsx
  GerarLinkModal.tsx
  ConverterCotacaoModal.tsx
src/components/publico/
  PublicCatalogHeader.tsx
  PublicProductCard.tsx
  PublicSummaryBar.tsx
  DadosEmpresaModal.tsx
  ConfirmacaoPreSelecao.tsx
```

## Arquivos alterados
- `src/components/layout/Header.tsx` + `BottomNav.tsx`: adicionar item "Reuniões" com badge.
- `src/routes/dashboard.tsx`: card de destaque para novas pré-seleções.
- `src/routes/__root.tsx`: garantir que `/pre-selecao` seja pública (fora de `_authenticated`, se aplicável).
- `src/routes/settings.tsx` (Regras Gerais): campo expiração.
- `package.json`: adicionar `qrcode` e `@types/qrcode`.

## Regras preservadas
- Isolamento por vendedor idêntico ao módulo de pedidos.
- Múltiplos e regras de estoque idênticos ao catálogo B2B.
- Ordenação nos exports mantém a regra atual de PDF (coleção → modelo → cor → nº).
- Nada muda em pedidos/cotações existentes; conversão apenas cria uma cotação nova.

## Fora de escopo
- Backend real de sincronização (só MVP com base64/URL).
- Notificações push/e-mail — só badge in-app.
- Editar preço de varejo no catálogo público (é read-only do cadastro).

Confirma que sigo com essa abordagem — em especial o mecanismo de sync via URL/base64 no MVP?
