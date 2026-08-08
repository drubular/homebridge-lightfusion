import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyCalibration,
  ProviderRegistry,
  SyncEngine,
  createLightGroup,
} from '../dist/index.js';

test('applies hue offset with wraparound', () => {
  assert.deepEqual(
    applyCalibration(
      { hue: 350 },
      { hueOffset: 20 },
    ),
    { hue: 10 },
  );
});

test('scales saturation and clamps to 100', () => {
  assert.deepEqual(
    applyCalibration(
      { saturation: 80 },
      { saturationScale: 1.5 },
    ),
    { saturation: 100 },
  );
});

test('scales brightness and clamps to 100', () => {
  assert.deepEqual(
    applyCalibration(
      { brightness: 80 },
      { brightnessScale: 1.5 },
    ),
    { brightness: 100 },
  );
});

test('offsets color temperature and clamps to range', () => {
  assert.deepEqual(
    applyCalibration(
      { colorTemperature: 480 },
      { colorTemperatureOffset: 50 },
    ),
    { colorTemperature: 500 },
  );
});

test('leaves uncalibrated values unchanged', () => {
  assert.deepEqual(
    applyCalibration(
      {
        on: true,
        brightness: 40,
        hue: 220,
        saturation: 70,
        colorTemperature: 300,
      },
      {},
    ),
    {
      on: true,
      brightness: 40,
      hue: 220,
      saturation: 70,
      colorTemperature: 300,
    },
  );
});

test('sync engine applies calibration per light', async () => {
  const calls = [];

  const provider = {
    id: 'test',

    async getLights() {
      return [];
    },

    async getState() {
      throw new Error('Not needed');
    },

    async setState(lightId, state) {
      calls.push({
        lightId,
        state,
      });
    },

    async isAvailable() {
      return true;
    },
  };

  const registry = new ProviderRegistry();
  registry.register(provider);

  const group = createLightGroup(
    'group',
    'Group',
    [
      {
        providerId: 'test',
        lightId: 'a',
      },
      {
        providerId: 'test',
        lightId: 'b',
      },
    ],
  );

  const engine = new SyncEngine(
    registry,
    (light) => {
      if (light.lightId === 'b') {
        return {
          hueOffset: 20,
          saturationScale: 0.8,
        };
      }

      return undefined;
    },
  );

  await engine.syncGroup(group, {
    hue: 350,
    saturation: 100,
  });

  assert.deepEqual(calls, [
    {
      lightId: 'a',
      state: {
        hue: 350,
        saturation: 100,
      },
    },
    {
      lightId: 'b',
      state: {
        hue: 10,
        saturation: 80,
      },
    },
  ]);

  assert.equal(group.state.hue, 350);
  assert.equal(group.state.saturation, 100);
});