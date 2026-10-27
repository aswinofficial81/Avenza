import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthMeResponse, ApiErrorResponse } from '@avenza/shared';
import { defaultAccountDeletionService, AccountDeletionService } from './account-deletion.service';
import { defaultAccountExportService, AccountExportService } from './account-export.service';

export class ProfileController {
  constructor(
    private readonly deletionService: AccountDeletionService = defaultAccountDeletionService,
    private readonly exportService: AccountExportService = defaultAccountExportService
  ) {}

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

  async deleteMe(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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

    const body =
      (request.body as {
        confirmation?: string;
        password?: string;
        reauthToken?: string;
        reauthSessionId?: string;
        authMethod?: string;
      }) || {};

    try {
      const result = await this.deletionService.initiateUserDeletion(
        profile.id,
        auth.clerkUserId,
        {
          confirmation: body.confirmation || '',
          password: body.password,
          reauthToken: body.reauthToken,
          reauthSessionId: body.reauthSessionId,
          authMethod: body.authMethod,
        }
      );

      return reply.status(200).send({
        success: true,
        message: result.message,
      });
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode || 500;
      const code = (err as { code?: string }).code || 'ACCOUNT_DELETION_FAILED';
      const message = err instanceof Error ? err.message : String(err);

      return reply.status(statusCode).send({
        success: false,
        error: {
          code,
          message,
        },
      });
    }
  }

  async exportAccountData(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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

    try {
      const exportPayload = await this.exportService.exportUserData(profile.id);

      reply.header('content-type', 'application/json; charset=utf-8');
      reply.header(
        'content-disposition',
        `attachment; filename="avenza-account-export-${profile.id}-${Date.now()}.json"`
      );

      return reply.status(200).send(exportPayload);
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode || 500;
      const code = (err as { code?: string }).code || 'EXPORT_FAILED';
      const message = err instanceof Error ? err.message : String(err);

      return reply.status(statusCode).send({
        success: false,
        error: {
          code,
          message,
        },
      });
    }
  }
}

export const defaultProfileController = new ProfileController();
