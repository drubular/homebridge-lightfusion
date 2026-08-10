import fs from 'node:fs/promises';

import {
  HomebridgePluginUiServer,
  RequestError,
} from '@homebridge/plugin-ui-utils';

import {
  HueProvider,
  discoverGoveeDevices,
} from '@lightfusion/core';

class LightFusionUiServer extends HomebridgePluginUiServer {
  constructor() {
    super();

    this.onRequest(
      '/discover',
      this.handleDiscover.bind(this),
    );

    this.onRequest(
      '/groups',
      this.handleGroups.bind(this),
    );

    this.onRequest(
      '/save-group',
      this.handleSaveGroup.bind(this),
    );

    this.onRequest(
      '/delete-group',
      this.handleDeleteGroup.bind(this),
    );

    this.ready();
  }

  async readConfig() {
    const rawConfig = await fs.readFile(
      this.homebridgeConfigPath,
      'utf8',
    );

    return JSON.parse(rawConfig);
  }

  async writeConfig(config) {
    await fs.writeFile(
      this.homebridgeConfigPath,
      `${JSON.stringify(config, null, 2)}\n`,
      'utf8',
    );
  }

  getLightFusionPlatform(config) {
    return config.platforms?.find(
      (entry) =>
        entry.platform === 'LightFusion',
    );
  }

  async handleGroups() {
    try {
      const config = await this.readConfig();

      const platform =
        this.getLightFusionPlatform(config);

      return platform?.groups ?? [];
    } catch (error) {
      throw new RequestError(
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  async handleDiscover() {
    try {
      const config = await this.readConfig();

      const platform =
        this.getLightFusionPlatform(config);

      if (!platform) {
        throw new Error(
          'LightFusion platform configuration not found',
        );
      }

      const lights = [];

      if (
        platform.hueBridgeIp &&
        platform.hueApplicationKey
      ) {
        const hueProvider = new HueProvider({
          bridgeIp: platform.hueBridgeIp,
          applicationKey:
            platform.hueApplicationKey,
        });

        const hueLights =
          await hueProvider.getLights();

        lights.push(
          ...hueLights.map((light) => ({
            ...light,
            model: 'Philips Hue',
          })),
        );
      }

      const configuredGoveeNames =
        new Map();

      for (
        const group of platform.groups ?? []
      ) {
        if (group.govee?.id) {
          configuredGoveeNames.set(
            group.govee.id,
            group.govee.name,
          );
        }
      }

      const goveeDevices =
        await discoverGoveeDevices(5000);

      lights.push(
        ...goveeDevices.map((device) => ({
          id: device.id,
          providerId: 'govee',
          name:
            configuredGoveeNames.get(
              device.id,
            ) ??
            `Govee ${device.model}`,
          model: device.model,
          ip: device.ip,
        })),
      );

      return lights;
    } catch (error) {
      throw new RequestError(
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  async handleSaveGroup(group) {
    try {
      const config = await this.readConfig();

      const platform =
        this.getLightFusionPlatform(config);

      if (!platform) {
        throw new Error(
          'LightFusion platform configuration not found',
        );
      }

      if (!group?.id) {
        throw new Error(
          'Group ID is required',
        );
      }

      if (!group?.name) {
        throw new Error(
          'Group name is required',
        );
      }

      if (
        !Array.isArray(group.hueLightIds)
      ) {
        group.hueLightIds = [];
      }

      const groups =
        Array.isArray(platform.groups)
          ? platform.groups
          : [];

      const existingIndex =
        groups.findIndex(
          (existing) =>
            existing.id === group.id,
        );

      if (existingIndex >= 0) {
        groups[existingIndex] = group;
      } else {
        groups.push(group);
      }

      platform.groups = groups;

      await this.writeConfig(config);

      return platform.groups;
    } catch (error) {
      throw new RequestError(
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  async handleDeleteGroup(payload) {
    try {
      const config = await this.readConfig();

      const platform =
        this.getLightFusionPlatform(config);

      if (!platform) {
        throw new Error(
          'LightFusion platform configuration not found',
        );
      }

      const groupId = payload?.id;

      if (!groupId) {
        throw new Error(
          'Group ID is required',
        );
      }

      platform.groups =
        (platform.groups ?? []).filter(
          (group) =>
            group.id !== groupId,
        );

      await this.writeConfig(config);

      return platform.groups;
    } catch (error) {
      throw new RequestError(
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }
}

(() => {
  return new LightFusionUiServer();
})();