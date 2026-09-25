# Padronizar nomes dos pratos

## Alterações
- Remover as palavras **Raso**, **Fundo** e **Sobremesa** dos nomes comercial e completo dos produtos do grupo Prato.
- Atualizar também as descrições automáticas que repetem esses nomes.
- Manter a classificação interna `tipo` para não afetar filtros, relatórios ou integrações, mas ocultá-la abaixo do nome nas telas de catálogo, produto e fotos.
- Aplicar a mesma padronização na base local de segurança e no banco atual.

## Validação
- Confirmar que nenhum prato mantém essas palavras nos campos de nome/descrição.
- Conferir no catálogo que aparece “Prato •” sem rótulo residual e que os demais produtos continuam exibindo seu tipo normalmente.
- Verificar a compilação e a tela em desktop.
