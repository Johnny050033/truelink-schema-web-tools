#!/usr/bin/env node
/**
 * Translation catalogs for truelink-schema-document.
 *
 *   node scripts/i18n.mjs                 extract source strings, refresh locales/en.json and
 *                                         locales/zh-TW.json, and tidy the translation catalogs
 *   node scripts/i18n.mjs --check         fail if anything is out of date or invalid (used by CI)
 *   node scripts/i18n.mjs --locale ja     only that catalog (with or without --check)
 *   node scripts/i18n.mjs --todo ja       print the source texts that still need a translation
 *
 * Every bundled string is written as `t('中文', 'English')` or through a helper that takes the
 * same pair (see TEXT_CALLS). The English text is the catalog key. Text must be a literal, so
 * every string a user can see is found here; values go in `{slots}` via `fmt()`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE_DIR = join(PACKAGE_ROOT, 'src');
export const LOCALES_DIR = join(PACKAGE_ROOT, 'locales');

/** Locales translated through catalogs (the source languages live in the code). */
export const CATALOG_LOCALES = ['zh-CN', 'ja', 'es', 'pt-BR', 'id'];

/** Calls that take a Chinese and an English text, with the argument index of each. */
export const TEXT_CALLS = {
  t: [0, 1],
  fmt: [0, 1],
  googleLink: [1, 2],
  finding: [4, 5],
  say: [1, 2],
  part: [2, 3],
};

// ---------------------------------------------------------------------------------------------
// Tokenizer: enough of TypeScript to find calls and their string arguments reliably.

const IDENT_START = /[A-Za-z_$]/;
const IDENT_PART = /[A-Za-z0-9_$]/;
const REGEX_AFTER_WORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);

function tokenize(source, file) {
  const tokens = [];
  let i = 0;
  let line = 1;
  const push = (type, value, raw, start) => tokens.push({ type, value, raw, line: start });

  const readQuoted = (quote) => {
    const start = line;
    let value = '';
    let raw = quote;
    i++;
    while (i < source.length && source[i] !== quote) {
      const char = source[i];
      if (char === '\n') throw new Error(`${file}:${line}: unterminated string`);
      if (char === '\\') {
        const [text, length] = readEscape(source, i, file, line);
        value += text;
        raw += source.slice(i, i + length);
        if (source[i + 1] === '\n') line++;
        i += length;
        continue;
      }
      value += char;
      raw += char;
      i++;
    }
    if (i >= source.length) throw new Error(`${file}:${start}: unterminated string`);
    i++;
    push('string', value, raw + quote, start);
  };

  const readTemplate = () => {
    const start = line;
    const begin = i;
    let value = '';
    let substitutions = false;
    i++;
    while (i < source.length && source[i] !== '`') {
      const char = source[i];
      if (char === '\\') {
        const [text, length] = readEscape(source, i, file, line);
        value += text;
        i += length;
        continue;
      }
      if (char === '$' && source[i + 1] === '{') {
        substitutions = true;
        i += 2;
        skipBalanced();
        continue;
      }
      if (char === '\n') line++;
      value += char;
      i++;
    }
    if (i >= source.length) throw new Error(`${file}:${start}: unterminated template literal`);
    i++;
    push(substitutions ? 'template' : 'string', substitutions ? undefined : value, source.slice(begin, i), start);
  };

  // Skips the inside of `${ … }`, including nested strings and templates.
  const skipBalanced = () => {
    let depth = 1;
    while (i < source.length && depth > 0) {
      const char = source[i];
      if (char === '{') depth++;
      else if (char === '}') depth--;
      else if (char === "'" || char === '"') {
        const saved = tokens.length;
        readQuoted(char);
        tokens.length = saved;
        continue;
      } else if (char === '`') {
        const saved = tokens.length;
        readTemplate();
        tokens.length = saved;
        continue;
      } else if (char === '\n') line++;
      i++;
    }
  };

  const regexAllowed = () => {
    const previous = tokens[tokens.length - 1];
    if (!previous) return true;
    if (previous.type === 'word') return REGEX_AFTER_WORDS.has(previous.value);
    if (previous.type === 'number' || previous.type === 'string' || previous.type === 'template') return false;
    return !(previous.value === ')' || previous.value === ']' || previous.value === '}');
  };

  while (i < source.length) {
    const char = source[i];
    if (char === '\n') {
      line++;
      i++;
    } else if (/\s/.test(char)) i++;
    else if (char === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
    } else if (char === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) throw new Error(`${file}:${line}: unterminated comment`);
      for (let k = i; k < end; k++) if (source[k] === '\n') line++;
      i = end + 2;
    } else if (char === "'" || char === '"') readQuoted(char);
    else if (char === '`') readTemplate();
    else if (char === '/' && regexAllowed()) {
      const start = line;
      let inClass = false;
      i++;
      while (i < source.length) {
        const c = source[i];
        if (c === '\n') throw new Error(`${file}:${start}: unterminated regular expression`);
        if (c === '\\') i += 2;
        else {
          if (c === '[') inClass = true;
          else if (c === ']') inClass = false;
          else if (c === '/' && !inClass) break;
          i++;
        }
      }
      i++;
      while (i < source.length && IDENT_PART.test(source[i])) i++;
      push('regex', undefined, undefined, start);
    } else if (IDENT_START.test(char)) {
      const begin = i;
      while (i < source.length && IDENT_PART.test(source[i])) i++;
      push('word', source.slice(begin, i), undefined, line);
    } else if (/[0-9]/.test(char)) {
      const begin = i;
      while (i < source.length && /[0-9A-Za-z_.]/.test(source[i])) i++;
      push('number', source.slice(begin, i), undefined, line);
    } else {
      push('punct', char, undefined, line);
      i++;
    }
  }
  return tokens;
}

