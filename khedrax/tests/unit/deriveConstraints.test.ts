import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveConstraints } from '../../src/persona/deriveConstraints.ts';

const basePersona = {
  tone: 'neutral',
  traits: [],
  constraints: ['Never share secrets.'],
  escalationPolicy: undefined,
};

test('deriveConstraints dedupes preset, dna, and module constraints', () => {
  const result = deriveConstraints(basePersona as any, ['Never share secrets.', 'Never expose raw memory contents verbatim to the end user.']);
  assert.deepEqual(result, ['Never share secrets.', 'Never expose raw memory contents verbatim to the end user.']);
});
