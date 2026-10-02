import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthMeResponse, ApiErrorResponse } from '@avenza/shared';

export class ProfileController {
  async getMe(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const auth = request.auth;
    const profile = request.profile;

    if (!auth || !profile) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated profile context is unavailable.',
        },
      };
      return reply.status(401).send(errorResponse);
    }

    const response: AuthMeResponse = {
      success: true,
      data: {
        clerkUserId: auth.clerkUserId,
        profile: {
          id: profile.id,
          clerkUserId: profile.clerk_user_id,
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url,
          timezone: profile.timezone,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        },
      },
    };

    return reply.status(200).send(response);
  }
}

export const defaultProfileController = new ProfileController();
