# Roadmap

- [ ] PIX Safra no B2C: inventariar contrato SNCF; centralizar meios; novo/edição/resumo/listas/links e compartilhamento; preservar PIX QR e impedir declaração Safra; testes e preview autenticado sem vendas reais, sem B2B/catálogo/publicação.

- [x] Carrinho → Venda B2C: projeção read-only de SKU/quantidade, consumo único via state/sessionStorage após login e resolução SNCF no CD padrão; 77 testes e build automático OK. Preview autenticado com respostas B2C simuladas confirmou varejo, saldo insuficiente mantido, aviso por SKU, carrinho intacto, fallback e refresh sem repopular; zero escritas. Lint completo executado: falha por 10.400 erros do projeto (majoritariamente formatação existente); helpers novos sem erros e telas sem erros com a regra de formatação desativada, sete avisos preexistentes. Não publicado.

- [x] Solicitar publicação da versão atual; URL publicada respondeu HTTP 200. Nova verificação: 17 achados informativos, nenhum crítico. Pré-seleção: INSERT direto anônimo/autenticado bloqueado (42501), leitura anônima vazia e validação da função pública rejeita dados incompletos. Fotos: bucket privado sem arquivos, listagem anônima vazia, upload anônimo e pasta sem lead autenticada bloqueados. 12 testes de Estoque/ponte passaram; nenhum pedido criado.
- [ ] Concluir envio válido de pré-seleção e leitura/upload de foto da gôndola por gestão/proprietário versus outro representante — conta Sistemas disponível é cliente e bucket não tem fotos; requer sessão comercial autorizada e foto de teste.
- [ ] Conferir tela e saldo Site SP nesta publicação com sessão comercial — conta Sistemas foi redirecionada ao portal e balcao_cds/balcao_estoque retornaram "Acesso restrito a usuários internos"; bloqueio de cliente confirmado, acesso comercial não verificado.

- [x] Adicionar modo Balcão conforme as opções SNCF: entrega imediata, e-mail obrigatório, NSU e confirmação de PIX; preservar outros CDs, sem banco/edge/publicação
- [x] Conferir venda de evento e resultado com ponte totalmente simulada: maquininha vendido, PIX QR/erro/repetição/vendido, cartão aguardando Safra, próxima venda mantém CD, outro código de evento, retorno ao Site SP; desktop 1280 e celulares 390/360/320 sem rolagem horizontal no evento. Nenhuma criação ou declaração real; topo móvel ajustado só no modo evento.

- [x] Reformular Novo pedido B2C conforme a referência SNCF: cards, resumo lateral, barra no celular, validações básicas e resultado; ponte/edição/outras abas preservadas, 23 testes passaram, sem banco/edge/publicação
- [x] Conferir o formulário B2C no preview: CDs/produtos/fotos/cotação reais, formulário/edição/resultado com dados locais simulados, zero chamadas de criação ou alteração; desktop 1280 e celulares 390/320 conferidos. Diferenças: resumo abaixo do cabeçalho fixo; barra acima da navegação FOP; expedição em observacao; sem imprimir (não existia). O cabeçalho compartilhado transborda em 320px, fora do escopo; o formulário cabe.

- [x] Aba Estoque na Venda B2C: consulta por CD, filtros combinados, indicadores, ordenação e cards no celular; 17 testes e estados simulados desktop/celular conferidos; somente frontend, sem banco/edge/publicação
- [ ] Conferir saldo real na aba Estoque — a ponte retornou `tipo 'balcao_estoque' desconhecido.` na sessão comercial real; a aba mostra a mensagem e permite repetir, mas depende de o serviço reconhecer a consulta

- [x] Porta SNCF `/api/public/catalogo-dimensao-cadastrar` para grupo/coleção/cor, reutilizando a criação do importador, com idempotência, auditoria e testes; 114 testes, tipagem/build e 401 real conferidos; não publicado

- [x] Porta SNCF de cadastro idempotente de coleções, com autenticação Vault, auditoria e cinco testes; rota real sem token retorna 401, sem criar coleções reais nem publicar

- [x] Mapa v2: revisão diária retirada; porta SNCF de gravação e alias público, regras/persistência compartilhadas, testes unitários/401; peso 01497/01513 alterado/restaurado pela rota real, quatro auditorias conferidas; não publicado

