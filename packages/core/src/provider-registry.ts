import type {
  LightDescriptor,
  LightProvider,
} from './light-provider.js';

export class ProviderRegistry {
  private readonly providers = new Map<string, LightProvider>();

  public register(provider: LightProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider already registered: ${provider.id}`);
    }

    this.providers.set(provider.id, provider);
  }

  public getProvider(providerId: string): LightProvider | undefined {
    return this.providers.get(providerId);
  }

  public getProviders(): LightProvider[] {
    return [...this.providers.values()];
  }

  public async getLights(): Promise<LightDescriptor[]> {
    const results = await Promise.all(
      this.getProviders().map((provider) => provider.getLights()),
    );

    return results.flat();
  }

}