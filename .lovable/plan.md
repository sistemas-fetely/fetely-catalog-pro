# Catálogo diário — destino de gravação no FOP

- Retirar a seção Atualização do dia, arquivos exclusivos e a antiga ponte de leitura/confirmação. Preservar a aba Planilha e seu importador manual.
- Extrair validação por campo, resolução de dimensões e persistência/auditoria para módulos compartilhados com o importador.
- Receber células do SNCF, comparar o valor esperado com o produto vivo, isolar conflitos/erros e gravar apenas campos permitidos. Nunca criar produtos nem alterar fase, ativo, SKU ou preços nessa porta.
- Manter todos os gatilhos existentes e auditar origem, leitura e operador SNCF.
- Testar regras e token inválido; realizar alteração e restauração exclusivamente em 01497/01513, conferindo auditoria. Não publicar.

## Detalhes técnicos
- Implementar `POST /api/catalogo-planilha-aplicar` como solicitado e uma entrada equivalente em `/api/public/catalogo-planilha-aplicar` para chamadas externas: o prefixo público evita a barreira de login da hospedagem, mantendo a autenticação obrigatória pelo token no próprio handler.
- Autenticação com `FSNC_INBOUND_TOKEN` via `get_vault_secret`, comparação segura e validação de até 500 células.
- Cliente normal no importador; cliente de serviço somente no handler após autenticar o SNCF. Sem expor segredos.
- Resposta por ID: aplicada, conflito com valor_atual, ou erro com mensagem.