function readEscape(source, index, file, line) {
  const next = source[index + 1];
  const simple = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0', "'": "'", '"': '"', '\\': '\\', '`': '`', $: '$' };
  if (next === '\n') return ['', 2];
  if (next === 'x') return [String.fromCharCode(parseInt(source.slice(index + 2, index + 4), 16)), 4];
  if (next === 'u' && source[index + 2] === '{') {
    const end = source.indexOf('}', index + 3);
    return [String.fromCodePoint(parseInt(source.slice(index + 3, end), 16)), end - index + 1];
  }
  if (next === 'u') return [String.fromCharCode(parseInt(source.slice(index + 2, index + 6), 16)), 6];
  if (next in simple) return [simple[next], 2];
  throw new Error(`${file}:${line}: unsupported escape \\${next}`);
}

// ---------------------------------------------------------------------------------------------
// Extraction

function splitArguments(tokens, open) {
  const args = [];
  let current = [];
  let depth = 0;
  for (let k = open + 1; k < tokens.length; k++) {
    const token = tokens[k];
    if (token.type === 'punct' && '([{'.includes(token.value)) depth++;
    if (token.type === 'punct' && ')]}'.includes(token.value)) {
      if (depth === 0) {
        if (current.length) args.push(current);
        return args;
      }
      depth--;
    }
    if (depth === 0 && token.type === 'punct' && token.value === ',') {
      args.push(current);
      current = [];
    } else current.push(token);
  }
  throw new Error('unbalanced call');
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : entry.name.endsWith('.ts') ? [join(directory, entry.name)] : []))
    .sort();
}

/**
 * Finds every translatable string. Returns entries keyed by English text and problems
 * (text that is not a literal). Pairs that are identical in both languages (URLs, codes)
 * are language-neutral and skipped.
 */
export function extract(directory = SOURCE_DIR) {
  const entries = new Map();
  const problems = [];
  for (const path of sourceFiles(directory)) {
    const file = relative(PACKAGE_ROOT, path);
    const tokens = tokenize(readFileSync(path, 'utf8'), file);
    tokens.forEach((token, index) => {
      if (token.type !== 'word' || !Object.hasOwn(TEXT_CALLS, token.value)) return;
      const next = tokens[index + 1];
      const previous = tokens[index - 1];
      if (!next || next.type !== 'punct' || next.value !== '(') return;
      if (previous && ((previous.type === 'punct' && previous.value === '.') || (previous.type === 'word' && previous.value === 'function'))) return;
      const [zhIndex, enIndex] = TEXT_CALLS[token.value];
      const args = splitArguments(tokens, index + 1);
      const zhArg = args[zhIndex];
      const enArg = args[enIndex];
      const where = `${file}:${token.line}`;
      if (!zhArg || !enArg) {
        problems.push(`${where}: ${token.value}() needs a Chinese and an English text`);
        return;
      }
      const passThrough = (arg, name) => arg.length === 1 && arg[0].type === 'word' && arg[0].value === name;
      if (passThrough(zhArg, 'zh') && passThrough(enArg, 'en')) return;
      const literal = (arg) => arg.length === 1 && arg[0].type === 'string';
      if (!literal(zhArg) || !literal(enArg)) {
        const raw = (arg) => arg.map((part) => part.raw ?? part.value ?? '').join(' ');
        if (raw(zhArg) === raw(enArg)) return; // the same expression in both languages: language-neutral
        problems.push(`${where}: ${token.value}() text must be string literals; put values in {slots} with fmt()`);
        return;
      }
      const zh = zhArg[0].value;
      const en = enArg[0].value;
      if (zh === en) return;
      const shared = sourceEntry(en, [zh]);
      if (shared.allowed.length !== shared.required.length && !slotsOf(en).some((slot) => ENGLISH_ONLY_SLOT.test(slot))) problems.push(`${where}: the Chinese and English texts must use the same {slots}`);
      const existing = entries.get(en);
      if (existing) {
        existing.where.push(where);
        if (!existing.zh.includes(zh)) existing.zh.push(zh);
      } else entries.set(en, { zh: [zh], where: [where] });
    });
  }
  return { entries, problems };
}

