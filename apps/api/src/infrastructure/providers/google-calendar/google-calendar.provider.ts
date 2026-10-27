import type { IntegrationProvider, ProviderCapability } from '@avenza/shared';
import type { IAuthProvider } from '../base/auth.interface';
import type { IProvider } from '../base/provider.interface';
import type { ISyncProvider } from '../base/sync.interface';
import { GoogleCalendarAuthProvider } from './google-calendar.auth';
import { GoogleCalendarClient } from './google-calendar.client';
import { GoogleCalendarSyncProvider } from './google-calendar.sync';

export class GoogleCalendarProvider implements IProvider {
  private readonly capabilities: ReadonlySet<ProviderCapability> = new Set<ProviderCapability>([
    'oauth',
    'calendar',
    'read_only',
  ]);

  private readonly authAdapter: IAuthProvider;
  private readonly syncAdapter: ISyncProvider;

  constructor(client: GoogleCalendarClient = new GoogleCalendarClient()) {
    this.authAdapter = new GoogleCalendarAuthProvider({}, client);
    this.syncAdapter = new GoogleCalendarSyncProvider(client);
  }

  getProviderId(): IntegrationProvider {
    return 'google_calendar';
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
