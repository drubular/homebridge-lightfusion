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
} from 'lightfusion-core';


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

interface LightFusionBrightnessMapPoint {
  input: number;
  output: number;
}

interface LightFusionDeviceCalibrationConfig {
  profile?: string;
  hueOffset?: number;
  saturationScale?: number;
  brightnessScale?: number;
  brightnessMap?: LightFusionBrightnessMapPoint[];
  colorTemperatureOffset?: number;
}

interface LightFusionMemberConfig {
  providerId: string;
  lightId: string;
  name?: string;
  model?: string;
  ip?: string;
  calibration?: LightFusionDeviceCalibrationConfig;
}

interface LightFusionReferenceConfig {
  providerId: string;
  lightId: string;
}

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

  /*
   * New generic device configuration.
   */
  referenceDevice?: LightFusionReferenceConfig;
  members?: LightFusionMemberConfig[];

  /*
   * Legacy group configuration.
   * Preserved for backward compatibility while
   * existing installations migrate.
   */
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
    (light: LightReference) =>
      this.getCalibrationProfile(light),
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
      void this.discoverAvailableLights();
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

    const configuredGoveeLights:
      LightFusionGoveeConfig[] =
      this.config.groups && this.config.groups.length > 0
        ? this.config.groups.flatMap(
          (group): LightFusionGoveeConfig[] => {
            if (
              Array.isArray(group.members) &&
              group.members.length > 0
            ) {
              return group.members
                .filter(
                  (member) =>
                    member.providerId === 'govee' &&
                    member.ip !== undefined,
                )
                .map(
                  (member): LightFusionGoveeConfig => ({
                    id: member.lightId,
                    ...(member.name
                      ? { name: member.name }
                      : {}),
                    ...(member.model
                      ? { model: member.model }
                      : {}),
                    ip: member.ip as string,
                  }),
                );
            }

            return group.govee
              ? [group.govee]
              : [];
          },
        )
        : this.config.goveeIp &&
          this.config.goveeLightId
          ? [
            {
              id: this.config.goveeLightId,
              ...(this.config.goveeName
                ? { name: this.config.goveeName }
                : {}),
              ...(this.config.goveeModel
                ? { model: this.config.goveeModel }
                : {}),
              ip: this.config.goveeIp,
            },
          ]
          : [];

    for (const govee of configuredGoveeLights) {
      this.registry.register(
        new GoveeProvider({
          devices: [
            {
              id: govee.id,
              name: govee.name ?? 'Govee Light',
              model: govee.model ?? 'unknown',
              ip: govee.ip,
            },
          ],
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

  private getCalibrationProfile(
    light: LightReference,
  ) {
    const member =
      this.getMemberConfig(light);

    if (member?.calibration) {
      const calibration =
        member.calibration;

      const profile =
        calibration.profile ===
          'govee-h60a1-vs-hue'
          ? GOVEE_H60A1_VS_HUE_PROFILE
          : undefined;

      return {
        ...(profile ?? {}),

        ...(calibration.hueOffset !== undefined
          ? { hueOffset: calibration.hueOffset }
          : {}),

        ...(calibration.saturationScale !== undefined
          ? {
            saturationScale:
              calibration.saturationScale,
          }
          : {}),

        ...(calibration.brightnessScale !== undefined
          ? {
            brightnessScale:
              calibration.brightnessScale,
          }
          : {}),

        ...(calibration.brightnessMap !== undefined
          ? {
            brightnessMap:
              calibration.brightnessMap,
          }
          : {}),

        ...(calibration.colorTemperatureOffset !== undefined
          ? {
            colorTemperatureOffset:
              calibration.colorTemperatureOffset,
          }
          : {}),
      };
    }

    /*
     * Legacy Govee calibration fallback.
     */
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
  }

  private getMemberConfig(
    light: LightReference,
  ): LightFusionMemberConfig | undefined {
    for (const group of this.config.groups ?? []) {
      const member =
        group.members?.find(
          (candidate) =>
            candidate.providerId === light.providerId &&
            candidate.lightId === light.lightId,
        );

      if (member) {
        return member;
      }
    }

    return undefined;
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
  ): LightReference[] {
    if (
      Array.isArray(groupConfig.members) &&
      groupConfig.members.length > 0
    ) {
      return groupConfig.members.map(
        (member) => ({
          providerId: member.providerId,
          lightId: member.lightId,
        }),
      );
    }

    const members: LightReference[] = [];

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
    const configuredUuids = new Set(
      this.groups.map((group) =>
        this.api.hap.uuid.generate(group.id),
      ),
    );

    const staleAccessories = this.cachedAccessories.filter(
      (accessory) =>
        !configuredUuids.has(accessory.UUID),
    );

    if (staleAccessories.length > 0) {
      this.logger.info(
        `Removing ${staleAccessories.length} stale LightFusion accessory(s)`,
      );

      this.api.unregisterPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        staleAccessories,
      );
    }

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
  private async discoverAvailableLights(): Promise<void> {
    try {
      const lights = await this.registry.getLights();

      for (const light of lights) {
        this.logger.info(
          `Discovered light: ${light.providerId}:${light.id} (${light.name})`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Light discovery failed: ${error instanceof Error
          ? error.message
          : String(error)
        }`,
      );
    }
  }
}