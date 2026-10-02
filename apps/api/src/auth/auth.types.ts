import type { ProfileRow } from '@avenza/shared';

export interface VerifiedClerkIdentity {
  clerkUserId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  timezone?: string | null;
}

export interface RequestAuthContext {
  clerkUserId: string;
  profileId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: RequestAuthContext;
    profile?: ProfileRow;
  }
}
