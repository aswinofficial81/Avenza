import type { IAuthProvider } from '../base/auth.interface';
import { type ExternalIdentity, type OAuthTokens, ProviderAuthError } from '../base/provider.types';
import { GoogleCalendarClient } from './google-calendar.client';
import type { GoogleOAuthTokenResponse } from './google-calendar.types';

export interface GoogleCalendarAuthConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scope?: string;
}

export class GoogleCalendarAuthProvider implements IAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri?: string;
  private readonly scope: string;

  constructor(
    config: GoogleCalendarAuthConfig = {},
    private readonly client: GoogleCalendarClient = new GoogleCalendarClient()
  ) {
    this.clientId = config.clientId || process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = config.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = config.redirectUri || process.env.GOOGLE_REDIRECT_URI;
    this.scope =
      config.scope || 'openid email profile https://www.googleapis.com/auth/calendar.readonly';
  }

  createAuthorizationUrl(state: string, redirectUri?: string): string {
    if (!this.clientId) {
      throw new ProviderAuthError(
        'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID in the backend environment.'
      );
    }

    const targetRedirect = redirectUri || this.redirectUri;
    if (!targetRedirect) {
      throw new ProviderAuthError('Google OAuth redirect_uri is missing.');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: targetRedirect,
      response_type: 'code',
      scope: this.scope,
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, redirectUri?: string): Promise<OAuthTokens> {
    if (!this.clientId || !this.clientSecret) {
      throw new ProviderAuthError(
        'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend environment.'
      );
    }

    const targetRedirect = redirectUri || this.redirectUri;
    if (!targetRedirect) {
      throw new ProviderAuthError('Google OAuth redirect_uri is missing.');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: targetRedirect,
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new ProviderAuthError(`Google token exchange failed (HTTP ${response.status}): ${errText}`);
    }

    const data = (await response.json()) as GoogleOAuthTokenResponse;

    if (data.error || !data.access_token) {
      throw new ProviderAuthError(data.error_description || data.error || 'Failed to obtain access token from Google.');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresIn: data.expires_in,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    if (!this.clientId || !this.clientSecret) {
      throw new ProviderAuthError(
        'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend environment.'
      );
    }

    const data = await this.client.refreshAccessToken(refreshToken, this.clientId, this.clientSecret);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Google may not send a new refresh token if the previous is still valid
      expiresIn: data.expires_in,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope,
    };
  }

  async fetchIdentity(accessToken: string): Promise<ExternalIdentity> {
    const userInfo = await this.client.fetchUserInfo(accessToken);

    return {
      externalAccountId: userInfo.sub, // Stable Google OpenID Connect subject identifier
      username: userInfo.email,
      displayName: userInfo.name || userInfo.email,
      avatarUrl: userInfo.picture || null,
      email: userInfo.email,
      rawProfile: userInfo as unknown as Record<string, unknown>,
    };
  }

  async revokeToken(token: string): Promise<void> {
    await this.client.revokeToken(token);
  }
}
