#!/usr/bin/env node
/**
 * Interface message catalogs (src/i18n/locales). en.json is the source; zh-TW.json is the other
 * source language; every other locale is a translation keyed by message id.
 *
 *   node scripts/i18n.mjs                tidy the translation catalogs (order, drop old keys)
 *   node scripts/i18n.mjs --check        fail if a catalog is invalid or untidy (used by CI)
 *   node scripts/i18n.mjs --locale ja    only that catalog (with or without --check)
 *   node scripts/i18n.mjs --todo ja      print the messages that still need a translation
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG_LOCALES, checkCatalog, option, serialize, sourceEntry, tidy } from '../../../packages/schema-document/scripts/i18n.mjs';

export const MESSAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
export { CATALOG_LOCALES };

export function readMessages(locale) {
  try {
    return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return undefined;
    throw new Error(`src/i18n/locales/${locale}.json: ${error.message}`);
  }
}

/** Source entries for a translation locale: zh-CN translates the Traditional Chinese text. */
export function messageSources(locale) {
  const en = readMessages('en');
  const zh = readMessages('zh-TW');
  const errors = [];
  for (const key of Object.keys(en)) if (typeof zh[key] !== 'string') errors.push(`zh-TW: missing ${key}`);
  for (const key of Object.keys(zh)) if (!Object.hasOwn(en, key)) errors.push(`zh-TW: unknown key ${key}`);
  if (errors.length) throw new Error(errors.join('\n'));
  return Object.fromEntries(Object.keys(en).map((key) => [key, locale === 'zh-CN' ? sourceEntry(zh[key], [en[key]]) : sourceEntry(en[key], [zh[key]])]));
}

function main() {
  const check = process.argv.includes('--check');
  const only = option('--locale');
  const todo = option('--todo');
  if (todo) {
    const en = readMessages('en');
    const zh = readMessages('zh-TW');
    const catalog = readMessages(todo) ?? {};
    const pending = Object.fromEntries(Object.keys(en).filter((key) => !(typeof catalog[key] === 'string' && catalog[key].trim())).map((key) => [key, { en: en[key], 'zh-TW': zh[key] }]));
    console.log(JSON.stringify(pending, null, 2));
    return;
  }
  const errors = [];
  const coverage = [];
  for (const locale of CATALOG_LOCALES.filter((item) => !only || item === only)) {
    const sources = messageSources(locale);
    const catalog = readMessages(locale) ?? {};
    const result = checkCatalog(locale, sources, catalog);
    errors.push(...result.errors);
    if (result.unknown.length) {
      if (check) errors.push(`${locale}: unknown keys ${result.unknown.join(', ')} (run: pnpm --filter truelink-schema-studio i18n)`);
      else console.log(`removed from ${locale}: ${result.unknown.join(', ')}`);
    }
    const total = Object.keys(sources).length;
    const done = total - result.missing.length;
    coverage.push(`${locale} ${Math.floor((done / total) * 100)}% (${done}/${total})`);
    const content = serialize(tidy(sources, catalog));
    const path = join(MESSAGES_DIR, `${locale}.json`);
    let current;
    try {
      current = readFileSync(path, 'utf8');
    } catch {
      current = undefined;
    }
    if (current !== content) {
      if (check) errors.push(`src/i18n/locales/${locale}.json is not tidy (run: pnpm --filter truelink-schema-studio i18n)`);
      else writeFileSync(path, content);
    }
  }
  console.log(`${Object.keys(readMessages('en')).length} messages · ${coverage.join(' · ')}`);
  if (errors.length) {
    for (const error of errors) console.error(`error: ${error}`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
