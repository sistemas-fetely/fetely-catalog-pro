# Campos fiscais na porta do SNCF (ncm, cest, origem_fisc, origem_prod)

## Respostas da investigação

**1) Allowlist — mesmo código, com um detalhe que trava.**
- Base: `PRODUCT_FIELDS` em `src/lib/catalogSpreadsheet.ts:4`. Os 4 campos fiscais estão em `READ_FIELDS` (linha 6), que é só consulta.
- Importador manual: usa `PRODUCT_FIELDS` direto (`catalogSpreadsheet.ts:86, 90, 102, 113`).
- Rota: `SHAREPOINT_FIELDS = PRODUCT_FIELDS` menos os preços (`src/lib/catalogSharepointApply.ts:16`), checado na linha 22.
- Gravação compartilhada: `saveProductFields` filtra de novo por `PRODUCT_FIELDS` (`src/lib/catalogProductPersistence.ts:18`), e a auditoria também calcula o antes/depois só com `PRODUCT_FIELDS` (linha 28). Por isso, mudar apenas `SHAREPOINT_FIELDS` **não basta**: a célula passaria pela checagem, mas a gravação descartaria o campo e devolveria o erro "Nenhum campo de Produto para atualizar".

**2) Validação de formato hoje: nenhuma.**
- `parseProductValue` (`catalogSpreadsheet.ts:34-51`) trata os 4 campos como texto livre: só tira espaços das pontas.
- O banco aceita qualquer texto (`ncm/cest/origem_fisc/origem_prod TEXT`, migração `20260527024437…sql:26-29`). Não encontrei regra de checagem nem gatilho de formato para esses campos nas migrações.
- Na ficha do produto, a origem fiscal é uma lista lida da tabela `produto_origens_fiscais` (só os ativos; `admin.products.tsx:1268-1295`). Valores fora dela aparecem como "legado". NCM, CEST e origem do produto são caixas de texto livres (linhas 1213-1214 e 1223).

**3) Impacto no importador manual.**
- Se os campos entrarem em `PRODUCT_FIELDS`, **quebra a regra**: o importador manual passaria a gravá-los, e a planilha baixada deixaria de mostrá-los como só consulta. Isso fere a regra de dono (`mem://constraints/catalog-spreadsheet.md`).
- Se entrarem só na lista da rota, o importador não muda, mas a gravação compartilhada precisa aceitar a lista de campos de quem chama (ver item 5).

**4) Resposta por célula e regra de concorrência.**
- Status `aplicada | conflito | erro` com `valor_atual` e `erro` (`catalogSharepointApply.ts:15`).
- `conflito`: quando o `valor_esperado` difere do valor atual (linha 24), via `equalProductValue`. Para texto, a comparação é exata depois de tirar os espaços das pontas: "4823.69.00" é diferente de "48236900".
- Também há proteção na hora de gravar: a gravação só acontece se o valor no banco ainda for o mesmo (`persistProductRow`, linha 11). Se mudou nesse meio-tempo, o resultado vira `conflito` com o valor atual relido (`catalogSharepointApply.ts:69-72`).
- Célula vazia não mexe, e valor igual ao atual devolve `aplicada` sem gravar.
- Tudo isso vale para os 4 campos sem nenhuma mudança, desde que eles cheguem à gravação.

## Proposta mínima

1. Em `catalogSpreadsheet.ts`, criar `FISCAL_FIELDS = ['ncm','cest','origem_fisc','origem_prod']`, sem tocar em `PRODUCT_FIELDS` nem em `READ_FIELDS`. O importador manual e a planilha baixada ficam iguais.
2. `SHAREPOINT_FIELDS` passa a ser os campos de Produto sem preços, mais `FISCAL_FIELDS`.
3. Em `saveProductFields`, aceitar um parâmetro opcional `allowed`, com padrão `PRODUCT_FIELDS`, usado no filtro e na auditoria. A rota passa `SHAREPOINT_FIELDS`. O diálogo de edição e o importador continuam como estão.
4. Validação na rota, como `erro` da célula, com a mensagem crua:
   - ncm: 8 dígitos, aceitando `4823.69.00` ou `48236900`.
   - cest: 7 dígitos, aceitando `19.005.01` ou `1900501`.
   - origem_fisc: código ativo em `produto_origens_fiscais` (hoje 0–8), carregado junto com as outras listas em `loadCatalogLists`.
   - origem_prod: aceitar só `Importado` ou `Nacional`, sem diferenciar maiúsculas e gravando no formato canônico.
5. Ponto a decidir: **gravar com ou sem pontuação**. Proposta: gravar exatamente como o SNCF manda depois de validado (ex.: `4823.69.00`), e comparar o conflito sem pontuação para não gerar conflito falso entre os dois formatos.
6. Testes no módulo compartilhado (`catalogSharepointApply.test.ts`):
   - Cada campo aceito, com formato válido e inválido.
   - Conflito por `valor_esperado`.
   - Importador manual continua ignorando a coluna NCM.
   - Teste real só em 01497/01513, alterando e restaurando, e conferindo `catalog_audit`.
7. Atualizar a memória da planilha e o `AGENTS.md`: fiscais entram só pela porta do SNCF, nunca pelo importador manual. Não publicar.

## Pontos a confirmar
- Formato a gravar no NCM/CEST: com pontos, que é a proposta, ou só dígitos.
- Valores atuais de `origem_prod` no banco: confirmar antes que todos são "Importado"/"Nacional". Isso não foi consultado nesta investigação.
