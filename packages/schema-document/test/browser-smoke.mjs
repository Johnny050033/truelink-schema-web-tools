/**
 * Smoke test for the bundles: loads the global script the way a classic <script> page would
 * (no module loader, no DOM), imports the ES module and requires the CommonJS file.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../dist/bundles/truelink-schema-document.global.js', import.meta.url), 'utf8');
assert.ok(source.startsWith(`/*! truelink-schema-document v${pkg.version}`), 'global build carries the version banner');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.TrueLinkSchema = TrueLinkSchema;`, sandbox);
const core = sandbox.TrueLinkSchema;
// Page scripts share the core's realm, so inputs are created inside the sandbox too.
const local = (value) => vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(value))})`, sandbox);

let passed = 0;
function check(name, run) {
  run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

check('exposes the shared core version', () => assert.equal(core.CORE_VERSION, pkg.version));

check('escapes script output', () => {
  const script = core.toJsonLdScript(local({ '@context': 'https://schema.org', '@type': 'Organization', name: '</script><script>alert(1)</script>' }));
  assert.ok(!script.slice(0, -'</script>'.length).includes('</script>'));
  assert.ok(script.includes('\\u003c/script\\u003e'));
});

check('converts TrueLink web tool data both ways', () => {
  let id = 0;
  const stored = {
    mainSchema: { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'Synthetic Café', url: 'https://example.com/' },
    faqs: [{ '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' } }],
    type: 'LocalBusiness',
    whitelistedDomains: 'example.com',
  };
  const imported = core.fromLegacyStoreObj(local(stored), { now: 1, makeId: () => `smoke_${String((id += 1)).padStart(8, '0')}` });
  assert.equal(imported.ok, true);
  assert.equal(imported.main.templateId, 'local-business');
  const exported = core.toLegacyStoreObj(imported.main, { faq: imported.faq, whitelistedDomains: imported.whitelistedDomains });
  assert.equal(exported.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(exported.storeObj)), stored);
});

const esm = await import(new URL('../dist/bundles/truelink-schema-document.mjs', import.meta.url).href);
check('translates through registered catalogs', () => {
  assert.equal(core.LOCALES.length, 7);
  const name = core.getTemplate('event').name;
  assert.equal(core.localize(name, 'es'), name.en);
  core.registerCatalog('es', vm.runInContext(`({ ${JSON.stringify(name.en)}: 'Evento de prueba' })`, sandbox));
  assert.equal(core.localize(name, 'es'), 'Evento de prueba');
  assert.equal(core.localize(name, 'zh-CN'), name['zh-TW']);
});

check('ES module bundle exposes the same API', () => {
  assert.equal(esm.CORE_VERSION, pkg.version);
  assert.equal(typeof esm.auditDocument, 'function');
});

const cjs = createRequire(import.meta.url)('../dist/bundles/truelink-schema-document.cjs');
check('CommonJS bundle works from require()', () => {
  assert.equal(cjs.CORE_VERSION, pkg.version);
  const result = cjs.parseRecord({ format: 'truelink.schema-document', version: 1, id: 'doc_12345678', title: '', templateId: 'thing', data: { '@type': 'Thing' }, updatedAt: 1 });
  assert.equal(result.ok, true);
});

console.log(`\n${passed}/${passed} bundle checks passed`);
