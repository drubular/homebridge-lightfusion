import fs from 'node:fs/promises';

import {
  HomebridgePluginUiServer,
  RequestError,
} from '@homebridge/plugin-ui-utils';

import {
  HueProvider,
  discoverGoveeDevices,
  discoverHueBridges,
} from 'lightfusion-core';

class LightFusionUiServer extends HomebridgePluginUiServer {
  constructor() {
    super();

    this.onRequest(
      '/discover',
      this.handleDiscover.bind(this),
    );

    this.onRequest(
      '/hue/connect',
      this.handleHueConnect.bind(this),
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

  async handleHueConnect() {
    try {
      const bridges =
        await discoverHueBridges();

      if (bridges.length === 0) {
        throw new Error(
          'No Philips Hue Bridge was found on the network.',
        );
      }

      const config =
        await this.readConfig();

      const platform =
        this.getLightFusionPlatform(config);

      let bridge;

      if (platform?.hueBridgeId) {
        bridge = bridges.find(
          (candidate) =>
            candidate.id.toLowerCase() ===
            platform.hueBridgeId.toLowerCase(),
        );
      }

      if (
        !bridge &&
        platform?.hueBridgeIp
      ) {
        bridge = bridges.find(
          (candidate) =>
            candidate.ip ===
            platform.hueBridgeIp,
        );
      }

      if (
        !bridge &&
        bridges.length === 1
      ) {
        bridge = bridges[0];
      }

      if (!bridge) {
        throw new Error(
          'Multiple Hue Bridges were found. Bridge selection is required.',
        );
      }

      const response = await fetch(
        `http://${bridge.ip}/api`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            devicetype:
              'homebridge-lightfusion#homebridge',
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Hue authorization request failed with status ${response.status}`,
        );
      }

      const result =
        await response.json();

      if (!Array.isArray(result)) {
        throw new Error(
          'Hue Bridge returned an unexpected authorization response.',
        );
      }

      const success =
        result.find(
          (entry) =>
            entry?.success?.username,
        );

      if (success) {
        return {
          connected: true,
          bridgeId: bridge.id,
          bridgeIp: bridge.ip,
          applicationKey:
            success.success.username,
        };
      }

      const hueError =
        result.find(
          (entry) =>
            entry?.error,
        )?.error;

      if (hueError?.type === 101) {
        return {
          connected: false,
          needsLinkButton: true,
          bridgeId: bridge.id,
          bridgeIp: bridge.ip,
          message:
            'Press the button on your Hue Bridge, then try Connect again.',
        };
      }

      throw new Error(
        hueError?.description ??
          'Hue Bridge authorization failed.',
      );
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
      const config =
        await this.readConfig();

      const platform =
        this.getLightFusionPlatform(config);

      if (!platform) {
        throw new Error(
          'LightFusion platform configuration not found',
        );
      }

      const lights = [];
      let configChanged = false;

      try {
        const discoveredBridges =
          await discoverHueBridges();

        let hueBridge;

        if (platform.hueBridgeId) {
          hueBridge =
            discoveredBridges.find(
              (bridge) =>
                bridge.id.toLowerCase() ===
                platform.hueBridgeId.toLowerCase(),
            );
        } else if (
          discoveredBridges.length === 1
        ) {
          hueBridge =
            discoveredBridges[0];

          if (hueBridge) {
            platform.hueBridgeId =
              hueBridge.id;

            configChanged = true;
          }
        } else if (
          platform.hueBridgeIp
        ) {
          hueBridge =
            discoveredBridges.find(
              (bridge) =>
                bridge.ip ===
                platform.hueBridgeIp,
            );

          if (hueBridge) {
            platform.hueBridgeId =
              hueBridge.id;

            configChanged = true;
          }
        }

        if (
          hueBridge &&
          platform.hueBridgeIp !==
            hueBridge.ip
        ) {
          platform.hueBridgeIp =
            hueBridge.ip;

          configChanged = true;
        }
      } catch {
        // Hue discovery failure should not stop
        // LightFusion from using saved configuration.
      }

      if (
        platform.hueBridgeIp &&
        platform.hueApplicationKey
      ) {
        const hueProvider =
          new HueProvider({
            bridgeIp:
              platform.hueBridgeIp,
            applicationKey:
              platform.hueApplicationKey,
          });

        const hueLights =
          await hueProvider.getLights();

        lights.push(
          ...hueLights.map(
            (light) => ({
              ...light,
              model: 'Philips Hue',
            }),
          ),
        );
      }

      const configuredGoveeNames =
        new Map();

      for (
        const group of
        platform.groups ?? []
      ) {
        if (group.govee?.id) {
          configuredGoveeNames.set(
            group.govee.id,
            group.govee.name,
          );
        }
      }

      const goveeDevices =
        await discoverGoveeDevices(
          5000,
        );

      for (
        const device of
        goveeDevices
      ) {
        for (
          const group of
          platform.groups ?? []
        ) {
          if (
            group.govee?.id ===
              device.id &&
            group.govee.ip !==
              device.ip
          ) {
            group.govee.ip =
              device.ip;

            configChanged = true;
          }
        }
      }

      lights.push(
        ...goveeDevices.map(
          (device) => ({
            id: device.id,
            providerId: 'govee',
            name:
              configuredGoveeNames.get(
                device.id,
              ) ??
              `Govee ${device.model}`,
            model: device.model,
            ip: device.ip,
          }),
        ),
      );

      if (configChanged) {
        await this.writeConfig(
          config,
        );
      }

      return lights;
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
