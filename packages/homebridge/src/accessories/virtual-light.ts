import type {
  LightGroup,
  LightState,
} from 'lightfusion-core';

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

  private pendingVisualState: Partial<LightState> = {};
  private visualUpdateTimer: NodeJS.Timeout | undefined;

  public constructor(
    private readonly api: API,
    private readonly accessory: PlatformAccessory,
    private readonly group: LightGroup,
    private readonly onStateChange: VirtualLightStateChangeHandler,
  ) {
    this.service =
      this.accessory.getService(
        this.api.hap.Service.Lightbulb,
      ) ??
      this.accessory.addService(
        this.api.hap.Service.Lightbulb,
      );

    this.configureAccessoryInformation();
    this.configureCharacteristics();
  }

  private configureAccessoryInformation(): void {
    this.accessory
      .getService(
        this.api.hap.Service.AccessoryInformation,
      )
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
    const characteristic =
      this.api.hap.Characteristic;

    this.service
      .getCharacteristic(
        characteristic.On,
      )
      .onGet(
        () => this.group.state.on,
      )
      .onSet(
        async (
          value: CharacteristicValue,
        ) => {
          await this.onStateChange({
            on: Boolean(value),
          });
        },
      );

    this.service
      .getCharacteristic(
        characteristic.Brightness,
      )
      .onGet(
        () =>
          this.group.state.brightness,
      )
      .onSet(
        async (
          value: CharacteristicValue,
        ) => {
          this.queueVisualUpdate({
            brightness: Number(value),
          });
        },
      );

    this.service
      .getCharacteristic(
        characteristic.Hue,
      )
      .onGet(
        () => this.group.state.hue,
      )
      .onSet(
        async (
          value: CharacteristicValue,
        ) => {
          this.queueVisualUpdate({
            hue: Number(value),
          });
        },
      );

    this.service
      .getCharacteristic(
        characteristic.Saturation,
      )
      .onGet(
        () =>
          this.group.state.saturation,
      )
      .onSet(
        async (
          value: CharacteristicValue,
        ) => {
          this.queueVisualUpdate({
            saturation: Number(value),
          });
        },
      );

    this.service
      .getCharacteristic(
        characteristic.ColorTemperature,
      )
      .onGet(
        () =>
          this.group.state
            .colorTemperature,
      )
      .onSet(
        async (
          value: CharacteristicValue,
        ) => {
          this.cancelPendingVisualUpdate();

          await this.onStateChange({
            colorTemperature:
              Number(value),
          });
        },
      );
  }

  private queueVisualUpdate(
    state: Partial<LightState>,
  ): void {
    this.pendingVisualState = {
      ...this.pendingVisualState,
      ...state,
    };

    if (this.visualUpdateTimer) {
      clearTimeout(
        this.visualUpdateTimer,
      );
    }

    this.visualUpdateTimer =
      setTimeout(() => {
        const stateToSend: Partial<LightState> = {};

        if (
          this.pendingVisualState
            .brightness !== undefined
        ) {
          stateToSend.brightness =
            this.pendingVisualState
              .brightness;
        }

        if (
          this.pendingVisualState.hue !==
          undefined ||
          this.pendingVisualState
            .saturation !== undefined
        ) {
          stateToSend.hue =
            this.pendingVisualState.hue ??
            this.group.state.hue;

          stateToSend.saturation =
            this.pendingVisualState
              .saturation ??
            this.group.state.saturation;
        }

        this.pendingVisualState = {};
        this.visualUpdateTimer =
          undefined;

        void this.onStateChange(
          stateToSend,
        );
      }, 150);
  }

  private cancelPendingVisualUpdate(): void {
    if (this.visualUpdateTimer) {
      clearTimeout(
        this.visualUpdateTimer,
      );

      this.visualUpdateTimer =
        undefined;
    }

    this.pendingVisualState = {};
  }
}
