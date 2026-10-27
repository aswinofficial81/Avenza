import type { IAuthProvider } from '../base/auth.interface';
import { ProviderAuthError, type ExternalIdentity, type OAuthTokens } from '../base/provider.types';
import { GitHubClient } from './github.client';
import type { GitHubOAuthTokenResponse } from './github.types';

export interface GitHubAuthConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  oauthBaseUrl?: string;
  scope?: string;
}

export class GitHubAuthProvider implements IAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri?: string;
  private readonly oauthBaseUrl: string;
  private readonly scope: string;

  constructor(
    config: GitHubAuthConfig = {},
    private readonly client: GitHubClient = new GitHubClient()
  ) {
    this.clientId = config.clientId || process.env.GITHUB_CLIENT_ID || '';
    this.clientSecret = config.clientSecret || process.env.GITHUB_CLIENT_SECRET || '';
    this.redirectUri = config.redirectUri || process.env.GITHUB_REDIRECT_URI;
    this.oauthBaseUrl = (config.oauthBaseUrl || 'https://github.com').replace(/\/+$/, '');
    this.scope = config.scope || 'read:user,repo';
  }

  createAuthorizationUrl(state: string, redirectUri?: string): string {
    if (!this.clientId) {
      throw new ProviderAuthError(
        'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID in the backend environment.'
      );
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: this.scope,
      state,
    });

    const targetRedirect = redirectUri || this.redirectUri;
    if (targetRedirect) {
      params.set('redirect_uri', targetRedirect);
    }

    return `${this.oauthBaseUrl}/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, redirectUri?: string): Promise<OAuthTokens> {
    if (!this.clientId || !this.clientSecret) {
      throw new ProviderAuthError(
        'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the backend environment.'
      );
    }

    const targetRedirect = redirectUri || this.redirectUri;
    const body: Record<string, string> = {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
    };
    if (targetRedirect) {
      body['redirect_uri'] = targetRedirect;
    }

    const response = await fetch(`${this.oauthBaseUrl}/login/oauth/access_token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Avenza-Integration-Hub/1.0',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new ProviderAuthError(`GitHub token exchange failed with HTTP status ${response.status}`);
    }

    const data = (await response.json()) as GitHubOAuthTokenResponse;

    if (data.error || !data.access_token) {
      throw new ProviderAuthError(data.error_description || data.error || 'Failed to obtain access token from GitHub.');
    }

    return {
      accessToken: data.access_token,
      tokenType: data.token_type || 'bearer',
      scope: data.scope,
    };
  }

  async fetchIdentity(accessToken: string): Promise<ExternalIdentity> {
    const user = await this.client.getAuthenticatedUser(accessToken);

    return {
      externalAccountId: String(user.id),
      username: user.login,
      displayName: user.name,
      avatarUrl: user.avatar_url,
      email: user.email,
      rawProfile: {
        id: user.id,
        login: user.login,
        name: user.name,
        public_repos: user.public_repos,
        followers: user.followers,
      },
    };
  }

  async revokeToken(token: string): Promise<void> {
    if (!this.clientId || !this.clientSecret) {
      return;
    }

    const authHeader = 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`https://api.github.com/applications/${this.clientId}/grant`, {
        method: 'DELETE',
        headers: {
          Authorization: authHeader,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Avenza-Integration-Hub/1.0',
        },
        body: JSON.stringify({ access_token: token }),
        signal: controller.signal,
      });

      // 204 No Content means grant revoked; 404 Not Found means token already revoked or invalid
      if (response.status === 204 || response.status === 404) {
        return;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new ProviderAuthError(
          `GitHub token revocation failed (HTTP ${response.status}): ${errorText}`
        );
      }
    } catch (err) {
      if (err instanceof ProviderAuthError) {
        throw err;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('GitHub token revocation timed out after 15 seconds.');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
