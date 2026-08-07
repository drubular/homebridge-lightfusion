import dgram from 'node:dgram';

import type {
  LightDescriptor,
  LightProvider,
} from '../light-provider.js';
import type { LightState } from '../light-state.js';

interface GoveeStatusData {
  onOff?: number;
  brightness?: number;
  color?: {
    r: number;
    g: number;
    b: number;
  };
  colorTemInKelvin?: number;
}

interface GoveeResponse {
  msg?: {
    cmd?: string;
    data?: GoveeStatusData;
  };
}

export interface GoveeProviderConfig {
  id: string;
  name: string;
  model: string;
  ip: string;
}

export class GoveeProvider implements LightProvider {
  public readonly id = 'govee';

  public constructor(
    private readonly config: GoveeProviderConfig,
  ) {}

  public async getLights(): Promise<LightDescriptor[]> {
    return [
      {
        id: this.config.id,
        name: this.config.name,
        providerId: this.id,
      },
    ];
  }

  public async getState(
    lightId: string,
  ): Promise<LightState> {
    this.assertLightId(lightId);

    const status = await this.requestStatus();

    return {
      on: status.onOff === 1,
      brightness: status.brightness ?? 100,
      hue: 0,
      saturation: 0,
      colorTemperature:
        this.kelvinToMired(status.colorTemInKelvin) ?? 370,
    };
  }

  public async setState(
    lightId: string,
    state: Partial<LightState>,
  ): Promise<void> {
    this.assertLightId(lightId);

    if (state.on !== undefined) {
      await this.sendCommand('turn', {
        value: state.on ? 1 : 0,
      });
    }

    if (state.brightness !== undefined) {
      await this.sendCommand('brightness', {
        value: Math.round(state.brightness),
      });
    }

    if (
      state.hue !== undefined ||
      state.saturation !== undefined
    ) {
      const rgb = this.hsvToRgb(
        state.hue ?? 0,
        state.saturation ?? 0,
      );

      await this.sendCommand('colorwc', {
        color: rgb,
        colorTemInKelvin: 0,
      });
    }

    if (state.colorTemperature !== undefined) {
      await this.sendCommand('colorwc', {
        color: {
          r: 0,
          g: 0,
          b: 0,
        },
        colorTemInKelvin:
          this.miredToKelvin(state.colorTemperature),
      });
    }
  }

  public async isAvailable(
    lightId: string,
  ): Promise<boolean> {
    this.assertLightId(lightId);

    try {
      await this.requestStatus();
      return true;
    } catch {
      return false;
    }
  }

  private async requestStatus(): Promise<GoveeStatusData> {
    const response = await this.sendRequest(
      'devStatus',
      {},
      true,
    );

    return response.msg?.data ?? {};
  }

  private async sendCommand(
    cmd: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.sendRequest(cmd, data, false);
  }

  private async sendRequest(
    cmd: string,
    data: Record<string, unknown>,
    waitForResponse: boolean,
  ): Promise<GoveeResponse> {
    return await new Promise((resolve, reject) => {
      const socket = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true,
      });

      const timeout = setTimeout(() => {
        socket.close();

        if (waitForResponse) {
          reject(
            new Error(
              `Govee request timed out: ${cmd}`,
            ),
          );
        } else {
          resolve({});
        }
      }, 1500);

      socket.on('error', (error) => {
        clearTimeout(timeout);
        socket.close();
        reject(error);
      });

      if (waitForResponse) {
        socket.on('message', (message) => {
          clearTimeout(timeout);
          socket.close();

          try {
            resolve(
              JSON.parse(
                message.toString(),
              ) as GoveeResponse,
            );
          } catch (error) {
            reject(error);
          }
        });
      }

      const send = (): void => {
        const payload = Buffer.from(
          JSON.stringify({
            msg: {
              cmd,
              data,
            },
          }),
        );

        socket.send(
          payload,
          4003,
          this.config.ip,
          (error) => {
            if (error) {
              clearTimeout(timeout);
              socket.close();
              reject(error);
              return;
            }

            if (!waitForResponse) {
              clearTimeout(timeout);
              socket.close();
              resolve({});
            }
          },
        );
      };

      if (waitForResponse) {
        socket.bind(4002, '0.0.0.0', send);
      } else {
        send();
      }
    });
  }

  private assertLightId(lightId: string): void {
    if (lightId !== this.config.id) {
      throw new Error(
        `Unknown Govee light: ${lightId}`,
      );
    }
  }

  private miredToKelvin(mired: number): number {
    return Math.round(1_000_000 / mired);
  }

  private kelvinToMired(
    kelvin?: number,
  ): number | undefined {
    if (!kelvin) {
      return undefined;
    }

    return Math.round(1_000_000 / kelvin);
  }

  private hsvToRgb(
    hue: number,
    saturation: number,
  ): { r: number; g: number; b: number } {
    const h = ((hue % 360) + 360) % 360;
    const s = saturation / 100;
    const value = 1;

    const chroma = value * s;
    const x =
      chroma *
      (1 - Math.abs(((h / 60) % 2) - 1));
    const match = value - chroma;

    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 60) {
      r = chroma;
      g = x;
    } else if (h < 120) {
      r = x;
      g = chroma;
    } else if (h < 180) {
      g = chroma;
      b = x;
    } else if (h < 240) {
      g = x;
      b = chroma;
    } else if (h < 300) {
      r = x;
      b = chroma;
    } else {
      r = chroma;
      b = x;
    }

    return {
      r: Math.round((r + match) * 255),
      g: Math.round((g + match) * 255),
      b: Math.round((b + match) * 255),
    };
  }
}