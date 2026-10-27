import type { IAuthProvider } from '../base/auth.interface';
import { ProviderAuthError, type ExternalIdentity, type OAuthTokens } from '../base/provider.types';
import { LeetCodeClient } from './leetcode.client';
import { mapLeetCodeProfileToIdentity } from './leetcode.mapper';

export class LeetCodeAuthAdapter implements IAuthProvider {
  constructor(private readonly client: LeetCodeClient = new LeetCodeClient()) {}

  async connectWithIdentifier(identifier: string): Promise<ExternalIdentity> {
    const username = identifier.trim();

    if (!username || username.length < 1 || username.length > 100) {
      throw new ProviderAuthError('LeetCode username must be between 1 and 100 characters.');
    }

    // LeetCode usernames consist of letters, numbers, underscores, and hyphens
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new ProviderAuthError(
        'LeetCode username contains invalid characters. Only letters, numbers, underscores, and hyphens are allowed.'
      );
    }

    const profile = await this.client.fetchUserProfile(username);
    if (!profile) {
      throw new ProviderAuthError(`LeetCode user "${username}" was not found or profile is inaccessible.`);
    }

    return mapLeetCodeProfileToIdentity(profile);
  }

  createAuthorizationUrl(): string {
    throw new Error('OAuth 2.0 is not supported by LeetCode. Connect via public username.');
  }

  async exchangeCodeForTokens(): Promise<OAuthTokens> {
    throw new Error('OAuth 2.0 is not supported by LeetCode. Connect via public username.');
  }

  async fetchIdentity(): Promise<ExternalIdentity> {
    throw new Error('OAuth fetchIdentity is not supported by LeetCode. Connect via public username.');
  }
}
