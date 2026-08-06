import type { API, PlatformConfig } from 'homebridge';

export interface LightFusionContext {
  api: API;
  config: PlatformConfig;
}