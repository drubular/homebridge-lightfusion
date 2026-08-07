import type { LightState } from './light-state.js';

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeHue(value: number): number {
  const normalized = value % 360;

  return normalized < 0
    ? normalized + 360
    : normalized;
}

export function normalizeLightState(
  state: Partial<LightState>,
): Partial<LightState> {
  const normalized: Partial<LightState> = {};

  if (state.on !== undefined) {
    normalized.on = state.on;
  }

  if (state.brightness !== undefined) {
    normalized.brightness = clamp(
      state.brightness,
      0,
      100,
    );
  }

  if (state.hue !== undefined) {
    normalized.hue = normalizeHue(state.hue);
  }

  if (state.saturation !== undefined) {
    normalized.saturation = clamp(
      state.saturation,
      0,
      100,
    );
  }

  if (state.colorTemperature !== undefined) {
    normalized.colorTemperature = clamp(
      state.colorTemperature,
      140,
      500,
    );
  }

  return normalized;
}