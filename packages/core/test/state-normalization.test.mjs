import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeLightState } from '../dist/index.js';

test('clamps brightness to 0 through 100', () => {
  assert.deepEqual(
    normalizeLightState({
      brightness: 150,
    }),
    {
      brightness: 100,
    },
  );

  assert.deepEqual(
    normalizeLightState({
      brightness: -20,
    }),
    {
      brightness: 0,
    },
  );
});

test('wraps hue into the 0 through 360 range', () => {
  assert.deepEqual(
    normalizeLightState({
      hue: 390,
    }),
    {
      hue: 30,
    },
  );

  assert.deepEqual(
    normalizeLightState({
      hue: -30,
    }),
    {
      hue: 330,
    },
  );
});

test('clamps saturation to 0 through 100', () => {
  assert.deepEqual(
    normalizeLightState({
      saturation: 125,
    }),
    {
      saturation: 100,
    },
  );
});

test('clamps color temperature to supported range', () => {
  assert.deepEqual(
    normalizeLightState({
      colorTemperature: 600,
    }),
    {
      colorTemperature: 500,
    },
  );

  assert.deepEqual(
    normalizeLightState({
      colorTemperature: 100,
    }),
    {
      colorTemperature: 140,
    },
  );
});

test('preserves valid partial state values', () => {
  assert.deepEqual(
    normalizeLightState({
      on: true,
      brightness: 42,
      hue: 220,
      saturation: 75,
      colorTemperature: 300,
    }),
    {
      on: true,
      brightness: 42,
      hue: 220,
      saturation: 75,
      colorTemperature: 300,
    },
  );
});