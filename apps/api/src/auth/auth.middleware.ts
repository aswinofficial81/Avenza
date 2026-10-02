import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorResponse } from '@avenza/shared';
import { defaultAuthService, AuthService } from './auth.service';
import { defaultProfileService, ProfileService } from '../modules/identity/profile.service';

export function createRequireAuthMiddleware(
  authService: AuthService = defaultAuthService,
  profileService: ProfileService = defaultProfileService
) {
  return async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or malformed Authorization header. Bearer token required.',
        },
      };
      return reply.status(401).send(errorResponse);
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Bearer token cannot be empty.',
        },
      };
      return reply.status(401).send(errorResponse);
    }

    const verified = await authService.verifyToken(token);
    if (!verified || !verified.clerkUserId) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid, expired, or unverified authentication token.',
        },
      };
      return reply.status(401).send(errorResponse);
    }

    // Resolve or bootstrap profile using the verified Clerk identity
    const profile = await profileService.getOrCreateProfile(verified.clerkUserId, {
      displayName: verified.displayName,
      avatarUrl: verified.avatarUrl,
      timezone: verified.timezone,
    });

    // Populate typed request authentication context
    request.auth = {
      clerkUserId: verified.clerkUserId,
      profileId: profile.id,
    };
    request.profile = profile;
  };
}

export const requireAuth = createRequireAuthMiddleware();
