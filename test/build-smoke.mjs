import assert from 'node:assert/strict';
import { validateSchema, createSandboxedEmbed } from '../dist/index.js';

assert.equal(validateSchema({ title: 'Synthetic' }, { title: { type: 'string', required: true } }).valid, true);
assert.ok(createSandboxedEmbed({ html: '<p>Synthetic</p>' }).includes('sandbox=""'));
console.log('Built ESM entry: 2/2 PASS');
