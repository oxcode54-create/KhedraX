import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFragmentMeta } from '../../src/prompt/fragmentMetaDefaults.ts';

test('parseFragmentMeta fills defaults for missing and malformed metadata', () => {
  assert.deepEqual(parseFragmentMeta(undefined), { section: 'instructions', priority: 0, exclusive: false });
  assert.deepEqual(parseFragmentMeta({ section: '' }), { section: 'instructions', priority: 0, exclusive: false });
  assert.deepEqual(parseFragmentMeta({ section: 'custom', priority: 'high', exclusive: 'yes' }), { section: 'custom', priority: 0, exclusive: false });
});

test('parseFragmentMeta preserves a fully specified valid metadata object', () => {
  assert.deepEqual(parseFragmentMeta({ section: 'custom', priority: 7, exclusive: true }), { section: 'custom', priority: 7, exclusive: true });
});
