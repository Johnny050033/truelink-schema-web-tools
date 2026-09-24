#!/usr/bin/env node
/**
 * Layout QA for every interface language: visits the main screens at desktop and phone widths
 * and reports horizontal scrolling, clipped or off-screen controls, unfilled {slots}, a missing
 * <html lang> and console errors. Screenshots go to OUT.
 *
 *   pnpm --filter truelink-schema-studio build && pnpm --filter truelink-schema-studio preview &
 *   node apps/web/scripts/qa-locales.mjs
 *
 * Env: BASE (default http://localhost:4173/), LOCALES (comma list), OUT (screenshot folder),
 * CHROMIUM_PATH (browser binary, if Playwright's own is not installed). Requires Playwright,
 * installed locally or globally (`npm i -g playwright`). Exits 1 when an issue is found.
 */
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(join(globalRoot, 'playwright', 'index.mjs')).href);
  }
}

const { chromium } = await loadPlaywright();
const BASE = process.env.BASE ?? 'http://localhost:4173/';
const OUT = process.env.OUT ?? join(tmpdir(), 'schema-studio-qa');
const LOCALES = (process.env.LOCALES ?? 'en,zh-TW,zh-CN,ja,es,pt-BR,id').split(',');
const ROUTES = ['#/', '#/doc/demo-cafe', '#/templates', '#/library', '#/brand', '#/transfer', '#/account', '#/settings'];
const VIEWPORTS = [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]];
mkdirSync(OUT, { recursive: true });

// Synthetic sample document so the editor and previews have content.
const now = Date.now();
const doc = {
  id: 'demo-cafe', title: '', templateId: 'local-business', createdAt: now - 86_400_000, updatedAt: now - 60_000, revision: 1,
  data: {
    '@context': 'https://schema.org', '@type': 'CafeOrCoffeeShop', name: 'Morning Light Café', url: 'https://example.com/', telephone: '+1-503-555-0142',
    address: { '@type': 'PostalAddress', streetAddress: '12 Harbor Street', addressLocality: 'Portland', addressRegion: 'OR', addressCountry: 'US' },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '18:00' }],
    sameAs: ['https://www.facebook.com/example'], priceRange: '$$', foundingDate: '2019',
  },
};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const report = [];
for (const locale of LOCALES) {
  for (const [label, viewport] of VIEWPORTS) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: 'light', locale: 'en-US' });
    await context.addInitScript(([docs, prefs]) => {
      if (sessionStorage.getItem('qa-seeded')) return;
      localStorage.setItem('truelink-schema-studio:v1:docs', docs);
      localStorage.setItem('truelink-schema-studio:v1:prefs', prefs);
      sessionStorage.setItem('qa-seeded', '1');
    }, [JSON.stringify([doc]), JSON.stringify({ theme: 'light', locale, exportCount: 0, nudgeDismissedAt: now, installDismissedAt: now })]);
    const page = await context.newPage();
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    for (const route of ROUTES) {
      await page.goto(`${BASE}${route}`);
      await page.waitForTimeout(700);
      const result = await page.evaluate(() => {
        const issues = [];
        if (document.documentElement.scrollWidth > window.innerWidth + 1) issues.push(`page scrolls horizontally (${document.documentElement.scrollWidth}px)`);
        for (const el of document.querySelectorAll('button, .btn, .chip, .tab, .bottom-label, .choice, summary, .menu-item, h1, h2, h3, .template-name')) {
          if (el.offsetParent === null || el.closest('.sr-only')) continue;
          const style = getComputedStyle(el);
          const text = (el.textContent ?? '').trim().slice(0, 60);
          if (el.scrollWidth > el.clientWidth + 2 && (style.overflow === 'hidden' || style.textOverflow === 'ellipsis' || style.whiteSpace === 'nowrap')) issues.push(`clipped: "${text}"`);
          if (el.getBoundingClientRect().right > window.innerWidth + 1) issues.push(`off-screen: "${text}"`);
        }
        const slots = [...document.body.innerText.matchAll(/\{[A-Za-z][A-Za-z0-9]*\}/g)].map((match) => match[0]);
        if (slots.length) issues.push(`unfilled slots: ${[...new Set(slots)].join(' ')}`);
        return { issues: [...new Set(issues)].slice(0, 12), lang: document.documentElement.lang };
      });
      if (result.issues.length) report.push(`${locale} ${label} ${route}: ${result.issues.join(' | ')}`);
      if (route === '#/' && locale !== 'en' && result.lang === 'en') report.push(`${locale} ${label}: <html lang> is still "en"`);
      if (['#/', '#/doc/demo-cafe', '#/settings'].includes(route)) await page.screenshot({ path: join(OUT, `${locale}-${label}-${route.replace(/[#/]/g, '') || 'home'}.png`) });
    }
    if (errors.length) report.push(`${locale} ${label}: console errors: ${[...new Set(errors)].join(' | ')}`);
    await context.close();
  }
}
await browser.close();
console.log(report.length ? report.join('\n') : `no layout issues found (${LOCALES.length} languages; screenshots in ${OUT})`);
if (report.length) process.exitCode = 1;
