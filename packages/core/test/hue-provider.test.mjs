import assert from 'node:assert/strict';
import test from 'node:test';

import { HueProvider } from '../dist/index.js';

function createProvider() {
  return new HueProvider({
    bridgeIp: '192.168.1.10',
    applicationKey: 'test-key',
  });
}

test('discovers Hue lights', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        1: {
          name: 'Display light left',
          state: {
            on: true,
          },
        },
      };
    },
  });

  try {
    const provider = createProvider();

    const lights = await provider.getLights();

    assert.deepEqual(lights, [
      {
        id: '1',
        name: 'Display light left',
        providerId: 'hue',
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('converts Hue state into LightFusion state', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        name: 'Display light left',
        state: {
          on: true,
          bri: 127,
          hue: 32768,
          sat: 127,
          ct: 300,
          reachable: true,
        },
      };
    },
  });

  try {
    const provider = createProvider();

    const state = await provider.getState('1');

    assert.equal(state.on, true);
    assert.equal(state.brightness, 50);
    assert.ok(Math.abs(state.hue - 180) < 0.01);
    assert.equal(state.saturation, 50);
    assert.equal(state.colorTemperature, 300);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('maps LightFusion state into Hue request values', async () => {
  const originalFetch = globalThis.fetch;
  let request;

  globalThis.fetch = async (url, options) => {
    request = {
      url,
      options,
    };

    return {
      ok: true,
      async json() {
        return [];
      },
    };
  };

  try {
    const provider = createProvider();

    await provider.setState('7', {
      on: true,
      brightness: 50,
      hue: 180,
      saturation: 50,
      colorTemperature: 300,
    });

    assert.equal(
      request.url,
      'http://192.168.1.10/api/test-key/lights/7/state',
    );

    assert.equal(request.options.method, 'PUT');

    assert.deepEqual(
      JSON.parse(request.options.body),
      {
        on: true,
        bri: 127,
        hue: 32768,
        sat: 127,
        ct: 300,
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reports Hue reachability', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        name: 'Display light left',
        state: {
          on: true,
          reachable: false,
        },
      };
    },
  });

  try {
    const provider = createProvider();

    assert.equal(
      await provider.isAvailable('1'),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});