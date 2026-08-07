import assert from 'node:assert/strict';
import test from 'node:test';

import { ProviderRegistry } from '../dist/index.js';

function createProvider(id, lights = []) {
  return {
    id,

    async getLights() {
      return lights;
    },

    async getState() {
      throw new Error('Not implemented for this test');
    },

    async setState() {
      throw new Error('Not implemented for this test');
    },

    async isAvailable() {
      return true;
    },
  };
}

test('registers and retrieves a provider', () => {
  const registry = new ProviderRegistry();
  const provider = createProvider('hue');

  registry.register(provider);

  assert.equal(registry.getProvider('hue'), provider);
});

test('rejects duplicate provider IDs', () => {
  const registry = new ProviderRegistry();

  registry.register(createProvider('hue'));

  assert.throws(
    () => registry.register(createProvider('hue')),
    /Provider already registered: hue/,
  );
});

test('supports multiple providers', () => {
  const registry = new ProviderRegistry();

  const hue = createProvider('hue');
  const govee = createProvider('govee');

  registry.register(hue);
  registry.register(govee);

  assert.deepEqual(registry.getProviders(), [hue, govee]);
});

test('aggregates lights across providers', async () => {
  const registry = new ProviderRegistry();

  registry.register(
    createProvider('hue', [
      {
        id: '1',
        name: 'Display Light Left',
        providerId: 'hue',
      },
    ]),
  );

  registry.register(
    createProvider('govee', [
      {
        id: '1',
        name: 'Livingroom Big Light',
        providerId: 'govee',
      },
    ]),
  );

  const lights = await registry.getLights();

  assert.deepEqual(lights, [
    {
      id: '1',
      name: 'Display Light Left',
      providerId: 'hue',
    },
    {
      id: '1',
      name: 'Livingroom Big Light',
      providerId: 'govee',
    },
  ]);
});

test('returns undefined for an unknown provider', () => {
  const registry = new ProviderRegistry();

  assert.equal(registry.getProvider('unknown'), undefined);
});
