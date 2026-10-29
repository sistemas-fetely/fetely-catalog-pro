# Roadmap

- [ ] Garantir pagamento sem_pagamento em bonificação, edição, conversão de cotação e Balcão; testar preservação das demais condições

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
