import { randomUUID } from 'node:crypto';

import type {
  LightDescriptor,
  LightProvider,
} from '../light-provider.js';
import type { LightState } from '../light-state.js';

export interface GoveeDeviceConfig {
  id: string;
  name: string;
  model: string;
}

export interface GoveeProviderConfig {
  apiKey: string;
  devices: GoveeDeviceConfig[];
}

interface GoveeCapabilityState {
  type?: string;
  instance?: string;
  state?: {
    value?: unknown;
  };
}

interface GoveeApiResponse {
  code?: number;
  msg?: string;
}

interface GoveeStateResponse extends GoveeApiResponse {
  payload?: {
    capabilities?: GoveeCapabilityState[];
  };
}

export class GoveeProvider implements LightProvider {
  public readonly id = 'govee';

  private readonly devices = new Map<
    string,
    GoveeDeviceConfig
  >();

  public constructor(
    private readonly config: GoveeProviderConfig,
  ) {
    for (const device of config.devices) {
      this.devices.set(device.id, device);
    }
  }

  public async getLights(): Promise<LightDescriptor[]> {
    return [...this.devices.values()].map(
      (device) => ({
        id: device.id,
        name: device.name,
        providerId: this.id,
      }),
    );
  }

  public async getState(
    lightId: string,
  ): Promise<LightState> {
    const device = this.getDevice(lightId);

    const response =
      await this.requestDeviceState(device);

    const capabilities =
      response.payload?.capabilities ?? [];

    const valueFor = (
      instance: string,
    ): unknown =>
      capabilities.find(
        (capability) =>
          capability.instance === instance,
      )?.state?.value;

    const power =
      valueFor('powerSwitch');

    const brightness =
      valueFor('brightness');

    const rgb =
      valueFor('colorRgb');

    const kelvin =
      valueFor('colorTemperatureK');

    const color =
      typeof rgb === 'number'
        ? this.rgbIntegerToHsv(rgb)
        : undefined;

    return {
      on:
        power === 1 ||
        power === 'on' ||
        power === true,
      brightness:
        typeof brightness === 'number'
          ? brightness
          : 100,
      hue:
        color?.hue ?? 0,
      saturation:
        color?.saturation ?? 0,
      colorTemperature:
        typeof kelvin === 'number'
          ? this.kelvinToMired(kelvin)
          : 370,
    };
  }

  public async setState(
    lightId: string,
    state: Partial<LightState>,
  ): Promise<void> {
    const device = this.getDevice(lightId);

    if (state.on === true) {
      await this.sendCapability(
        device,
        'devices.capabilities.on_off',
        'powerSwitch',
        1,
      );
    }

    if (state.brightness !== undefined) {
      await this.sendCapability(
        device,
        'devices.capabilities.range',
        'brightness',
        Math.round(state.brightness),
      );
    }

    if (
      state.colorTemperature === undefined &&
      (
        state.hue !== undefined ||
        state.saturation !== undefined
      )
    ) {
      const rgb =
        this.hsvToRgbInteger(
          state.hue ?? 0,
          state.saturation ?? 0,
        );

      await this.sendCapability(
        device,
        'devices.capabilities.color_setting',
        'colorRgb',
        rgb,
      );
    }

    if (
      state.colorTemperature !== undefined
    ) {
      await this.sendCapability(
        device,
        'devices.capabilities.color_setting',
        'colorTemperatureK',
        this.miredToKelvin(
          state.colorTemperature,
        ),
      );
    }

    if (state.on === false) {
      await this.sendCapability(
        device,
        'devices.capabilities.on_off',
        'powerSwitch',
        0,
      );
    }
  }

  public async isAvailable(
    lightId: string,
  ): Promise<boolean> {
    const device = this.getDevice(lightId);

    try {
      const response =
        await this.requestDeviceState(device);

      const online =
        response.payload?.capabilities?.find(
          (capability) =>
            capability.type ===
              'devices.capabilities.online',
        )?.state?.value;

      return online !== false;
    } catch {
      return false;
    }
  }

