import type { FastifyReply, FastifyRequest } from 'fastify';
import { TodayQuerySchema } from '@avenza/shared';
import type { ITodayService } from './today.types';
import { defaultTodayService } from './today.service';

export class TodayController {
  constructor(private readonly service: ITodayService = defaultTodayService) {}

  private getProfileId(request: FastifyRequest): string | null {
    return request.profile?.id || null;
  }

  private sendUnauthorized(reply: FastifyReply): void {
    reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required to access Today execution surface',
      },
    });
  }

  private sendValidationError(reply: FastifyReply, details: unknown): void {
    reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid Today query parameters',
        details,
      },
    });
  }

  // GET /api/v1/today
  async getToday(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) {
      return this.sendUnauthorized(reply);
    }

    const queryParsed = TodayQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return this.sendValidationError(reply, queryParsed.error.flatten().fieldErrors);
    }

    try {
      const todayData = await this.service.getToday(userId, queryParsed.data);
      return reply.status(200).send({
        success: true,
        data: todayData,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve Today data';
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message,
        },
      });
    }
  }
}

export const defaultTodayController = new TodayController();
