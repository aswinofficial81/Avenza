import type { IntegrationProvider, ProviderCapability } from '@avenza/shared';
import type { IAuthProvider } from '../base/auth.interface';
import type { IProvider } from '../base/provider.interface';
import type { ISyncProvider } from '../base/sync.interface';
import { LeetCodeAuthAdapter } from './leetcode.auth';
import { LeetCodeClient } from './leetcode.client';
import { LeetCodeSyncProvider } from './leetcode.sync';

export class LeetCodeProvider implements IProvider {
  private readonly capabilities: ReadonlySet<ProviderCapability> = new Set<ProviderCapability>([
    'profile',
    'activity',
    'read_only',
  ]);

  private readonly authAdapter: IAuthProvider;
  private readonly syncAdapter: ISyncProvider;

  constructor(client: LeetCodeClient = new LeetCodeClient()) {
    this.authAdapter = new LeetCodeAuthAdapter(client);
    this.syncAdapter = new LeetCodeSyncProvider(client);
  }

  getProviderId(): IntegrationProvider {
    return 'leetcode';
  }

  getCapabilities(): ReadonlySet<ProviderCapability> {
    return this.capabilities;
  }

  hasCapability(capability: ProviderCapability): boolean {
    return this.capabilities.has(capability);
  }

  getAuthAdapter(): IAuthProvider {
    return this.authAdapter;
  }

  getSyncAdapter(): ISyncProvider {
    return this.syncAdapter;
  }
}
