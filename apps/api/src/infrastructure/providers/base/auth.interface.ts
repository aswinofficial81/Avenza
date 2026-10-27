import type { ExternalIdentity, OAuthTokens } from './provider.types';

export interface IAuthProvider {
  createAuthorizationUrl?(state: string, redirectUri?: string): string;
  exchangeCodeForTokens?(code: string, redirectUri?: string): Promise<OAuthTokens>;
  refreshAccessToken?(refreshToken: string): Promise<OAuthTokens>;
  fetchIdentity?(accessToken: string): Promise<ExternalIdentity>;
  connectWithIdentifier?(identifier: string): Promise<ExternalIdentity>;
  revokeToken?(token: string): Promise<void>;
}
