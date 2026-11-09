import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/catalogo-dimensao-criar')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleCatalogDimension } = await import('@/lib/catalogDimensionHandler');
        return handleCatalogDimension(request);
      },
    },
  },
});
