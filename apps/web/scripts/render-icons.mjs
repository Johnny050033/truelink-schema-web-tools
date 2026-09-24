/**
 * Rasterizes the app icons from the SVG sources with a local Chromium.
 *
 *   PLAYWRIGHT_MODULE=/path/to/playwright node scripts/render-icons.mjs
 *
 * Playwright is not a project dependency; point PLAYWRIGHT_MODULE at any
 * installed copy (or install one ad hoc). CHROMIUM_PATH optionally selects the
 * browser binary. Output PNGs are committed under public/icons/.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicIcons = join(here, '..', 'public', 'icons');
const modulePath = process.env.PLAYWRIGHT_MODULE ?? 'playwright';
const { chromium } = await import(modulePath.startsWith('/') ? pathToFileURL(join(modulePath, 'index.mjs')).href : modulePath);

const any = readFileSync(join(publicIcons, 'icon.svg'), 'utf8');
const maskable = readFileSync(join(here, 'icon-maskable.svg'), 'utf8');

const outputs = [
  { svg: any, size: 16, file: 'favicon-16.png' },
  { svg: any, size: 32, file: 'favicon-32.png' },
  { svg: any, size: 192, file: 'icon-192.png' },
  { svg: any, size: 512, file: 'icon-512.png' },
  { svg: maskable, size: 180, file: 'apple-touch-icon.png' },
  { svg: maskable, size: 192, file: 'maskable-192.png' },
  { svg: maskable, size: 512, file: 'maskable-512.png' },
];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const { svg, size, file } of outputs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.locator('svg').screenshot({ path: join(publicIcons, file), omitBackground: true });
  console.log(`wrote ${file}`);
}
await browser.close();
