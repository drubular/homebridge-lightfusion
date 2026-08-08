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
        await this.onStateChange({
          hue: Number(value),
        });
      });

    this.service
      .getCharacteristic(characteristic.Saturation)
      .onGet(() => this.group.state.saturation)
      .onSet(async (value: CharacteristicValue) => {
        await this.onStateChange({
          saturation: Number(value),
        });
      });

    this.service
      .getCharacteristic(characteristic.ColorTemperature)
      .onGet(() => this.group.state.colorTemperature)
      .onSet(async (value: CharacteristicValue) => {
        await this.onStateChange({
          colorTemperature: Number(value),
        });
      });
  }
}
