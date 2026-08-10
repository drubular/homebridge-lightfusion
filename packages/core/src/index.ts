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

export {
  applyCalibration,
  type CalibrationProfile,
  type HueCalibrationPoint,
  type LowSaturationCalibration,
} from './calibration.js';

export {
  GOVEE_H60A1_VS_HUE_PROFILE,
} from './calibration-profiles/govee-h60a1-vs-hue.js';

export {
  discoverGoveeDevices,
  type DiscoveredGoveeDevice,
} from './providers/govee-discovery.js';

export {
  discoverHueBridges,
  type DiscoveredHueBridge,
} from './providers/hue-discovery.js';

export { ProviderRegistry } from './provider-registry.js';
export { normalizeLightState } from './state-normalization.js';

export const LIGHTFUSION_CORE_VERSION = '0.0.0';