import {
  DEFAULT_LIGHT_STATE,
  type LightState,
} from './light-state.js';

export interface LightReference {
  providerId: string;
  lightId: string;
}

export interface LightGroup {
  id: string;
  name: string;
  state: LightState;
  members: LightReference[];
}

export function createLightGroup(
  id: string,
  name: string,
  members: LightReference[] = [],
): LightGroup {
  return {
    id,
    name,
    state: {
      ...DEFAULT_LIGHT_STATE,
    },
    members: members.map((member) => ({ ...member })),
  };
}