  private async requestDeviceState(
    device: GoveeDeviceConfig,
  ): Promise<GoveeStateResponse> {
    const response = await fetch(
      'https://openapi.api.govee.com/router/api/v1/device/state',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          'Govee-API-Key':
            this.config.apiKey,
        },
        body: JSON.stringify({
          requestId: randomUUID(),
          payload: {
            sku: device.model,
            device: device.id,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Govee state request failed with HTTP ${response.status}`,
      );
    }

    const result =
      await response.json() as GoveeStateResponse;

    if (
      result.code !== undefined &&
      result.code !== 200
    ) {
      throw new Error(
        `Govee state request failed: ${result.msg ?? `code ${result.code}`}`,
      );
    }

    return result;
  }

  private async sendCapability(
    device: GoveeDeviceConfig,
    type: string,
    instance: string,
    value: unknown,
  ): Promise<void> {
    const response = await fetch(
      'https://openapi.api.govee.com/router/api/v1/device/control',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          'Govee-API-Key':
            this.config.apiKey,
        },
        body: JSON.stringify({
          requestId: randomUUID(),
          payload: {
            sku: device.model,
            device: device.id,
            capability: {
              type,
              instance,
              value,
            },
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Govee control request failed with HTTP ${response.status}`,
      );
    }

    const result =
      await response.json() as GoveeApiResponse;

    if (
      result.code !== undefined &&
      result.code !== 200
    ) {
      throw new Error(
        `Govee control request failed: ${result.msg ?? `code ${result.code}`}`,
      );
    }
  }

  private getDevice(
    lightId: string,
  ): GoveeDeviceConfig {
    const device = this.devices.get(
      lightId,
    );

    if (!device) {
      throw new Error(
        `Unknown Govee light: ${lightId}`,
      );
    }

    return device;
  }

  private miredToKelvin(
    mired: number,
  ): number {
    return Math.round(
      1_000_000 / mired,
    );
  }

  private kelvinToMired(
    kelvin: number,
  ): number {
    return Math.round(
      1_000_000 / kelvin,
    );
  }

  private hsvToRgbInteger(
    hue: number,
    saturation: number,
  ): number {
    const normalizedHue =
      ((hue % 360) + 360) % 360;

    const normalizedSaturation =
      Math.max(
        0,
        Math.min(100, saturation),
      ) / 100;

    const chroma =
      normalizedSaturation;

    const hueSection =
      normalizedHue / 60;

    const x =
      chroma *
      (
        1 -
        Math.abs(
          (hueSection % 2) - 1,
        )
      );

    let red = 0;
    let green = 0;
    let blue = 0;

    if (hueSection < 1) {
      red = chroma;
      green = x;
    } else if (hueSection < 2) {
      red = x;
      green = chroma;
    } else if (hueSection < 3) {
      green = chroma;
      blue = x;
    } else if (hueSection < 4) {
      green = x;
      blue = chroma;
    } else if (hueSection < 5) {
      red = x;
      blue = chroma;
    } else {
      red = chroma;
      blue = x;
    }

    const match = 1 - chroma;

    const r = Math.round(
      (red + match) * 255,
    );

    const g = Math.round(
      (green + match) * 255,
    );

    const b = Math.round(
      (blue + match) * 255,
    );

    return (
      (r << 16) |
      (g << 8) |
      b
    );
  }

  private rgbIntegerToHsv(
    rgb: number,
  ): {
    hue: number;
    saturation: number;
  } {
    const r =
      ((rgb >> 16) & 0xff) / 255;

    const g =
      ((rgb >> 8) & 0xff) / 255;

    const b =
      (rgb & 0xff) / 255;

    const max =
      Math.max(r, g, b);

    const min =
      Math.min(r, g, b);

    const delta =
      max - min;

    let hue = 0;

    if (delta !== 0) {
      if (max === r) {
        hue =
          60 *
          (((g - b) / delta) % 6);
      } else if (max === g) {
        hue =
          60 *
          ((b - r) / delta + 2);
      } else {
        hue =
          60 *
          ((r - g) / delta + 4);
      }
    }

    if (hue < 0) {
      hue += 360;
    }

    const saturation =
      max === 0
        ? 0
        : (delta / max) * 100;

    return {
      hue,
      saturation,
    };
  }
}
