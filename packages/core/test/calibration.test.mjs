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

test('applies exact brightness calibration point', () => {
  assert.deepEqual(
    applyCalibration(
      { brightness: 50 },
      {
        brightnessMap: [
          { input: 25, output: 10 },
          { input: 50, output: 28 },
          { input: 75, output: 62 },
        ],
      },
    ),
    { brightness: 28 },
  );
});

test('interpolates brightness calibration points', () => {
  assert.deepEqual(
    applyCalibration(
      { brightness: 37.5 },
      {
        brightnessMap: [
          { input: 25, output: 10 },
          { input: 50, output: 28 },
        ],
      },
    ),
    { brightness: 19 },
  );
});

test('brightness map takes precedence over brightness scale', () => {
  assert.deepEqual(
    applyCalibration(
      { brightness: 50 },
      {
        brightnessScale: 2,
        brightnessMap: [
          { input: 50, output: 28 },
        ],
      },
    ),
    { brightness: 28 },
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
test('maps hue using calibration anchors', () => {
  assert.deepEqual(
    applyCalibration(
      { hue: 150 },
      {
        hueMap: [
          { input: 120, output: 120 },
          { input: 180, output: 160 },
        ],
      },
    ),
    { hue: 140 },
  );
});

test('interpolates hue across wraparound range', () => {
  assert.deepEqual(
    applyCalibration(
      { hue: 240 },
      {
        hueMap: [
          { input: 120, output: 120 },
          { input: 180, output: 160 },
        ],
      },
    ),
    { hue: 152 },
  );
});

test('applies exact measured low-saturation calibration point', () => {
  const result = applyCalibration(
    {
      hue: 162,
      saturation: 8,
    },
    {
      lowSaturation: {
        threshold: 25,
        points: [
          {
            inputHue: 162,
            inputSaturation: 8,
            outputHue: 38,
            outputSaturation: 72,
          },
          {
            inputHue: 40,
            inputSaturation: 16,
            outputHue: 23,
            outputSaturation: 80,
          },
        ],
      },
    },
  );

  assert.deepEqual(result, {
    hue: 38,
    saturation: 72,
  });
});

test('applies second measured low-saturation calibration point', () => {
  const result = applyCalibration(
    {
      hue: 40,
      saturation: 16,
    },
    {
      lowSaturation: {
        threshold: 25,
        points: [
          {
            inputHue: 162,
            inputSaturation: 8,
            outputHue: 38,
            outputSaturation: 72,
          },
          {
            inputHue: 40,
            inputSaturation: 16,
            outputHue: 23,
            outputSaturation: 80,
          },
        ],
      },
    },
  );

  assert.deepEqual(result, {
    hue: 23,
    saturation: 80,
  });
});

test('leaves saturation at or above threshold unchanged', () => {
  const result = applyCalibration(
    {
      hue: 120,
      saturation: 25,
    },
    {
      lowSaturation: {
        threshold: 25,
        points: [
          {
            inputHue: 162,
            inputSaturation: 8,
            outputHue: 38,
            outputSaturation: 72,
          },
          {
            inputHue: 40,
            inputSaturation: 16,
            outputHue: 23,
            outputSaturation: 80,
          },
        ],
      },
    },
  );

  assert.deepEqual(result, {
    hue: 120,
    saturation: 25,
  });
});

test('applies exact medium-saturation color calibration point', () => {
    const result = applyCalibration(
      {
        hue: 286,
        saturation: 44,
      },
      {
        colorMap: {
          minimumSaturation: 35,
          maximumSaturation: 60,
          points: [
            {
              inputHue: 270,
              inputSaturation: 40,
              outputHue: 325,
              outputSaturation: 55,
            },
            {
              inputHue: 286,
              inputSaturation: 44,
              outputHue: 340,
              outputSaturation: 60,
            },
            {
              inputHue: 300,
              inputSaturation: 50,
              outputHue: 340,
              outputSaturation: 60,
            },
          ],
        },
      },
    );

    assert.deepEqual(result, {
      hue: 340,
      saturation: 60,
    });
  });

  test('interpolates medium-saturation color calibration', () => {
    const result = applyCalibration(
      {
        hue: 278,
        saturation: 42,
      },
      {
        colorMap: {
          minimumSaturation: 35,
          maximumSaturation: 60,
          points: [
            {
              inputHue: 270,
              inputSaturation: 40,
              outputHue: 325,
              outputSaturation: 55,
            },
            {
              inputHue: 286,
              inputSaturation: 44,
              outputHue: 340,
              outputSaturation: 60,
            },
          ],
        },
      },
    );

    assert.equal(
      Math.round(result.hue),
      333,
    );

    assert.equal(
      Math.round(result.saturation),
      58,
    );
  });

  test('leaves color map inactive outside saturation band', () => {
    const result = applyCalibration(
      {
        hue: 286,
        saturation: 80,
      },
      {
        colorMap: {
          minimumSaturation: 35,
          maximumSaturation: 60,
          points: [
            {
              inputHue: 286,
              inputSaturation: 44,
              outputHue: 340,
              outputSaturation: 60,
            },
          ],
        },
      },
    );

    assert.deepEqual(result, {
      hue: 286,
      saturation: 80,
    });
  });