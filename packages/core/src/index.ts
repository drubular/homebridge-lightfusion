export {
  DEFAULT_LIGHT_STATE,
  type LightState,
} from './light-state.js';

export {
  createLightGroup,
  updateLightGroupState,
  type LightGroup,
  type LightReference,
} from './light-group.js';

export {
  type LightDescriptor,
  type LightProvider,
} from './light-provider.js';

export {
  SyncEngine,
  type SyncFailure,
  type SyncResult,
} from './sync-engine.js';

export {
  HueProvider,
  type HueProviderConfig,
} from './providers/hue-provider.js';

export {
  GoveeProvider,
  type GoveeProviderConfig,
} from './providers/govee-provider.js';

export { ProviderRegistry } from './provider-registry.js';
export { normalizeLightState } from './state-normalization.js';

export const LIGHTFUSION_CORE_VERSION = '0.0.0';