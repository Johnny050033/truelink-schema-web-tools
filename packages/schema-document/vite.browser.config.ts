import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * Browser builds of the shared core, for pages without a bundler (for example the TrueLink
 * web tool's classic scripts): a global `TrueLinkSchema` script and an ES module.
 */
export default defineConfig({
  build: {
    outDir: 'dist/browser',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: true,
    lib: {
      entry: 'src/index.ts',
      name: 'TrueLinkSchema',
      formats: ['iife', 'es'],
      fileName: (format) => (format === 'iife' ? 'truelink-schema-document.global.js' : 'truelink-schema-document.browser.mjs'),
    },
    rolldownOptions: { output: { postBanner: `/*! truelink-schema-document v${version} | MIT | https://github.com/Johnny050033/truelink-schema-web-tools */` } },
  },
});
