import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };

/**
 * Production Content-Security-Policy. The app makes no network requests besides
 * loading its own files: no third-party scripts, fonts, analytics or APIs.
 * (frame-ancestors cannot be set from a meta tag; configure it on the host.)
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function productionCsp(): Plugin {
  return {
    name: 'truelink:csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<!--app:csp-->', `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    },
  };
}

function listFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path, base) : [relative(base, path).split(sep).join('/')];
  });
}

/** Emits sw.js with a content-hashed precache list of every built and public file. */
function serviceWorker(): Plugin {
  let publicDir = '';
  return {
    name: 'truelink:service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const files = new Set(Object.keys(bundle).filter((file) => !file.endsWith('.map')));
      for (const file of listFiles(publicDir)) files.add(file);
      files.delete('sw.js');
      const precache = [...files].sort();
      const hash = createHash('sha256');
      for (const file of precache) {
        hash.update(file);
        const item = bundle[file];
        if (item?.type === 'chunk') hash.update(item.code);
        else if (item?.type === 'asset') hash.update(typeof item.source === 'string' ? item.source : Buffer.from(item.source));
        else hash.update(readFileSync(join(publicDir, file)));
      }
      const version = hash.digest('hex').slice(0, 16);
      const source = readFileSync(join(root, 'sw', 'service-worker.js'), 'utf8')
        .replace('__SW_VERSION__', version)
        .replace('__SW_PRECACHE__', JSON.stringify(['./', ...precache.map((file) => `./${file}`)], null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), productionCsp(), serviceWorker()],
  resolve: { conditions: ['source', ...defaultClientConditions] },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2022', sourcemap: false, assetsInlineLimit: 0 },
  server: { port: 5173 },
  test: { include: ['test/**/*.test.{ts,tsx}'], environment: 'node' },
});
