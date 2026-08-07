import {
  updateLightGroupState,
  type LightGroup,
  type LightReference,
} from './light-group.js';
import type { LightState } from './light-state.js';
import type { ProviderRegistry } from './provider-registry.js';

export interface SyncFailure {
  light: LightReference;
  error: Error;
}

export interface SyncResult {
  successful: LightReference[];
  failed: SyncFailure[];
}

export class SyncEngine {
  public constructor(
    private readonly providers: ProviderRegistry,
  ) {}

  public async syncGroup(
    group: LightGroup,
    state: Partial<LightState>,
  ): Promise<SyncResult> {
    updateLightGroupState(group, state);
    const results = await Promise.all(
      group.members.map(async (light) => {
        const provider = this.providers.getProvider(light.providerId);

        if (!provider) {
          return {
            light,
            error: new Error(
              `Provider not registered: ${light.providerId}`,
            ),
          };
        }

        try {
          await provider.setState(light.lightId, state);

          return {
            light,
          };
        } catch (error) {
          return {
            light,
            error: this.toError(error),
          };
        }
      }),
    );

    const successful: LightReference[] = [];
    const failed: SyncFailure[] = [];

    for (const result of results) {
      if (result.error) {
        failed.push({
          light: result.light,
          error: result.error,
        });
      } else {
        successful.push(result.light);
      }
    }

    return {
      successful,
      failed,
    };
  }

  private toError(error: unknown): Error {
    return error instanceof Error
      ? error
      : new Error(String(error));
  }
}