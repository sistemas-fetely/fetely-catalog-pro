import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'bun:test': fileURLToPath(new URL('./node_modules/vitest/dist/index.js', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: [
      'src/lib/catalogSpreadsheet.test.ts',
      'src/lib/catalogDimension.test.ts',
      'src/lib/catalogDimensionRegistration.test.ts',
      'src/lib/catalogSharepointApply.test.ts',
    ],
  },
});