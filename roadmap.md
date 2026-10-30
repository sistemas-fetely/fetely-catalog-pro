# Roadmap

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
