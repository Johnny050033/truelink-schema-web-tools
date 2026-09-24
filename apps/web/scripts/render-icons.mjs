/**
 * Derives the 192px PWA icons by resizing the official TrueLink 512px app icons.
 *
 *   PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chrome node scripts/render-icons.mjs
 *
 * Sources in public/icons/ are copied unmodified from the TrueLink brand library
 * (TrueLink-SaaS public/assets/brand/02-app-icons and 05-favicon). This script only
 * scales them; brand artwork itself is regenerated in that library, never edited here.
 * Playwright is not a project dependency; point PLAYWRIGHT_MODULE at any installed copy.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const icons = join(here, '..', 'public', 'icons');
const modulePath = process.env.PLAYWRIGHT_MODULE ?? 'playwright';
const { chromium } = await import(modulePath.startsWith('/') ? pathToFileURL(join(modulePath, 'index.mjs')).href : modulePath);

const outputs = [
  { source: 'icon-512.png', size: 192, file: 'icon-192.png' },
  { source: 'maskable-512.png', size: 192, file: 'maskable-192.png' },
];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const { source, size, file } of outputs) {
  const data = readFileSync(join(icons, source)).toString('base64');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent"><img src="data:image/png;base64,${data}" width="${size}" height="${size}" style="display:block;image-rendering:auto"></body></html>`);
  await page.locator('img').screenshot({ path: join(icons, file), omitBackground: true });
  console.log(`wrote ${file}`);
}
await browser.close();