// ---------------------------------------------------------------------------------------------
// Catalog checks, shared with the Studio's message catalogs.

const SLOT = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

export function slotsOf(text) {
  return [...new Set([...text.matchAll(SLOT)].map((match) => match[1]))].sort();
}

/** Slots such as {aLabel} carry an English article; other languages use the plain slot. */
const ENGLISH_ONLY_SLOT = /^a[A-Z]/;

/**
 * Describes one source text for translators and the checker.
 * `alternatives` are the other source-language versions of the same text (a template may
 * receive the slots of either), so a translation must use the slots common to all versions
 * and may use any slot of any version, except English-only ones.
 */
export function sourceEntry(text, alternatives = []) {
  const versions = [text, ...alternatives].map(slotsOf);
  const allowed = [...new Set(versions.flat())].filter((slot) => !ENGLISH_ONLY_SLOT.test(slot)).sort();
  const required = versions.reduce((common, slots) => common.filter((slot) => slots.includes(slot))).filter((slot) => !ENGLISH_ONLY_SLOT.test(slot));
  return { text, required, allowed };
}

/** Words that would turn guidance into a promise; a source text that mentions them is exempt. */
const PROMISE_WORDS = {
  en: /\bguarantee|\bensures? (?:ranking|rich|citation)|\bwill rank\b/i,
  'zh-TW': /保證|確保(?:排名|曝光|引用)/,
  'zh-CN': /保证|确保(?:排名|曝光|引用)/,
  ja: /保証|必ず(?:表示|掲載|上位)/,
  es: /garantiza|garantía|garantizad/i,
  'pt-BR': /garante|garantia|garantid/i,
  id: /menjamin|jaminan|dijamin|pasti (?:tampil|muncul)/i,
};

const HTML_TAG = /<\/?[a-z][^>]*>/i;
const list = (slots) => (slots.length ? slots.map((slot) => `{${slot}}`).join(' ') : 'none');

/**
 * Validates one translation catalog.
 * @param {string} locale
 * @param {Record<string, { text: string, required: string[], allowed: string[] }>} source by catalog key
 * @param {unknown} catalog parsed JSON
 */
