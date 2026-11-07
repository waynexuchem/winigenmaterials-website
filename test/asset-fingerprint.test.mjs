import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint } from '../scripts/asset-fingerprint.mjs';

test('asset tokens use the established SHA-256 twelve-hex prefix for exact bytes', () => {
  assert.equal(fingerprint(''), 'e3b0c44298fc');
  assert.equal(fingerprint('abc'), 'ba7816bf8f01');
  assert.equal(fingerprint(Buffer.from('abc')), 'ba7816bf8f01');
  assert.notEqual(fingerprint('line\r\n'), fingerprint('line\n'));
});
