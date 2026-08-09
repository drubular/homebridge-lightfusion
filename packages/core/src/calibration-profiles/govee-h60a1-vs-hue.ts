import type {
  CalibrationProfile,
} from '../calibration.js';

export const GOVEE_H60A1_VS_HUE_PROFILE: CalibrationProfile = {
  hueMap: [
    { input: 0, output: 0 },
    { input: 60, output: 60 },
    { input: 120, output: 120 },
    { input: 135, output: 115 },
    { input: 150, output: 120 },
    { input: 180, output: 128 },
    { input: 210, output: 160 },
    { input: 240, output: 235 },
    { input: 300, output: 300 },
  ],

  lowSaturation: {
    threshold: 30,
    points: [
      {
        inputHue: 40,
        inputSaturation: 16,
        outputHue: 23,
        outputSaturation: 80,
      },
      {
        inputHue: 117,
        inputSaturation: 2,
        outputHue: 38,
        outputSaturation: 72,
      },
      {
        inputHue: 128,
        inputSaturation: 26,
        outputHue: 110,
        outputSaturation: 72,
      },
      {
        inputHue: 140,
        inputSaturation: 24,
        outputHue: 112,
        outputSaturation: 72,
      },
      {
        inputHue: 162,
        inputSaturation: 8,
        outputHue: 38,
        outputSaturation: 72,
      },
      {
        inputHue: 237,
        inputSaturation: 8,
        outputHue: 38,
        outputSaturation: 72,
      },
      {
        inputHue: 293,
        inputSaturation: 24,
        outputHue: 16,
        outputSaturation: 65,
      },
      {
        inputHue: 331,
        inputSaturation: 22,
        outputHue: 18,
        outputSaturation: 75,
      },
      {
        inputHue: 359,
        inputSaturation: 8,
        outputHue: 21,
        outputSaturation: 72,
      },
    ],
  },

  colorTemperatureOffset: 15,
};