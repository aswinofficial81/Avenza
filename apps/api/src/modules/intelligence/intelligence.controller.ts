import type { FastifyReply, FastifyRequest } from 'fastify';
import { NextActionQuerySchema } from '@avenza/shared';
import { IntelligenceService } from './intelligence.service';

export class IntelligenceController {
  constructor(private readonly service: IntelligenceService = new IntelligenceService()) {}

  private getProfileId(request: FastifyRequest): string | null {
    return request.profile?.id || null;
  }

  private sendUnauthorized(reply: FastifyReply): void {
    reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required to access Intelligence engine',
      },
    });
  }

  private sendValidationError(reply: FastifyReply, details: unknown): void {
    reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid Next Action query parameters',
        details,
      },
    });
  }

  // GET /api/v1/intelligence/next-action
  async getNextAction(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) {
      return this.sendUnauthorized(reply);
    }

    const queryParsed = NextActionQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return this.sendValidationError(reply, queryParsed.error.flatten().fieldErrors);
    }

    try {
      const nextActionData = await this.service.getNextAction(userId, queryParsed.data);
      return reply.status(200).send({
        success: true,
        data: nextActionData,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to compute Next Best Action';
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
