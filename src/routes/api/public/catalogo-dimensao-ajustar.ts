import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/catalogo-dimensao-ajustar')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleCatalogDimensionAdjustment } = await import('@/lib/catalogDimensionAdjustmentHandler');
        return handleCatalogDimensionAdjustment(request);
      },
    },
  },
});