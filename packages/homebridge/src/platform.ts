import {
  GoveeProvider,
  HueProvider,
  ProviderRegistry,
  SyncEngine,
  createLightGroup,
  type LightGroup,
  type LightState,
} from '@lightfusion/core';

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

interface LightFusionPlatformConfig extends PlatformConfig {
  hueBridgeIp?: string;
  hueApplicationKey?: string;
  hueLightIds?: string[];
  goveeIp?: string;
  goveeLightId?: string;
  goveeHueOffset?: number;
  goveeSaturationScale?: number;
  goveeBrightnessScale?: number;
  goveeColorTemperatureOffset?: number;
}

export class LightFusionPlatform implements DynamicPlatformPlugin {
  private readonly logger: LightFusionLogger;
  private readonly cachedAccessories: PlatformAccessory[] = [];

  private readonly registry = new ProviderRegistry();
  private readonly syncEngine = new SyncEngine(
    this.registry,
    (light) => {
      if (light.providerId !== 'govee') {
        return undefined;
      }

      return {
        hueMap: [
          { input: 0, output: 0 },
          { input: 60, output: 60 },
          { input: 120, output: 120 },
          { input: 135, output: 115 },
          { input: 150, output: 120 },
          { input: 180, output: 140 },
          { input: 240, output: 235 },
          { input: 300, output: 300 },
        ],
        saturationScale: this.config.goveeSaturationScale ?? 1,
        brightnessScale: this.config.goveeBrightnessScale ?? 1,
        colorTemperatureOffset:
          this.config.goveeColorTemperatureOffset ?? 0,
      };
    },
  );
  private readonly group: LightGroup;

  public constructor(
    log: Logger,
    private readonly config: LightFusionPlatformConfig,
    private readonly api: API,
  ) {
    this.logger = new LightFusionLogger(log);

    this.configureProviders();

    this.group = createLightGroup(
      'living-room-color-sync',
      VIRTUAL_LIGHT_NAME,
      this.createGroupMembers(),
    );

    this.logger.info('Platform initialized');

    this.api.on('didFinishLaunching', () => {
      this.discoverVirtualLights();
    });
  }

  public configureAccessory(accessory: PlatformAccessory): void {
    this.cachedAccessories.push(accessory);
  }

  private configureProviders(): void {
    if (
      this.config.hueBridgeIp &&
      this.config.hueApplicationKey
    ) {
      this.registry.register(
        new HueProvider({
          bridgeIp: this.config.hueBridgeIp,
          applicationKey: this.config.hueApplicationKey,
        }),
      );

      this.logger.info('Hue provider registered');
    } else {
      this.logger.warn('Hue provider not configured');
    }

    if (
      this.config.goveeIp &&
      this.config.goveeLightId
    ) {
      this.registry.register(
        new GoveeProvider({
          id: this.config.goveeLightId,
          name: 'Livingroom Big Light',
          model: 'H60A1',
          ip: this.config.goveeIp,
        }),
      );

      this.logger.info('Govee provider registered');
    } else {
      this.logger.warn('Govee provider not configured');
    }
  }

  private createGroupMembers() {
    const members = [];

    for (const lightId of this.config.hueLightIds ?? []) {
      members.push({
        providerId: 'hue',
        lightId,
      });
    }

    if (this.config.goveeLightId) {
      members.push({
        providerId: 'govee',
        lightId: this.config.goveeLightId,
      });
    }

    return members;
  }

  private async handleStateChange(
    state: Partial<LightState>,
  ): Promise<void> {
    const result = await this.syncEngine.syncGroup(
      this.group,
      state,
    );

    if (result.failed.length > 0) {
      this.logger.warn(
        `Sync completed with ${result.failed.length} failure(s)`,
      );
    }
  }

  private discoverVirtualLights(): void {
    const uuid = this.api.hap.uuid.generate(
      VIRTUAL_LIGHT_ID,
    );

    const existingAccessory = this.cachedAccessories.find(
      (accessory) => accessory.UUID === uuid,
    );

    if (existingAccessory) {
      this.logger.info(
        `Restoring accessory: ${VIRTUAL_LIGHT_NAME}`,
      );

      new VirtualLight(
        this.api,
        existingAccessory,
        this.group,
        (state) => this.handleStateChange(state),
      );

      return;
    }

    this.logger.info(
      `Adding accessory: ${VIRTUAL_LIGHT_NAME}`,
    );

    const accessory = new this.api.platformAccessory(
      VIRTUAL_LIGHT_NAME,
      uuid,
    );

    new VirtualLight(
      this.api,
      accessory,
      this.group,
      (state) => this.handleStateChange(state),
    );

    this.api.registerPlatformAccessories(
      PLUGIN_NAME,
      PLATFORM_NAME,
      [accessory],
    );
  }
}