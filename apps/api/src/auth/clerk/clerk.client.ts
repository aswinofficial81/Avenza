import { createClerkClient, verifyToken } from '@clerk/backend';
import { env } from '../../config/env';
import type { VerifiedClerkIdentity } from '../auth.types';

export interface IClerkClient {
  verifyBearerToken(token: string): Promise<VerifiedClerkIdentity | null>;
}

export class ClerkAuthClient implements IClerkClient {
  private clerkClient = env.CLERK_SECRET_KEY
    ? createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
    : null;

  async verifyBearerToken(token: string): Promise<VerifiedClerkIdentity | null> {
    if (!env.CLERK_SECRET_KEY) {
      // In development/test environments without real Clerk secrets
      return null;
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
      });

      const clerkUserId = payload.sub;
      if (!clerkUserId) {
        return null;
      }

      // Optionally fetch richer profile info from Clerk API if client is available
      let displayName: string | null = null;
      let avatarUrl: string | null = null;

      if (this.clerkClient) {
        try {
          const user = await this.clerkClient.users.getUser(clerkUserId);
          displayName =
            user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`.trim()
              : user.firstName || user.username || null;
          avatarUrl = user.imageUrl || null;
        } catch {
          // If fetching user details fails or network is offline, proceed with token claims
        }
      }

      return {
        clerkUserId,
        displayName,
        avatarUrl,
        timezone: null,
      };
    } catch {
      return null;
    }
  }
}

export const defaultClerkClient = new ClerkAuthClient();
