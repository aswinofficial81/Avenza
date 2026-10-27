import type { IntegrationProvider, ProviderCapability } from '@avenza/shared';
import type { IAuthProvider } from '../base/auth.interface';
import type { IProvider } from '../base/provider.interface';
import type { ISyncProvider } from '../base/sync.interface';
import { GitHubAuthProvider, type GitHubAuthConfig } from './github.auth';
import { GitHubClient } from './github.client';
import { GitHubSyncProvider } from './github.sync';

export class GitHubProvider implements IProvider {
  private readonly capabilities: ReadonlySet<ProviderCapability> = new Set<ProviderCapability>([
    'oauth',
    'repositories',
    'profile',
    'languages',
    'activity',
    'read_only',
  ]);

  private readonly authAdapter: IAuthProvider;
  private readonly syncAdapter: ISyncProvider;

  constructor(config: GitHubAuthConfig = {}, client: GitHubClient = new GitHubClient()) {
    this.authAdapter = new GitHubAuthProvider(config, client);
    this.syncAdapter = new GitHubSyncProvider(client);
  }

  getProviderId(): IntegrationProvider {
    return 'github';
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
