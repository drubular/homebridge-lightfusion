import type {
  LightDescriptor,
  LightProvider,
} from '../light-provider.js';
import type { LightState } from '../light-state.js';

interface HueLightResponse {
  name: string;
  state: {
    on: boolean;
    bri?: number;
    hue?: number;
    sat?: number;
    ct?: number;
    reachable?: boolean;
  };
}

export interface HueProviderConfig {
  bridgeIp: string;
  applicationKey: string;
}

export class HueProvider implements LightProvider {
  public readonly id = 'hue';

  public constructor(
    private readonly config: HueProviderConfig,
  ) {}

  public async getLights(): Promise<LightDescriptor[]> {
    const lights = await this.fetchLights();

    return Object.entries(lights).map(([id, light]) => ({
      id,
      name: light.name,
      providerId: this.id,
    }));
  }

  public async getState(lightId: string): Promise<LightState> {
    const response = await fetch(
      this.buildUrl(`/lights/${lightId}`),
    );

    if (!response.ok) {
      throw new Error(
        `Hue request failed with status ${response.status}`,
      );
    }

    const light = await response.json() as HueLightResponse;

    return {
      on: light.state.on,
      brightness: this.hueBrightnessToPercent(light.state.bri),
      hue: this.hueHueToDegrees(light.state.hue),
      saturation: this.hueSaturationToPercent(light.state.sat),
      colorTemperature: light.state.ct ?? 370,
    };
  }

  public async setState(
    lightId: string,
    state: Partial<LightState>,
  ): Promise<void> {
    const payload: Record<string, boolean | number> = {};

    if (state.on !== undefined) {
      payload.on = state.on;
    }

    if (state.brightness !== undefined) {
      payload.bri = this.percentToHueBrightness(
        state.brightness,
      );
    }

    if (state.hue !== undefined) {
      payload.hue = this.degreesToHueHue(state.hue);
    }

    if (state.saturation !== undefined) {
      payload.sat = this.percentToHueSaturation(
        state.saturation,
      );
    }

    if (state.colorTemperature !== undefined) {
      payload.ct = state.colorTemperature;
    }

    const response = await fetch(
      this.buildUrl(`/lights/${lightId}/state`),
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Hue request failed with status ${response.status}`,
      );
    }
  }

  public async isAvailable(lightId: string): Promise<boolean> {
    const response = await fetch(
      this.buildUrl(`/lights/${lightId}`),
    );

    if (!response.ok) {
      return false;
    }

    const light = await response.json() as HueLightResponse;

    return light.state.reachable ?? true;
  }

  private async fetchLights(): Promise<Record<string, HueLightResponse>> {
    const response = await fetch(
      this.buildUrl('/lights'),
    );

    if (!response.ok) {
      throw new Error(
        `Hue request failed with status ${response.status}`,
      );
    }

    return await response.json() as Record<string, HueLightResponse>;
  }

  private buildUrl(path: string): string {
    return `http://${this.config.bridgeIp}/api/${this.config.applicationKey}${path}`;
  }

  private hueBrightnessToPercent(value = 0): number {
    return Math.round((value / 254) * 100);
  }

  private percentToHueBrightness(value: number): number {
    return Math.round((value / 100) * 254);
  }

  private hueHueToDegrees(value = 0): number {
    return (value / 65535) * 360;
  }

  private degreesToHueHue(value: number): number {
    return Math.round((value / 360) * 65535);
  }

  private hueSaturationToPercent(value = 0): number {
    return Math.round((value / 254) * 100);
  }

  private percentToHueSaturation(value: number): number {
    return Math.round((value / 100) * 254);
  }
}