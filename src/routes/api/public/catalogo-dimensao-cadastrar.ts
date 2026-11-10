import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/catalogo-dimensao-cadastrar')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleCatalogDimensionRegistration } = await import('@/lib/catalogDimensionRegistrationHandler');
        return handleCatalogDimensionRegistration(request);
      },
    },
  },
});
