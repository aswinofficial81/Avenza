import type { IClerkClient } from './clerk/clerk.client';
import { defaultClerkClient } from './clerk/clerk.client';
import type { VerifiedClerkIdentity } from './auth.types';

export class AuthService {
  constructor(private readonly clerkClient: IClerkClient = defaultClerkClient) {}

  async verifyToken(token: string): Promise<VerifiedClerkIdentity | null> {
    if (!token || typeof token !== 'string') {
      return null;
    }

    return this.clerkClient.verifyBearerToken(token.trim());
  }
}

export const defaultAuthService = new AuthService();
