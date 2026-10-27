import type { IntegrationProvider } from '@avenza/shared';
import type { IProvider } from './provider.interface';
import { GitHubProvider } from '../github/github.provider';
import { LeetCodeProvider } from '../leetcode/leetcode.provider';
import { CodeforcesProvider } from '../codeforces/codeforces.provider';
import { GoogleCalendarProvider } from '../google-calendar/google-calendar.provider';

export class ProviderRegistry {
  private readonly providers = new Map<IntegrationProvider, IProvider>();

  constructor() {
    // Automatically register all supported providers
    this.register(new GitHubProvider());
    this.register(new LeetCodeProvider());
    this.register(new CodeforcesProvider());
    this.register(new GoogleCalendarProvider());
  }

  register(provider: IProvider): this {
    this.providers.set(provider.getProviderId(), provider);
    return this;
  }

  get(providerId: IntegrationProvider): IProvider | undefined {
    return this.providers.get(providerId);
  }

  getOrThrow(providerId: IntegrationProvider): IProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider "${providerId}" is not registered or supported in this phase.`);
    }
    return provider;
  }

  has(providerId: IntegrationProvider): boolean {
    return this.providers.has(providerId);
  }

  list(): IProvider[] {
    return Array.from(this.providers.values());
  }
}

export const defaultProviderRegistry = new ProviderRegistry();
