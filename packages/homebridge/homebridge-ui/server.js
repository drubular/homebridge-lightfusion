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
      let configChanged = false;

      /*
       * Hue bridge discovery
       *
       * hueBridgeId becomes the stable identity.
       * hueBridgeIp can then change without breaking
       * the user's configuration.
       */
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
          hueBridge = discoveredBridges[0];

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
        /*
         * Hue discovery failure should not prevent
         * LightFusion from trying the currently
         * configured bridge address.
         */
      }

      if (
        platform.hueBridgeIp &&
        platform.hueApplicationKey
      ) {
        const hueProvider = new HueProvider({
          bridgeIp:
            platform.hueBridgeIp,
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

      /*
       * Govee device IDs are stable.
       * Refresh stored IP addresses when DHCP
       * assigns a different address.
       */
      for (const device of goveeDevices) {
        for (
          const group of platform.groups ?? []
        ) {
          if (
            group.govee?.id === device.id &&
            group.govee.ip !== device.ip
          ) {
            group.govee.ip = device.ip;
            configChanged = true;
          }
        }
      }

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

      if (configChanged) {
        await this.writeConfig(config);
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