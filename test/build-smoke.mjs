import assert from 'node:assert/strict';
import { validateSchema, createSandboxedEmbed } from '../dist/index.js';
import { validateSchema as validateSchemaSubpath } from 'truelink-schema-web-tools/schema';
import { validateEmbed } from 'truelink-schema-web-tools/embed';

assert.equal(validateSchema({ title: 'Synthetic' }, { title: { type: 'string', required: true } }).valid, true);
assert.ok(createSandboxedEmbed({ html: '<p>Synthetic</p>' }).includes('sandbox=""'));
assert.equal(validateSchemaSubpath({ flag: true }, { flag: { type: 'boolean', required: true } }).valid, true);
assert.equal(validateEmbed({ html: '<script>x</script>' }).valid, false);
console.log('Built ESM entry and subpath exports: 4/4 PASS');
