/**
 * Smoke test for the host-page bundle: loads the global script in a bare context (as a
 * classic <script> would) and runs a client against a host over linked transports.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../dist/bundles/truelink-schema-cloud.global.js', import.meta.url), 'utf8');
assert.ok(source.startsWith(`/*! truelink-schema-cloud v${pkg.version}`), 'bundle carries the version banner');

const sandbox = { setTimeout, clearTimeout, queueMicrotask, crypto: globalThis.crypto, URL };
vm.createContext(sandbox);
// Like postMessage, clones must be created in the receiving realm; the protocol rejects foreign objects.
vm.runInContext('globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));', sandbox);
vm.runInContext(`${source}\nthis.TrueLinkCloud = TrueLinkCloud;`, sandbox);
const cloud = sandbox.TrueLinkCloud;
for (const name of ['serveHost', 'createHostClient', 'windowTransport', 'createMemoryHost', 'createLinkedTransports', 'CloudError']) {
  assert.equal(typeof cloud[name], 'function', `exports ${name}`);
}

const host = cloud.createMemoryHost({ account: { displayName: 'Smoke' } });
const { client: clientSide, host: hostSide } = cloud.createLinkedTransports();
cloud.serveHost(host, hostSide, { minCoreVersion: '0.2.0' });
const client = cloud.createHostClient(clientSide, { hostOrigin: 'https://app.truelink-group.com' });
await client.ready();
assert.equal(client.minCoreVersion(), '0.2.0');
const record = vm.runInContext(
  'JSON.parse(\'{"format":"truelink.schema-document","version":1,"id":"doc_12345678","title":"","templateId":"organization","data":{"@type":"Organization","name":"Smoke"},"updatedAt":1}\')',
  sandbox,
);
const saved = await client.saveDraft({ record, expectedRevision: null, idempotencyKey: 'smoke_key_000000000001' });
assert.equal(saved.revision, 1);
client.close();
console.log('bundle smoke: 3/3 PASS (exports, handshake, save round trip)');
