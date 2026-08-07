export interface LightState {
  on: boolean;
  brightness: number;
  hue: number;
  saturation: number;
  colorTemperature: number;
}

export const DEFAULT_LIGHT_STATE: Readonly<LightState> = {
  on: false,
  brightness: 100,
  hue: 0,
  saturation: 0,
  colorTemperature: 370,
};