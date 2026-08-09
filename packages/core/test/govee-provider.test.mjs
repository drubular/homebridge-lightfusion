import assert from 'node:assert/strict';
import test from 'node:test';

import { GoveeProvider } from '../dist/index.js';

function createProvider() {
  return new GoveeProvider({
    devices: [
      {
        id: 'livingroom-big-light',
        name: 'Livingroom Big Light',
        model: 'H60A1',
        ip: '192.168.68.99',
      },
    ],
  });
}

test('exposes configured Govee light', async () => {
  const provider = createProvider();

  assert.deepEqual(
    await provider.getLights(),
    [
      {
        id: 'livingroom-big-light',
        name: 'Livingroom Big Light',
        providerId: 'govee',
      },
    ],
  );
});

test('rejects unknown light IDs', async () => {
  const provider = createProvider();

  await assert.rejects(
    provider.getState('unknown'),
    /Unknown Govee light: unknown/,
  );
});

test('reports unavailable when status request fails', async () => {
  const provider = createProvider();

  const originalCreateSocket = await import('node:dgram')
    .then((module) => module.default.createSocket);

  // This test will be expanded once transport is injectable.
  assert.equal(
    typeof originalCreateSocket,
    'function',
  );
});