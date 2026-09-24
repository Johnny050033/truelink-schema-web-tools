import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests run against the workspace source of the shared document package.
export default defineConfig({
  resolve: { alias: { 'truelink-schema-document': fileURLToPath(new URL('../schema-document/src/index.ts', import.meta.url)) } },
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
