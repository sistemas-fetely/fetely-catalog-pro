# Importador de planilha do catálogo

Adicionar **Planilha** dentro de Admin › Produtos, com a mesma permissão administrativa e sem novo menu.

1. Baixar Excel com filtros de coleção/fase, quatro linhas de cabeçalho, colunas de consulta cinzas e listas de referência.
2. Validar o arquivo inteiro sem gravar: chave por código, campos permitidos, números, canal e nomes normalizados. Ignorar células vazias e colunas não autorizadas.
3. Mostrar apenas diferenças, separadas entre ativos e não ativos, erros por linha e valores novos com criação opcional desmarcada. Exportar a prévia.
4. Confirmar os totais, criar os valores selecionados e salvar em blocos de 50 pelo catalogStore, com relações coerentes, auditoria por produto e erros explícitos. Exportar resultado e atualizar catálogo.
5. Cobrir as regras com testes e executar baixar → editar dois produtos não ativos → subir → conferir → confirmar na prévia com uma sessão administrativa autorizada.

## Detalhes técnicos

- ExcelJS carregado sob demanda no navegador; nenhum serviço ou tabela novos.
- Acrescentar ao catalogStore um salvamento aguardável de campos de Produto, compartilhado com a edição, sem escrever Operações, fase ou ativo no importador.
- Preservar triggers e sincronizar-catalogo; sem publicação.
- Caso a sessão disponível não seja administrativa, a confirmação real dependerá de autorização para uma conta administrativa.