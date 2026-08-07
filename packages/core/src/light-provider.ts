import type { LightState } from './light-state.js';

export interface LightDescriptor {
  id: string;
  name: string;
  providerId: string;
}

export interface LightProvider {
  readonly id: string;

  getLights(): Promise<LightDescriptor[]>;

  getState(lightId: string): Promise<LightState>;

  setState(
    lightId: string,
    state: Partial<LightState>,
  ): Promise<void>;

  isAvailable(lightId: string): Promise<boolean>;
}