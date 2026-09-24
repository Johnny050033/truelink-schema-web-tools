import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * Self-contained bundles of the shared core for TrueLink tools without a bundler:
 * a global `TrueLinkSchema` script for classic pages (the TrueLink web tool), an ES module,
 * and a CommonJS file for Node.js CommonJS code (for example Cloud Functions).
 */
export default defineConfig({
  build: {
    outDir: 'dist/bundles',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: true,
    lib: {
      entry: 'src/index.ts',
      name: 'TrueLinkSchema',
      formats: ['iife', 'es', 'cjs'],
      fileName: (format) => `truelink-schema-document.${format === 'iife' ? 'global.js' : format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rolldownOptions: { output: { postBanner: `/*! truelink-schema-document v${version} | MIT | https://github.com/Johnny050033/truelink-schema-web-tools */` } },
  },
});
