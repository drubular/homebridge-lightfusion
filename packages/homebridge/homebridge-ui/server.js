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

    this.ready();
  }

  async handleDiscover() {
    try {
      const rawConfig = await fs.readFile(
        this.homebridgeConfigPath,
        'utf8',
      );

      const config = JSON.parse(rawConfig);

      const platform = config.platforms?.find(
        (entry) =>
          entry.platform === 'LightFusion',
      );

      const lights = [];

      if (
        platform?.hueBridgeIp &&
        platform?.hueApplicationKey
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

      const configuredGoveeNames = new Map();

      for (const group of platform?.groups ?? []) {
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
}

(() => {
  return new LightFusionUiServer();
})();