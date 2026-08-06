import type {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
} from 'homebridge';

import { LightFusionLogger } from './logger.js';

export class LightFusionPlatform implements DynamicPlatformPlugin {
  private readonly logger: LightFusionLogger;

  public constructor(
    log: Logger,
    _config: PlatformConfig,
    _api: API,
  ) {
    this.logger = new LightFusionLogger(log);
    this.logger.info('Platform initialized');
  }

  public configureAccessory(_accessory: PlatformAccessory): void {
    // Cached accessories will be restored here in a later milestone.
  }
}