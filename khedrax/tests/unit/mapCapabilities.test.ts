import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCapabilities } from '../../src/persona/mapCapabilities.ts';

test('mapCapabilities emits one capability description per module capability entry', () => {
  const result = mapCapabilities([
    { name: 'memory', capabilities: ['Recall prior conversation context across sessions.'] },
    { name: 'email', capabilities: ['Send a follow-up email.'] },
  ] as any);

  assert.deepEqual(result, [
    { moduleName: 'memory', description: 'Recall prior conversation context across sessions.' },
    { moduleName: 'email', description: 'Send a follow-up email.' },
  ]);
});

test('mapCapabilities ignores modules with no capabilities field', () => {
  const result = mapCapabilities([{ name: 'memory' }] as any);
  assert.deepEqual(result, []);
});