- [x] Atualização do dia: grade por produto, rótulos do modelo, filtros, seleção por produto com ações por célula, detalhes recolhidos e paginação; 30 testes e leitura simulada de 3400 células/1200 produtos, sem aplicar nem publicar

- [x] CATALOGO-SHAREPOINT-DIARIO F2: seção Atualização do dia, ponte autenticada `/api/catalogo-planilha-fop`, conflitos, aplicação/descarte; 37 testes e simulações de sucesso/falha sem escrita real; rota `/admin/products` aba Planilha; não publicar

- [x] Corrigir desconto master de Thomer/Joseph no cálculo e serialização de pedido/cotação e conversão; testes de 50%/100% e tetos normais passam
- [ ] Conferir desconto em pedido real enviado ao SNCF — não foi criado pedido comercial para teste; cálculo e serialização estão testados

- [x] Importador de planilha em Admin › Produtos: download, validação, prévia, confirmação, salvamento auditado e resultado
- [x] Testar planilha com dois produtos não ativos em sessão administrativa real: 01497/01513, dois campos atualizados, auditoria conferida e valores originais restaurados pelo importador; sem publicar

- [x] Tratar falhas de consulta SNCF em Pedidos, Farol e Canal sem derrubar a página nem apresentar ausência falsa de pedidos/mensagens
- [ ] Corrigir consulta farol_b2c no SNCF — retorno real aponta coluna vw_gestao_b2c.estagio_derivado inexistente; alteração pertence ao SNCF

- [x] Liberar todos os itens do site, incluindo Jingle Pop, para pedido firme sem restrição de saldo; 22 testes passaram; prévia conferida com 21 itens Jingle Pop liberados e 24 unidades no carrinho como pedido firme, sem criar pedido real nem alterar estoque físico
- [x] Retornar Jingle Pop à autoridade de estoque: zero com Prev vai para provisão, zero sem Prev bloqueia e saldo parcial separa o excedente; 110 testes e carrinho real da prévia conferidos sem salvar provisão

- [x] Ajustar pedidos B2B enviados pela ponte SNCF: permissões, carrinho separado de criação, frete total, pagamento, motivo; edge publicada e 401 sem login; 24 testes passaram
- [ ] Validar ajuste B2B real e prévia comercial — sessão disponível tem papel cliente; simulação visual não concluída
- [ ] Atualizar itens completos do pedido a partir do SNCF após ajuste — contrato fornecido não inclui leitura de itens B2B; Farol fornece total e permissões fornecem frete/condição, mas itens ainda dependem da cópia local

- [x] Garantir pagamento sem_pagamento em bonificação na gravação e ponte; manter contrato Balcão que já grava sem_pagamento no SNCF; testes e apresentação de Carrinho/Balcão com perfil simulado
- [ ] Validar criação/edição/conversão real de bonificação — sessão disponível é cliente, sem acesso comercial; não foi criado pedido real

- [x] Abrir e editar próprios pedidos B2C pela ponte SNCF, conforme permissões retornadas
- [x] Testar alterações parciais, meio de pagamento e motivo (6 testes); pré-preenchimento, sequência, CD, total atualizado e leitura bloqueada em desktop/celular com SNCF simulado
- [ ] Validar edição real com usuário comercial — depende da publicação dos quatro tipos no SNCF e de sessão comercial autorizada

- [x] Centralizar regra de estoque e testes de venda firme/provisão/bloqueio
- [x] Aplicar bloqueio em catálogo, duplicação, cotação, carrinho e checkout
- [x] Derivar status no banco e normalizar produtos existentes
- [x] Verificar 01887 no catálogo, venda firme/provisão, bloqueio dos caminhos alternativos e carrinho antigo
- [ ] Conferência visual do 01887 em Gestão de Produtos: sessão disponível é cliente e não acessa o admin

- [x] Destravar campos no diálogo Editar produto (só SKU/cod_cadastro/ean/dun travados, legenda "emitido pelo cartório")
- [x] Adicionar campo "Preço site (B2C)" na aba Preços (products.preco_site)
- [x] preco_site em productToRow/rowToProduct e tipo Product
- [x] Typecheck + build OK

- [x] Botão "Cancelar pedido" no resumo da Venda B2C (só criação), com confirmação e foco na busca do cliente
