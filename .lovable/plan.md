## Evolução do Fetély B2B Orders — Sidebar Hierárquico + Sistema de Fotos

Vou implementar duas grandes evoluções mantendo toda lógica de pedido, múltiplos, vela numérica e carrinho intactas.

---

### Parte 1 — Sidebar Hierárquico de Navegação

**Novo componente `src/components/layout/CatalogSidebar.tsx`**
- Largura 260px desktop, colapsável para 60px via botão toggle (estado em zustand `useUI`)
- Árvore derivada dinamicamente de `products` agrupados por `categoria → grupo → colecao`
- Categorias sempre expandidas; grupos expansíveis (chevron rotaciona)
- Coleções clicáveis com destaque ativo (borda esquerda dourada + bg sutil)
- Scroll independente (`overflow-y-auto`, altura `calc(100vh - 64px)`)
- Rodapé sticky com resumo do carrinho (total BRL, unidades, itens) + botão "Revisar Pedido"
- Mobile: vira drawer via `Sheet` do shadcn, aberto por hambúrguer no header

**Nova rota `src/routes/catalog.tsx`** (substitui o fluxo em etapas)
- Layout grid `[260px_1fr]` com `CatalogSidebar` à esquerda e painel central
- Estado da coleção selecionada via search param `?colecao=X&grupo=Y`
- Breadcrumb no topo: `Categoria > Grupo > Coleção`
- Renderiza `NumericalCandleGrid` (se vela numérica) ou grid de `ProductCard`
- Fade-in 150ms na troca de coleção (key + transition)

**`src/routes/new-order.tsx`** — mantém o fluxo em etapas como alternativa, mas a Home (`/`) e o botão "Novo Pedido" passam a apontar para `/catalog`.

**`src/store/uiStore.ts`** — novo store para `sidebarCollapsed`, `expandedGroups`, `photoModalOpen`.

---

### Parte 2 — Sistema de Fotos

**`src/store/photoStore.ts`** (zustand + persist com chave `fetely_photos`, separado do catálogo)
```ts
{ colecoes: Record<string, string>, produtos: Record<string, string> }
```
- `normalizeKey(str)` — remove acentos, lowercase, snake_case
- `setColecaoPhoto(colecao, base64)`, `setProdutoPhoto(colecao, cor, base64)`
- `getProdutoPhoto(colecao, cor)` — fallback para foto de coleção, depois placeholder
- Detecta uso > 4MB e expõe flag de aviso

**`src/lib/image.ts`** — `resizeImage(file, 800)` redimensiona via canvas, JPEG 80%

**Nova rota `src/routes/photos.tsx`**
- Tabs shadcn: "Fotos de Coleção" | "Fotos por Cor"
- **Coleção**: grid de cards (uma por coleção única do catálogo), cada um com preview + ícone de câmera
- **Cor**: filtros (categoria/coleção) → grid de variantes únicas (combinação coleção+cor) com preview
- Modal de upload (`Dialog`): drag&drop + input file + preview + Salvar
- Aviso discreto de capacidade quando localStorage > 4MB

**Integração nos componentes existentes**:
- `ProductCard.tsx`: substitui o swatch atual pelo `<img>` resolvido via `getProdutoPhoto(colecao, cor)`, com fallback para placeholder dourado com inicial
- `NumericalCandleGrid.tsx`: thumbnail 40x40 por linha usando a foto da cor
- `CollectionCard` no sidebar e em `/catalog`: usa foto da coleção como background

---

### Parte 3 — Header

**`src/components/layout/Header.tsx` atualizado**
- Logo + Busca global (centro) + link Fotos + Carrinho
- Botão hambúrguer mobile que abre sidebar drawer
- **Busca global**: input com debounce, mostra dropdown (≥2 chars) com até 10 resultados (nome, coleção, preço atacado, thumbnail). Click navega para `/catalog?colecao=X&highlight=SKU`. ESC fecha.

---

### Arquivos a criar/editar

**Criar:**
- `src/components/layout/CatalogSidebar.tsx`
- `src/components/layout/GlobalSearch.tsx`
- `src/components/photos/PhotoUploadModal.tsx`
- `src/components/photos/PhotoPlaceholder.tsx`
- `src/store/photoStore.ts`
- `src/store/uiStore.ts`
- `src/lib/image.ts`
- `src/routes/catalog.tsx`
- `src/routes/photos.tsx`

**Editar:**
- `src/components/layout/Header.tsx` — busca global + link Fotos + hambúrguer mobile
- `src/components/catalog/ProductCard.tsx` — foto resolvida do photoStore
- `src/components/catalog/NumericalCandleGrid.tsx` — thumbnail por cor
- `src/routes/index.tsx` — CTA principal aponta para `/catalog`
- `src/routes/new-order.tsx` — mantém, mas adiciona link "ir para navegação por menu"

### Detalhes técnicos

- Toda lógica de pedido, múltiplos, vela numérica, validações permanece intocada
- Foto: storage separado em `fetely_photos`, evita inflar `fetely-catalog`/`fetely-order`
- Persistência via `zustand/middleware persist` igual aos stores existentes
- Identidade visual mantida: bg preto, dourado `#C9A84C`, Cormorant + DM Sans, classes `gold-border`, `text-gold`, `bg-surface`
- Sem backend / Lovable Cloud — tudo client-side conforme MVP solicitado
