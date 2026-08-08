import type { LightState } from './light-state.js';

export interface CalibrationProfile {
  hueOffset?: number;
  saturationScale?: number;
  brightnessScale?: number;
  colorTemperatureOffset?: number;
}

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

export function applyCalibration(
  state: Partial<LightState>,
  profile: CalibrationProfile,
): Partial<LightState> {
  const calibrated: Partial<LightState> = {
    ...state,
  };

  if (
    calibrated.hue !== undefined &&
    profile.hueOffset !== undefined
  ) {
    calibrated.hue = normalizeHue(
      calibrated.hue + profile.hueOffset,
    );
  }

  if (
    calibrated.saturation !== undefined &&
    profile.saturationScale !== undefined
  ) {
    calibrated.saturation = clamp(
      calibrated.saturation * profile.saturationScale,
      0,
      100,
    );
  }

  if (
    calibrated.brightness !== undefined &&
    profile.brightnessScale !== undefined
  ) {
    calibrated.brightness = clamp(
      calibrated.brightness * profile.brightnessScale,
      0,
      100,
    );
  }

  if (
    calibrated.colorTemperature !== undefined &&
    profile.colorTemperatureOffset !== undefined
  ) {
    calibrated.colorTemperature = clamp(
      calibrated.colorTemperature +
        profile.colorTemperatureOffset,
      140,
      500,
    );
  }

  return calibrated;
}