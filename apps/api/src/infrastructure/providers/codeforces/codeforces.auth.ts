import type { IAuthProvider } from '../base/auth.interface';
import { ProviderAuthError, type ExternalIdentity, type OAuthTokens } from '../base/provider.types';
import { CodeforcesClient } from './codeforces.client';
import { mapCodeforcesUserToIdentity } from './codeforces.mapper';

export class CodeforcesAuthAdapter implements IAuthProvider {
  constructor(private readonly client: CodeforcesClient = new CodeforcesClient()) {}

  async connectWithIdentifier(identifier: string): Promise<ExternalIdentity> {
    const handle = identifier.trim();

    if (!handle || handle.length < 3 || handle.length > 24) {
      throw new ProviderAuthError('Codeforces handle must be between 3 and 24 characters.');
    }

    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(handle)) {
      throw new ProviderAuthError(
        'Codeforces handle contains invalid characters. Only letters, numbers, underscores, periods, and dashes are allowed.'
      );
    }

    const user = await this.client.fetchUserInfo(handle);
    if (!user) {
      throw new ProviderAuthError(`Codeforces user "${handle}" was not found.`);
    }

    return mapCodeforcesUserToIdentity(user);
  }

  createAuthorizationUrl(): string {
    throw new Error('OAuth 2.0 is not supported by Codeforces. Connect via public handle.');
  }

  async exchangeCodeForTokens(): Promise<OAuthTokens> {
    throw new Error('OAuth 2.0 is not supported by Codeforces. Connect via public handle.');
  }

  async fetchIdentity(): Promise<ExternalIdentity> {
    throw new Error('OAuth fetchIdentity is not supported by Codeforces. Connect via public handle.');
  }
}
