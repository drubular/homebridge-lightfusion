import {
  DEFAULT_LIGHT_STATE,
  type LightState,
} from './light-state.js';

export interface LightGroup {
  id: string;
  name: string;
  state: LightState;
  members: string[];
}

export function createLightGroup(
  id: string,
  name: string,
  members: string[] = [],
): LightGroup {
  return {
    id,
    name,
    state: {
      ...DEFAULT_LIGHT_STATE,
    },
    members: [...members],
  };
}