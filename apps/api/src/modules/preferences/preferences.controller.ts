import type { FastifyReply, FastifyRequest } from 'fastify';
import { UpdatePreferencesInputSchema } from '@avenza/shared';
import {
  defaultPreferencesRepository,
  type IPreferencesRepository,
} from './preferences.repository';

export class PreferencesController {
  constructor(
    private readonly preferencesRepo: IPreferencesRepository = defaultPreferencesRepository
  ) {}

  private getProfileId(request: FastifyRequest): string | null {
    return request.profile?.id || null;
  }

  private sendUnauthorized(reply: FastifyReply): void {
    reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required to access preferences',
      },
    });
  }

  // GET /api/v1/preferences
  async getPreferences(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) {
      return this.sendUnauthorized(reply);
    }

    try {
      const prefs = await this.preferencesRepo.ensurePreferences(userId);
      return reply.status(200).send({ success: true, data: prefs });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch preferences';
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message },
      });
    }
  }

  // PATCH /api/v1/preferences
  async updatePreferences(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) {
      return this.sendUnauthorized(reply);
    }

    const bodyParsed = UpdatePreferencesInputSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid preferences update',
          details: bodyParsed.error.flatten().fieldErrors,
        },
      });
    }

    try {
      const updated = await this.preferencesRepo.updatePreferences(userId, bodyParsed.data);
      return reply.status(200).send({ success: true, data: updated });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update preferences';
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message },
      });
    }
  }
}

export const defaultPreferencesController = new PreferencesController();
