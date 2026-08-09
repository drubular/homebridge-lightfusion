import {
  GOVEE_H60A1_VS_HUE_PROFILE,
  GoveeProvider,
  HueProvider,
  ProviderRegistry,
  SyncEngine,
  createLightGroup,
  type LightGroup,
  type LightReference,
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


const DEFAULT_GROUP_NAME = 'LightFusion Color Sync';
const DEFAULT_GROUP_ID = 'lightfusion:group:default';

interface LightFusionGoveeConfig {
  id: string;
  name?: string;
  model?: string;
  ip: string;
  calibrationProfile?: string;
  hueOffset?: number;
  saturationScale?: number;
  brightnessScale?: number;
  colorTemperatureOffset?: number;
}

interface LightFusionGroupConfig {
  id: string;
  name: string;
  hueLightIds: string[];
  govee?: LightFusionGoveeConfig;
}

interface LightFusionPlatformConfig extends PlatformConfig {
  hueBridgeIp?: string;
  hueApplicationKey?: string;

  groups?: LightFusionGroupConfig[];

  // Temporary legacy single-group configuration.
  groupName?: string;
  groupId?: string;
  hueLightIds?: string[];

  goveeIp?: string;
  goveeLightId?: string;
  goveeName?: string;
  goveeModel?: string;
  calibrationProfile?: string;

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
    (light: LightReference) => {
      if (light.providerId !== 'govee') {
        return undefined;
      }

      const govee =
        this.getGoveeConfig(light.lightId);

      if (!govee) {
        return undefined;
      }

      const profile =
        govee.calibrationProfile ===
          'govee-h60a1-vs-hue'
          ? GOVEE_H60A1_VS_HUE_PROFILE
          : undefined;

      if (!profile) {
        return undefined;
      }
      return {
        ...profile,

        ...(govee.hueOffset !== undefined
          ? { hueOffset: govee.hueOffset }
          : {}),

        saturationScale:
          govee.saturationScale ?? 1,

        brightnessScale:
          govee.brightnessScale ?? 1,

        colorTemperatureOffset:
          govee.colorTemperatureOffset ??
          profile.colorTemperatureOffset ??
          15,
      };
    },
  );
  private readonly groups: LightGroup[] = [];

  public constructor(
    log: Logger,
    private readonly config: LightFusionPlatformConfig,
    private readonly api: API,
  ) {
    this.logger = new LightFusionLogger(log);

    this.configureProviders();

    const configuredGroups: LightFusionGroupConfig[] =
      this.config.groups && this.config.groups.length > 0
        ? this.config.groups
        : [
          {
            id:
              this.config.groupId ??
              'lightfusion:group:living-room-color-sync',
            name:
              this.config.groupName ??
              'Living Room Color Sync',
            hueLightIds: this.config.hueLightIds ?? [],
            ...(this.config.goveeIp &&
              this.config.goveeLightId
              ? {
                govee: {
                  id: this.config.goveeLightId,
                  ip: this.config.goveeIp,
                },
              }
              : {}),
          },
        ];

    for (const groupConfig of configuredGroups) {
      this.groups.push(
        createLightGroup(
          groupConfig.id,
          groupConfig.name,
          this.createGroupMembers(groupConfig),
        ),
      );
    }

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

    const configuredGoveeLights =
      this.config.groups && this.config.groups.length > 0
        ? this.config.groups
          .map((group) => group.govee)
          .filter(
            (
              govee,
            ): govee is LightFusionGoveeConfig =>
              govee !== undefined,
          )
        : this.config.goveeIp &&
          this.config.goveeLightId
          ? [
            {
              id: this.config.goveeLightId,
              name:
                this.config.goveeName ??
                'Govee Light',
              model:
                this.config.goveeModel ??
                'unknown',
              ip: this.config.goveeIp,
            },
          ]
          : [];

    for (const govee of configuredGoveeLights) {
      this.registry.register(
        new GoveeProvider({
          id: govee.id,
          name: govee.name ?? 'Govee Light',
          model: govee.model ?? 'unknown',
          ip: govee.ip,
        }),
      );

      this.logger.info(
        `Govee provider registered: ${govee.name ?? govee.id}`,
      );
    }

    if (configuredGoveeLights.length === 0) {
      this.logger.warn('Govee provider not configured');
    }
  }

  private getGoveeConfig(
    lightId: string,
  ): LightFusionGoveeConfig | undefined {
    if (
      this.config.groups &&
      this.config.groups.length > 0
    ) {
      for (const group of this.config.groups) {
        if (group.govee?.id === lightId) {
          return group.govee;
        }
      }

      return undefined;
    }

    if (
      this.config.goveeLightId === lightId &&
      this.config.goveeIp
    ) {
      return {
        id: lightId,
        ip: this.config.goveeIp,
        ...(this.config.goveeName
          ? { name: this.config.goveeName }
          : {}),
        ...(this.config.goveeModel
          ? { model: this.config.goveeModel }
          : {}),
        ...(this.config.calibrationProfile
          ? {
            calibrationProfile:
              this.config.calibrationProfile,
          }
          : {}),
        ...(this.config.goveeHueOffset !== undefined
          ? { hueOffset: this.config.goveeHueOffset }
          : {}),
        ...(this.config.goveeSaturationScale !== undefined
          ? {
            saturationScale:
              this.config.goveeSaturationScale,
          }
          : {}),
        ...(this.config.goveeBrightnessScale !== undefined
          ? {
            brightnessScale:
              this.config.goveeBrightnessScale,
          }
          : {}),
        ...(this.config.goveeColorTemperatureOffset !== undefined
          ? {
            colorTemperatureOffset:
              this.config.goveeColorTemperatureOffset,
          }
          : {}),
      };
    }

    return undefined;
  }

  private createGroupMembers(
    groupConfig: LightFusionGroupConfig,
  ) {
    const members = [];

    for (const lightId of groupConfig.hueLightIds) {
      members.push({
        providerId: 'hue',
        lightId,
      });
    }

    if (groupConfig.govee) {
      members.push({
        providerId: 'govee',
        lightId: groupConfig.govee.id,
      });
    }

    return members;
  }

  private async handleStateChange(
    group: LightGroup,
    state: Partial<LightState>,
  ): Promise<void> {
    const result = await this.syncEngine.syncGroup(
      group,
      state,
    );

    if (result.failed.length > 0) {
      this.logger.warn(
        `Sync completed with ${result.failed.length} failure(s)`,
      );
    }
  }

  private discoverVirtualLights(): void {
    for (const group of this.groups) {
      const uuid = this.api.hap.uuid.generate(
        group.id,
      );

      const existingAccessory = this.cachedAccessories.find(
        (accessory) => accessory.UUID === uuid,
      );

      if (existingAccessory) {
        this.logger.info(
          `Restoring accessory: ${group.name}`,
        );

        new VirtualLight(
          this.api,
          existingAccessory,
          group,
          (state) => this.handleStateChange(
            group,
            state,
          ),
        );

        continue;
      }

      this.logger.info(
        `Adding accessory: ${group.name}`,
      );

      const accessory = new this.api.platformAccessory(
        group.name,
        uuid,
      );

      new VirtualLight(
        this.api,
        accessory,
        group,
        (state) => this.handleStateChange(
          group,
          state,
        ),
      );

      this.api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [accessory],
      );
    }
  }
}