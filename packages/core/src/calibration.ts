import type { LightState } from './light-state.js';

export interface HueCalibrationPoint {
  input: number;
  output: number;
}

export interface CalibrationProfile {
  hueOffset?: number;
  hueMap?: HueCalibrationPoint[];
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

function interpolateHue(
  hue: number,
  points: HueCalibrationPoint[],
): number {
  if (points.length === 0) {
    return hue;
  }

  const sorted = [...points]
    .map((point) => ({
      input: normalizeHue(point.input),
      output: normalizeHue(point.output),
    }))
    .sort((a, b) => a.input - b.input);

  const normalizedHue = normalizeHue(hue);

  for (
    let index = 0;
    index < sorted.length - 1;
    index += 1
  ) {
    const start = sorted[index];
    const end = sorted[index + 1];

    if (!start || !end) {
      continue;
    }

    if (
      normalizedHue >= start.input &&
      normalizedHue <= end.input
    ) {
      const range = end.input - start.input;

      if (range === 0) {
        return start.output;
      }

      const progress =
        (normalizedHue - start.input) / range;

      return normalizeHue(
        start.output +
          (end.output - start.output) * progress,
      );
    }
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (!first || !last) {
    return normalizedHue;
  }

  const wrappedHue =
    normalizedHue < first.input
      ? normalizedHue + 360
      : normalizedHue;

  const wrappedEndInput = first.input + 360;
  const range = wrappedEndInput - last.input;

  if (range === 0) {
    return last.output;
  }

  const progress =
    (wrappedHue - last.input) / range;

  let outputDelta =
    first.output - last.output;

  if (outputDelta > 180) {
    outputDelta -= 360;
  } else if (outputDelta < -180) {
    outputDelta += 360;
  }

  return normalizeHue(
    last.output + outputDelta * progress,
  );
}

export function applyCalibration(
  state: Partial<LightState>,
  profile: CalibrationProfile,
): Partial<LightState> {
  const calibrated: Partial<LightState> = {
    ...state,
  };

  if (calibrated.hue !== undefined) {
    if (
      profile.hueMap !== undefined &&
      profile.hueMap.length > 0
    ) {
      calibrated.hue = interpolateHue(
        calibrated.hue,
        profile.hueMap,
      );
    } else if (
      profile.hueOffset !== undefined
    ) {
      calibrated.hue = normalizeHue(
        calibrated.hue +
          profile.hueOffset,
      );
    }
  }

  if (
    calibrated.saturation !== undefined &&
    profile.saturationScale !== undefined
  ) {
    calibrated.saturation = clamp(
      calibrated.saturation *
        profile.saturationScale,
      0,
      100,
    );
  }

  if (
    calibrated.brightness !== undefined &&
    profile.brightnessScale !== undefined
  ) {
    calibrated.brightness = clamp(
      calibrated.brightness *
        profile.brightnessScale,
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