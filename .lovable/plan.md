# Catálogo — atualização diária do SharePoint

- Criar a edge `catalogo-planilha-fop`: autentica o operador, exige admin/master, lê `SNCF_OUTBOUND_TOKEN` exclusivamente por `get_vault_secret` e encaminha `pendentes`/`confirmar` à edge homônima do SNCF, propagando erros.
- Adicionar mapeamento e validação compartilhados para as pendências: somente slugs graváveis do importador, valores convertidos pelas mesmas regras, produto obrigatoriamente existente, valores atuais lidos do FOP e detecção de divergência desde a leitura.
- Acrescentar “Atualização do dia” em `CatalogSpreadsheetTab`: leitura/status, mudanças e conflitos com de/para e escolha planilha/sistema, seleção, aplicar/descartar, sem cadastro e erros.
- Reutilizar `saveProductFields` para aplicar, preservando auditoria e proibições de fase/ativo/SKU/criação; confirmar cada item ao SNCF somente após sucesso, ou resolver conflito em favor do sistema sem gravação.
- Adicionar testes unitários do mapeamento/validação e testar a chamada real à edge; sem leitura real, usar resposta simulada sem gravar produtos. Verificar a prévia e não publicar.

Rota final da fila de Produto: `/admin/products`, aba **Planilha**, seção **Atualização do dia**.