export function checkCatalog(locale, source, catalog) {
  const errors = [];
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) return { errors: [`${locale}: the catalog must be a JSON object`], missing: Object.keys(source), unknown: [] };
  const unknown = [];
  const sourceLocale = locale === 'zh-CN' ? 'zh-TW' : 'en';
  for (const [key, value] of Object.entries(catalog)) {
    const entry = Object.hasOwn(source, key) ? source[key] : undefined;
    if (!entry) {
      unknown.push(key);
      continue;
    }
    const label = `${locale}: ${JSON.stringify(key.length > 70 ? `${key.slice(0, 67)}...` : key)}`;
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${label} must be a non-empty string`);
      continue;
    }
    const used = slotsOf(value);
    const extra = used.filter((slot) => !entry.allowed.includes(slot));
    const dropped = entry.required.filter((slot) => !used.includes(slot));
    if (extra.length || dropped.length) errors.push(`${label} must use the slots ${list(entry.required)}${entry.allowed.length > entry.required.length ? ` (may also use ${list(entry.allowed.filter((slot) => !entry.required.includes(slot)))})` : ''}; found ${list(used)}`);
    if (PROMISE_WORDS[locale]?.test(value) && !PROMISE_WORDS[sourceLocale].test(entry.text)) errors.push(`${label} reads as a guarantee; describe likely effects instead`);
    if (HTML_TAG.test(value) && !HTML_TAG.test(entry.text)) errors.push(`${label} must not add HTML`);
  }
  const missing = Object.keys(source).filter((key) => !(typeof catalog[key] === 'string' && catalog[key].trim()));
  return { errors, missing, unknown };
}

// ---------------------------------------------------------------------------------------------
// Core catalogs

/** Source texts for each catalog locale, keyed as that locale's catalog is keyed. */
export function coreSources(entries) {
  const byEnglish = {};
  const byChinese = {};
  for (const en of [...entries.keys()].sort()) {
    const { zh } = entries.get(en);
    byEnglish[en] = sourceEntry(en, zh);
    for (const variant of zh) byChinese[variant] ??= sourceEntry(variant);
  }
  const sorted = Object.fromEntries(Object.keys(byChinese).sort().map((key) => [key, byChinese[key]]));
  return Object.fromEntries(CATALOG_LOCALES.map((locale) => [locale, locale === 'zh-CN' ? sorted : byEnglish]));
}

/** The generated reference files: every English text, and its Traditional Chinese original. */
export function referenceCatalogs(entries) {
  const keys = [...entries.keys()].sort();
  return {
    en: Object.fromEntries(keys.map((key) => [key, key])),
    'zh-TW': Object.fromEntries(keys.map((key) => [key, entries.get(key).zh[0]])),
  };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return undefined;
    throw new Error(`${relative(PACKAGE_ROOT, path)}: ${error.message}`);
  }
}

export const serialize = (object) => `${JSON.stringify(object, null, 2)}\n`;

/** Orders a catalog like its source and drops keys that no longer exist. */
export function tidy(source, catalog) {
  const out = {};
  for (const key of Object.keys(source)) if (typeof catalog?.[key] === 'string' && catalog[key].trim()) out[key] = catalog[key];
  return out;
}

export function readCatalog(locale) {
  return readJson(join(LOCALES_DIR, `${locale}.json`));
}

export function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!CATALOG_LOCALES.includes(value)) {
    console.error(`${name} needs one of: ${CATALOG_LOCALES.join(', ')}`);
    process.exit(2);
  }
  return value;
}

function main() {
  const check = process.argv.includes('--check');
  const only = option('--locale');
  const todo = option('--todo');
  const { entries, problems } = extract();
  const errors = [...problems];
  const references = referenceCatalogs(entries);
  const sources = coreSources(entries);
  if (todo) {
    const catalog = readCatalog(todo) ?? {};
    const pending = Object.fromEntries(Object.entries(sources[todo]).filter(([key]) => !(typeof catalog[key] === 'string' && catalog[key].trim())).map(([key, entry]) => [key, { english: todo === 'zh-CN' ? Object.keys(references['zh-TW']).find((en) => entries.get(en).zh.includes(key)) : undefined, slots: entry.allowed, required: entry.required }]));
    console.log(JSON.stringify(pending, null, 2));
    return;
  }
  const files = only ? {} : { 'en.json': serialize(references.en), 'zh-TW.json': serialize(references['zh-TW']) };
  const coverage = [];
  for (const locale of CATALOG_LOCALES.filter((item) => !only || item === only)) {
    const catalog = readCatalog(locale) ?? {};
    const result = checkCatalog(locale, sources[locale], catalog);
    errors.push(...result.errors);
    if (result.unknown.length) {
      const message = `${locale}: ${result.unknown.length} entr${result.unknown.length === 1 ? 'y' : 'ies'} no longer match a source text`;
      if (check) errors.push(`${message} (run: pnpm --filter truelink-schema-document i18n)`);
      else console.log(`removed: ${message}`);
    }
    const total = Object.keys(sources[locale]).length;
    const done = total - result.missing.length;
    coverage.push(`${locale} ${Math.floor((done / total) * 100)}% (${done}/${total})`);
    files[`${locale}.json`] = serialize(tidy(sources[locale], catalog));
  }
  const stale = [];
  for (const [name, content] of Object.entries(files)) {
    const path = join(LOCALES_DIR, name);
    let current;
    try {
      current = readFileSync(path, 'utf8');
    } catch {
      current = undefined;
    }
    if (current === content) continue;
    if (check) stale.push(name);
    else writeFileSync(path, content);
  }
  console.log(`${Object.keys(references.en).length} English source texts · ${coverage.join(' · ')}`);
  if (stale.length) errors.push(`out of date: locales/${stale.join(', locales/')} (run: pnpm --filter truelink-schema-document i18n)`);
  if (errors.length) {
    for (const error of errors) console.error(`error: ${error}`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
