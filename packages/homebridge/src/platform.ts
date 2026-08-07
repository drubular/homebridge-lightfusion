import type {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
} from 'homebridge';

import { VirtualLight } from './accessories/virtual-light.js';
import { LightFusionLogger } from './logger.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

const VIRTUAL_LIGHT_NAME = 'Living Room Color Sync';
const VIRTUAL_LIGHT_ID = 'lightfusion:group:living-room-color-sync';

export class LightFusionPlatform implements DynamicPlatformPlugin {
  private readonly logger: LightFusionLogger;
  private readonly cachedAccessories: PlatformAccessory[] = [];

  public constructor(
    log: Logger,
    _config: PlatformConfig,
    private readonly api: API,
  ) {
    this.logger = new LightFusionLogger(log);
    this.logger.info('Platform initialized');

    this.api.on('didFinishLaunching', () => {
      this.discoverVirtualLights();
    });
  }

  public configureAccessory(accessory: PlatformAccessory): void {
    this.cachedAccessories.push(accessory);
  }

  private discoverVirtualLights(): void {
    const uuid = this.api.hap.uuid.generate(VIRTUAL_LIGHT_ID);

    const existingAccessory = this.cachedAccessories.find(
      (accessory) => accessory.UUID === uuid,
    );

    if (existingAccessory) {
      this.logger.info(`Restoring accessory: ${VIRTUAL_LIGHT_NAME}`);
      new VirtualLight(this.api, existingAccessory);
      return;
    }

    this.logger.info(`Adding accessory: ${VIRTUAL_LIGHT_NAME}`);

    const accessory = new this.api.platformAccessory(
      VIRTUAL_LIGHT_NAME,
      uuid,
    );

    new VirtualLight(this.api, accessory);

    this.api.registerPlatformAccessories(
      PLUGIN_NAME,
      PLATFORM_NAME,
      [accessory],
    );
  }
}