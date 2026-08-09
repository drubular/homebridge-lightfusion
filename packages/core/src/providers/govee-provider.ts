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

export interface GoveeDeviceConfig {
  id: string;
  name: string;
  model: string;
  ip: string;
}

export interface GoveeProviderConfig {
  devices: GoveeDeviceConfig[];
}

export class GoveeProvider implements LightProvider {
  public readonly id = 'govee';

  private readonly devices = new Map<
    string,
    GoveeDeviceConfig
  >();

  public constructor(
    config: GoveeProviderConfig,
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

    const status = await this.requestStatus(
      device,
    );

    return {
      on: status.onOff === 1,
      brightness:
        status.brightness ?? 100,
      hue: 0,
      saturation: 0,
      colorTemperature:
        this.kelvinToMired(
          status.colorTemInKelvin,
        ) ?? 370,
    };
  }

  public async setState(
    lightId: string,
    state: Partial<LightState>,
  ): Promise<void> {
    const device = this.getDevice(lightId);

    if (state.on === true) {
      await this.sendCommand(
        device,
        'turn',
        {
          value: 1,
        },
      );
    }

    if (state.brightness !== undefined) {
      await this.sendCommand(
        device,
        'brightness',
        {
          value: Math.round(
            state.brightness,
          ),
        },
      );
    }

    if (
      state.colorTemperature === undefined &&
      (
        state.hue !== undefined ||
        state.saturation !== undefined
      )
    ) {
      const rgb = this.hsvToRgb(
        state.hue ?? 0,
        state.saturation ?? 0,
      );

      await this.sendCommand(
        device,
        'colorwc',
        {
          color: rgb,
          colorTemInKelvin: 0,
        },
      );
    }

    if (
      state.colorTemperature !== undefined
    ) {
      await this.sendCommand(
        device,
        'colorwc',
        {
          color: {
            r: 0,
            g: 0,
            b: 0,
          },
          colorTemInKelvin:
            this.miredToKelvin(
              state.colorTemperature,
            ),
        },
      );
    }

    if (state.on === false) {
      await this.sendCommand(
        device,
        'turn',
        {
          value: 0,
        },
      );
    }
  }

  public async isAvailable(
    lightId: string,
  ): Promise<boolean> {
    const device = this.getDevice(lightId);

    try {
      await this.requestStatus(device);
      return true;
    } catch {
      return false;
    }
  }

  private async requestStatus(
    device: GoveeDeviceConfig,
  ): Promise<GoveeStatusData> {
    const response = await this.sendRequest(
      device,
      'devStatus',
      {},
      true,
    );

    return response.msg?.data ?? {};
  }

  private async sendCommand(
    device: GoveeDeviceConfig,
    cmd: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.sendRequest(
      device,
      cmd,
      data,
      false,
    );

    await this.wait(150);
  }

  private async sendRequest(
    device: GoveeDeviceConfig,
    cmd: string,
    data: Record<string, unknown>,
    waitForResponse: boolean,
  ): Promise<GoveeResponse> {
    return await new Promise(
      (resolve, reject) => {
        const socket = dgram.createSocket({
          type: 'udp4',
          reuseAddr: true,
        });

        const timeout = setTimeout(
          () => {
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
          },
          1500,
        );

        socket.on('error', (error) => {
          clearTimeout(timeout);
          socket.close();
          reject(error);
        });

        if (waitForResponse) {
          socket.on(
            'message',
            (message) => {
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
            },
          );
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
            device.ip,
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
          socket.bind(
            4002,
            '0.0.0.0',
            send,
          );
        } else {
          send();
        }
      },
    );
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

  private async wait(
    milliseconds: number,
  ): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  private miredToKelvin(
    mired: number,
  ): number {
    return Math.round(
      1_000_000 / mired,
    );
  }

  private kelvinToMired(
    kelvin?: number,
  ): number | undefined {
    if (!kelvin) {
      return undefined;
    }

    return Math.round(
      1_000_000 / kelvin,
    );
  }

  private hsvToRgb(
    hue: number,
    saturation: number,
  ): {
    r: number;
    g: number;
    b: number;
  } {
    const normalizedHue =
      ((hue % 360) + 360) % 360;

    const normalizedSaturation =
      Math.max(
        0,
        Math.min(100, saturation),
      ) / 100;

    const value = 1;

    const chroma =
      value * normalizedSaturation;

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

    const match = value - chroma;

    return {
      r: Math.round(
        (red + match) * 255,
      ),
      g: Math.round(
        (green + match) * 255,
      ),
      b: Math.round(
        (blue + match) * 255,
      ),
    };
  }
}