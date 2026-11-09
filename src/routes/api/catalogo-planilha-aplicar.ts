import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/catalogo-planilha-aplicar')({
  server: { handlers: { POST: async ({ request }) => {
    const { handleCatalogSharepoint } = await import('@/lib/catalogSharepointHandler');
    return handleCatalogSharepoint(request);
  } } },
});
