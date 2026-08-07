import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProviderRegistry,
  SyncEngine,
  createLightGroup,
} from '../dist/index.js';

function createProvider(id, behavior = {}) {
  const calls = [];

  return {
    id,
    calls,

    async getLights() {
      return [];
    },

    async getState() {
      throw new Error('Not implemented for this test');
    },

    async setState(lightId, state) {
      calls.push({
        lightId,
        state,
      });

      if (behavior.failLightId === lightId) {
        throw new Error(`Failed to update ${lightId}`);
      }

      if (behavior.delayMs) {
        await new Promise((resolve) => {
          setTimeout(resolve, behavior.delayMs);
        });
      }
    },

    async isAvailable() {
      return true;
    },
  };
}

test('synchronizes state to every light in a group', async () => {
  const registry = new ProviderRegistry();

  const hue = createProvider('hue');
  const govee = createProvider('govee');

  registry.register(hue);
  registry.register(govee);

  const group = createLightGroup(
    'living-room',
    'Living Room',
    [
      {
        providerId: 'hue',
        lightId: 'display-left',
      },
      {
        providerId: 'hue',
        lightId: 'display-right',
      },
      {
        providerId: 'govee',
        lightId: 'big-light',
      },
    ],
  );

  const engine = new SyncEngine(registry);

  const result = await engine.syncGroup(group, {
    brightness: 50,
  });

  assert.equal(result.successful.length, 3);
  assert.equal(result.failed.length, 0);

  assert.deepEqual(hue.calls, [
    {
      lightId: 'display-left',
      state: {
        brightness: 50,
      },
    },
    {
      lightId: 'display-right',
      state: {
        brightness: 50,
      },
    },
  ]);

  assert.deepEqual(govee.calls, [
    {
      lightId: 'big-light',
      state: {
        brightness: 50,
      },
    },
  ]);
});

test('reports a missing provider without stopping other lights', async () => {
  const registry = new ProviderRegistry();

  const hue = createProvider('hue');

  registry.register(hue);

  const group = createLightGroup(
    'living-room',
    'Living Room',
    [
      {
        providerId: 'hue',
        lightId: 'display-left',
      },
      {
        providerId: 'missing',
        lightId: 'unknown-light',
      },
    ],
  );

  const engine = new SyncEngine(registry);

  const result = await engine.syncGroup(group, {
    on: true,
  });

  assert.equal(result.successful.length, 1);
  assert.equal(result.failed.length, 1);

  assert.equal(
    result.failed[0].error.message,
    'Provider not registered: missing',
  );
});

test('continues syncing when one light fails', async () => {
  const registry = new ProviderRegistry();

  const hue = createProvider('hue', {
    failLightId: 'display-right',
  });

  registry.register(hue);

  const group = createLightGroup(
    'living-room',
    'Living Room',
    [
      {
        providerId: 'hue',
        lightId: 'display-left',
      },
      {
        providerId: 'hue',
        lightId: 'display-right',
      },
      {
        providerId: 'hue',
        lightId: 'tv-left',
      },
    ],
  );

  const engine = new SyncEngine(registry);

  const result = await engine.syncGroup(group, {
    hue: 240,
    saturation: 100,
  });

  assert.equal(result.successful.length, 2);
  assert.equal(result.failed.length, 1);

  assert.equal(
    result.failed[0].light.lightId,
    'display-right',
  );
});

test('sends provider updates concurrently', async () => {
  const registry = new ProviderRegistry();

  const hue = createProvider('hue', {
    delayMs: 100,
  });

  const govee = createProvider('govee', {
    delayMs: 100,
  });

  registry.register(hue);
  registry.register(govee);

  const group = createLightGroup(
    'living-room',
    'Living Room',
    [
      {
        providerId: 'hue',
        lightId: 'display-left',
      },
      {
        providerId: 'govee',
        lightId: 'big-light',
      },
    ],
  );

  const engine = new SyncEngine(registry);

  const startedAt = Date.now();

  await engine.syncGroup(group, {
    brightness: 25,
  });

  const duration = Date.now() - startedAt;

  assert.ok(
    duration < 180,
    `Expected concurrent updates, but took ${duration}ms`,
  );
});