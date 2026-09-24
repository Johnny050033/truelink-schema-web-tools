import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * Self-contained bundles (shared core included) for TrueLink host pages without a bundler:
 * a global `TrueLinkCloud` script and an ES module.
 */
export default defineConfig({
  resolve: { alias: { 'truelink-schema-document': fileURLToPath(new URL('../schema-document/src/index.ts', import.meta.url)) } },
  build: {
    outDir: 'dist/bundles',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: true,
    lib: {
      entry: 'src/index.ts',
      name: 'TrueLinkCloud',
      formats: ['iife', 'es'],
      fileName: (format) => `truelink-schema-cloud.${format === 'iife' ? 'global.js' : 'mjs'}`,
    },
    rolldownOptions: { output: { postBanner: `/*! truelink-schema-cloud v${version} | MIT | https://github.com/Johnny050033/truelink-schema-web-tools */` } },
  },
});
