# Módulo de Leads Qualificados em Configurações

Esta é uma feature grande. Vou propor o plano dividido em etapas que podem ser entregues em sequência, mas precisa da sua aprovação antes de começar porque envolve mudanças no schema (Supabase), no menu de Configurações e várias telas novas.

## Situação atual

Hoje só existe o módulo de **Leads de Feira** (`src/lib/leadsFeira.ts`, `/stand` e `/stand/leads`), que é diferente do que você descreveu. Não existe ainda:
- Formulário público `/qualificacao`
- Tabela/base `fetely_leads_qualificados`
- Painel CRM, Campanhas ou Integrações

Ou seja, é tudo novo. Confirmo abaixo o que vou construir.

## O que vou entregar

### 1. Formulário público `/qualificacao`
Página standalone, sem autenticação, sem menu do B2B. Captura:
- Nome, WhatsApp, Instagram, e-mail, cidade/UF
- Segmento (lojista, decoradora, cerimonialista, atacadista, buffet, influencer, consumidor, outro)
- Frequência, volume estimado, urgência (1-5), produtos de interesse, origem do contato
- Calcula score / potencial (alto / médio / em desenvolvimento) automaticamente

### 2. Persistência (Supabase, não localStorage)
Vou usar Lovable Cloud (Supabase) em vez de localStorage para que os leads não se percam e respeitem RLS. Tabelas novas:
- `leads_qualificados` — todos os campos do formulário + status CRM, responsável, tags, notas, cliente_b2b_id, cotacao_origem_id
- `lead_grupos_campanha` — grupos personalizados (filtros salvos)
- `lead_mensagens_wpp` — templates WhatsApp por segmento (1 linha por segmento)
- `lead_webhooks` — configs de webhook
- `lead_historico` — eventos (criado, status alterado, responsável, tag, conversão)

RLS: insert público (formulário anônimo), select/update/delete apenas admin/master.

### 3. Configurações → Leads (rota `/admin/leads`)
Visível apenas para admin/master no menu de Configurações. Três abas:

**a) Base de Leads**
- 4 KPIs no topo + breakdown por segmento
- Filtros (busca, segmento, potencial, status, origem, período, responsável)
- Tabela com badges de status CRM
- Painel lateral com 4 sub-abas (Perfil, CRM, Histórico, Ações)
- Exportar CSV, cadastro manual

**b) Campanhas**
- Grupos automáticos (calculados sobre a base atual)
- Grupos personalizados (filtros salvos, recalculados dinamicamente)
- Modal criar grupo + preview de contagem
- Exportar CSV com seleção de campos

**c) Integrações**
- Configurar mensagens WhatsApp por segmento (templates com variáveis)
- Ações disponíveis na ficha do lead (WhatsApp, converter em cliente, gerar cotação, copiar link catálogo com UTM)
- Webhooks (cadastro de URL + evento — disparo real via server function quando lead é criado/convertido)

### 4. Conversão Lead → Cliente B2B
Botão na ficha do lead pré-preenche o formulário de Cliente (V6) com mapeamento de segmento/canal. Lead fica com status `convertido` + `cliente_b2b_id` apontando para o cadastro criado. Link "Ver cliente B2B" na ficha.

### 5. Gerar Cotação a partir do lead
Verifica se existe `cliente_b2b_id`; se não, força conversão antes. Depois abre nova cotação (V15) com cliente já selecionado.

### 6. Card "Leads" no Dashboard (V5)
Resumo: novos hoje, alto potencial, aguardando contato + link para o módulo.

## Detalhes técnicos

- **Stack:** TanStack Start + Supabase. Sem localStorage para dados de produção.
- **Webhooks:** disparados via server function (`createServerFn`) após insert/update do lead.
- **Score:** calculado client-side a partir de segmento + frequência + volume + urgência. Função pura em `src/lib/leadScore.ts`.
- **UTM no catálogo:** helper `buildCatalogoUtmLink(lead)` que monta `/catalog?utm_*`.
- **Acesso:** rota `/admin/leads` protegida via verificação de role no componente (padrão dos outros `/admin/*`).
- **Menu Configurações:** adiciono item "Leads" em `src/routes/settings.tsx` na seção admin/master.
- **Tipos:** novo arquivo `src/types/lead.ts`. Store `src/store/leadStore.ts` com React Query + server functions para CRUD.

## O que NÃO vou tocar

- O módulo existente `/stand` e `leadsFeira.ts` (leads de feira) fica intacto e separado.
- Nenhuma mudança nos módulos de pedidos, cotações, provisões, clientes (apenas leio o tipo Cliente para conversão).

## Forma de entrega sugerida

Posso entregar em 1 turno só (vai gerar muitos arquivos novos: ~12-15 arquivos) ou dividido:
- **Fase 1:** Migration + formulário `/qualificacao` + tabela base + página `/admin/leads` com aba Base (KPIs, filtros, tabela, ficha completa)
- **Fase 2:** Campanhas (grupos auto + personalizados + exportação)
- **Fase 3:** Integrações (templates WhatsApp, webhooks, ações de conversão/cotação) + card no Dashboard

**Recomendo fazer em fases** porque é uma quantidade grande de UI e fica mais fácil de validar/ajustar cada parte antes da próxima.

## Perguntas antes de começar

1. Tudo bem usar **Supabase** (Lovable Cloud) em vez de localStorage para os leads? (recomendo fortemente — o prompt original mencionava localStorage como MVP, mas você já tem Cloud ativo)
2. Quer que eu entregue **em fases** (começando pela Fase 1) ou tudo de uma vez?
3. O **formulário público `/qualificacao`** deve ter algum branding/visual específico ou sigo a identidade Fetély (dourado/escuro) do resto do app?