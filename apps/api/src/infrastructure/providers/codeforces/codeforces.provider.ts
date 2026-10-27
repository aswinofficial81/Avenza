import type { IntegrationProvider, ProviderCapability } from '@avenza/shared';
import type { IAuthProvider } from '../base/auth.interface';
import type { IProvider } from '../base/provider.interface';
import type { ISyncProvider } from '../base/sync.interface';
import { CodeforcesAuthAdapter } from './codeforces.auth';
import { CodeforcesClient } from './codeforces.client';
import { CodeforcesSyncProvider } from './codeforces.sync';

export class CodeforcesProvider implements IProvider {
  private readonly capabilities: ReadonlySet<ProviderCapability> = new Set<ProviderCapability>([
    'profile',
    'activity',
    'read_only',
  ]);

  private readonly authAdapter: IAuthProvider;
  private readonly syncAdapter: ISyncProvider;

  constructor(client: CodeforcesClient = new CodeforcesClient()) {
    this.authAdapter = new CodeforcesAuthAdapter(client);
    this.syncAdapter = new CodeforcesSyncProvider(client);
  }

  getProviderId(): IntegrationProvider {
    return 'codeforces';
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
