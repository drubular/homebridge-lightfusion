import assert from 'node:assert/strict';
import test from 'node:test';

import { GoveeProvider } from '../dist/index.js';

function createProvider() {
  return new GoveeProvider({
    apiKey: 'test-api-key',
    devices: [
      {
        id: 'device-123',
        name: 'Livingroom Big Light',
        model: 'H60A1',
      },
      {
        id: 'device-456',
        name: "Brie's ceiling light 1",
        model: 'H801C',
      },
    ],
  });
}

test('exposes configured Govee lights', async () => {
  const provider = createProvider();

  assert.deepEqual(
    await provider.getLights(),
    [
      {
        id: 'device-123',
        name: 'Livingroom Big Light',
        providerId: 'govee',
      },
      {
        id: 'device-456',
        name: "Brie's ceiling light 1",
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

test('reads Govee state from capability API', async () => {
  const provider = createProvider();

  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (
    url,
    options,
  ) => {
    assert.equal(
      url,
      'https://openapi.api.govee.com/router/api/v1/device/state',
    );

    assert.equal(
      options.headers['Govee-API-Key'],
      'test-api-key',
    );

    const body =
      JSON.parse(options.body);

    assert.equal(
      body.payload.device,
      'device-123',
    );

    assert.equal(
      body.payload.sku,
      'H60A1',
    );

    return new Response(
      JSON.stringify({
        code: 200,
        msg: 'success',
        payload: {
          capabilities: [
            {
              type:
                'devices.capabilities.online',
              instance: 'online',
              state: {
                value: true,
              },
            },
            {
              type:
                'devices.capabilities.on_off',
              instance: 'powerSwitch',
              state: {
                value: 1,
              },
            },
            {
              type:
                'devices.capabilities.range',
              instance: 'brightness',
              state: {
                value: 75,
              },
            },
            {
              type:
                'devices.capabilities.color_setting',
              instance: 'colorRgb',
              state: {
                value: 16711680,
              },
            },
            {
              type:
                'devices.capabilities.color_setting',
              instance:
                'colorTemperatureK',
              state: {
                value: 4000,
              },
            },
          ],
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type':
            'application/json',
        },
      },
    );
  };

  try {
    const state =
      await provider.getState(
        'device-123',
      );

    assert.equal(state.on, true);
    assert.equal(
      state.brightness,
      75,
    );

    assert.ok(
      Math.abs(state.hue - 0) < 0.01,
    );

    assert.ok(
      Math.abs(
        state.saturation - 100,
      ) < 0.01,
    );

    assert.equal(
      state.colorTemperature,
      250,
    );
  } finally {
    globalThis.fetch =
      originalFetch;
  }
});

test('sends Govee brightness capability command', async () => {
  const provider = createProvider();

  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (
    url,
    options,
  ) => {
    assert.equal(
      url,
      'https://openapi.api.govee.com/router/api/v1/device/control',
    );

    assert.equal(
      options.method,
      'POST',
    );

    assert.equal(
      options.headers['Govee-API-Key'],
      'test-api-key',
    );

    const body =
      JSON.parse(options.body);

    assert.equal(
      body.payload.device,
      'device-456',
    );

    assert.equal(
      body.payload.sku,
      'H801C',
    );

    assert.deepEqual(
      body.payload.capability,
      {
        type:
          'devices.capabilities.range',
        instance: 'brightness',
        value: 42,
      },
    );

    return new Response(
      JSON.stringify({
        code: 200,
        message: 'success',
      }),
      {
        status: 200,
        headers: {
          'Content-Type':
            'application/json',
        },
      },
    );
  };

  try {
    await provider.setState(
      'device-456',
      {
        brightness: 42,
      },
    );
  } finally {
    globalThis.fetch =
      originalFetch;
  }
});

test('reports online Govee device as available', async () => {
  const provider = createProvider();

  const originalFetch = globalThis.fetch;

  globalThis.fetch =
    async () =>
      new Response(
        JSON.stringify({
          data: {
            capabilities: [
              {
                type:
                  'devices.capabilities.online',
                instance: 'online',
                state: {
                  value: true,
                },
              },
            ],
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type':
              'application/json',
          },
        },
      );

  try {
    assert.equal(
      await provider.isAvailable(
        'device-123',
      ),
      true,
    );
  } finally {
    globalThis.fetch =
      originalFetch;
  }
});
