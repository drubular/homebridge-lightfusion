import type {
  LightGroup,
  LightState,
} from '@lightfusion/core';

import type {
  API,
  CharacteristicValue,
  PlatformAccessory,
  Service,
} from 'homebridge';

export type VirtualLightStateChangeHandler = (
  state: Partial<LightState>,
) => Promise<void>;

export class VirtualLight {
  private readonly service: Service;

  private pendingColorState: Partial<LightState> = {};
private colorUpdateTimer: NodeJS.Timeout | undefined;

  public constructor(
    private readonly api: API,
    private readonly accessory: PlatformAccessory,
    private readonly group: LightGroup,
    private readonly onStateChange: VirtualLightStateChangeHandler,
  ) {
    this.service =
      this.accessory.getService(this.api.hap.Service.Lightbulb) ??
      this.accessory.addService(this.api.hap.Service.Lightbulb);

    this.configureAccessoryInformation();
    this.configureCharacteristics();
  }

  private configureAccessoryInformation(): void {
    this.accessory
      .getService(this.api.hap.Service.AccessoryInformation)
      ?.setCharacteristic(
        this.api.hap.Characteristic.Manufacturer,
        'LightFusion',
      )
      .setCharacteristic(
        this.api.hap.Characteristic.Model,
        'Virtual Color Light',
      )
      .setCharacteristic(
        this.api.hap.Characteristic.SerialNumber,
        this.accessory.UUID,
      );
  }

  private configureCharacteristics(): void {
    const characteristic = this.api.hap.Characteristic;

    this.service
      .getCharacteristic(characteristic.On)
      .onGet(() => this.group.state.on)
      .onSet(async (value: CharacteristicValue) => {
        await this.onStateChange({
          on: Boolean(value),
        });
      });

    this.service
      .getCharacteristic(characteristic.Brightness)
      .onGet(() => this.group.state.brightness)
      .onSet(async (value: CharacteristicValue) => {
        await this.onStateChange({
          brightness: Number(value),
        });
      });

    this.service
      .getCharacteristic(characteristic.Hue)
      .onGet(() => this.group.state.hue)
      .onSet(async (value: CharacteristicValue) => {
        this.queueColorUpdate({
          hue: Number(value),
        });
      });

    this.service
      .getCharacteristic(characteristic.Saturation)
      .onGet(() => this.group.state.saturation)
      .onSet(async (value: CharacteristicValue) => {
        this.queueColorUpdate({
          saturation: Number(value),
        });
      });

    this.service
      .getCharacteristic(characteristic.ColorTemperature)
      .onGet(() => this.group.state.colorTemperature)
      .onSet(async (value: CharacteristicValue) => {
        this.cancelPendingColorUpdate();

        await this.onStateChange({
          colorTemperature: Number(value),
        });
      });
  }

  private queueColorUpdate(
    state: Partial<LightState>,
  ): void {
    this.pendingColorState = {
      ...this.pendingColorState,
      ...state,
    };

    if (this.colorUpdateTimer) {
      clearTimeout(this.colorUpdateTimer);
    }

    this.colorUpdateTimer = setTimeout(() => {
      const stateToSend = {
        hue:
          this.pendingColorState.hue ??
          this.group.state.hue,
        saturation:
          this.pendingColorState.saturation ??
          this.group.state.saturation,
      };

      this.pendingColorState = {};
      this.colorUpdateTimer = undefined;

      void this.onStateChange(stateToSend);
    }, 100);
  }

  private cancelPendingColorUpdate(): void {
    if (this.colorUpdateTimer) {
      clearTimeout(this.colorUpdateTimer);
      this.colorUpdateTimer = undefined;
    }

    this.pendingColorState = {};
  }
}