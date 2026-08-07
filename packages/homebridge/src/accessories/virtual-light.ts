import type {
  API,
  CharacteristicValue,
  PlatformAccessory,
  Service,
} from 'homebridge';

export interface VirtualLightState {
  on: boolean;
  brightness: number;
  hue: number;
  saturation: number;
  colorTemperature: number;
}

export class VirtualLight {
  private readonly service: Service;

  private readonly state: VirtualLightState = {
    on: false,
    brightness: 100,
    hue: 0,
    saturation: 0,
    colorTemperature: 370,
  };

  public constructor(
    private readonly api: API,
    private readonly accessory: PlatformAccessory,
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
      .onGet(() => this.state.on)
      .onSet((value: CharacteristicValue) => {
        this.state.on = Boolean(value);
      });

    this.service
      .getCharacteristic(characteristic.Brightness)
      .onGet(() => this.state.brightness)
      .onSet((value: CharacteristicValue) => {
        this.state.brightness = Number(value);
      });

    this.service
      .getCharacteristic(characteristic.Hue)
      .onGet(() => this.state.hue)
      .onSet((value: CharacteristicValue) => {
        this.state.hue = Number(value);
      });

    this.service
      .getCharacteristic(characteristic.Saturation)
      .onGet(() => this.state.saturation)
      .onSet((value: CharacteristicValue) => {
        this.state.saturation = Number(value);
      });

    this.service
      .getCharacteristic(characteristic.ColorTemperature)
      .onGet(() => this.state.colorTemperature)
      .onSet((value: CharacteristicValue) => {
        this.state.colorTemperature = Number(value);
      });
  }
}