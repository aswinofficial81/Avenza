import type { IntegrationProvider, ProviderCapability } from '@avenza/shared';
import type { IAuthProvider } from './auth.interface';
import type { ISyncProvider } from './sync.interface';

export interface IProvider {
  getProviderId(): IntegrationProvider;
  getCapabilities(): ReadonlySet<ProviderCapability>;
  hasCapability(capability: ProviderCapability): boolean;
  getAuthAdapter(): IAuthProvider;
  getSyncAdapter(): ISyncProvider;
}
