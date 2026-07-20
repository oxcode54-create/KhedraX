import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCollisions } from '../../src/registry/collisionPolicy.ts';

test('resolveCollisions keeps unique entries and tracks warnings precisely', () => {
  const resolved = resolveCollisions([
    { name: 'alpha', descriptor: { id: 1 }, sourceRoot: '/builtins' },
    { name: 'beta', descriptor: { id: 2 }, sourceRoot: '/builtins' },
    { name: 'gamma', descriptor: { id: 3 }, sourceRoot: '/plugins/one' },
  ]);

  assert.deepEqual(resolved.entries, {
    alpha: { id: 1 },
    beta: { id: 2 },
    gamma: { id: 3 },
  });
  assert.deepEqual(resolved.warnings, []);
});

test('resolveCollisions preserves the built-in entry and warns on plugin shadowing', () => {
  const resolved = resolveCollisions([
    { name: 'memory', descriptor: { id: 'built-in' }, sourceRoot: '/builtins' },
    { name: 'memory', descriptor: { id: 'plugin' }, sourceRoot: '/plugins/one' },
  ]);

  assert.deepEqual(resolved.entries.memory, { id: 'built-in' });
  assert.deepEqual(resolved.warnings, [{
    name: 'memory',
    winningRoot: '/builtins',
    shadowedRoot: '/plugins/one',
  }]);
});

test('resolveCollisions keeps the first plugin entry when two plugin roots collide', () => {
  const resolved = resolveCollisions([
    { name: 'crm', descriptor: { id: 'plugin-one' }, sourceRoot: '/plugins/one' },
    { name: 'crm', descriptor: { id: 'plugin-two' }, sourceRoot: '/plugins/two' },
  ]);

  assert.deepEqual(resolved.entries.crm, { id: 'plugin-one' });
  assert.deepEqual(resolved.warnings, [{
    name: 'crm',
    winningRoot: '/plugins/one',
    shadowedRoot: '/plugins/two',
  }]);
});
