import type { FastifyReply, FastifyRequest } from 'fastify';
import { AnalyticsSummaryQuerySchema } from '@avenza/shared';
import type { IAnalyticsService } from './analytics.types';
import { defaultAnalyticsService } from './analytics.service';

export class AnalyticsController {
  constructor(private readonly service: IAnalyticsService = defaultAnalyticsService) { }

  private getProfileId(request: FastifyRequest): string | null {
    return request.profile?.id || null;
  }

  private sendUnauthorized(reply: FastifyReply): void {
    reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required to access Analytics diagnostics',
      },
    });
  }

  private sendValidationError(reply: FastifyReply, details: unknown): void {
    reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid analytics query parameters',
        details,
      },
    });
  }

  // GET /api/v1/analytics/summary
  async getSummary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) {
      return this.sendUnauthorized(reply);
    }

    const queryParsed = AnalyticsSummaryQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return this.sendValidationError(
        reply,
        queryParsed.error.flatten().fieldErrors
      );
    }

    try {
      const summary = await this.service.getAnalyticsSummary(
        userId,
        queryParsed.data
      );
      return reply.status(200).send({
        success: true,
        data: summary,
      });
    } catch (err: unknown) {
      request.log.error(err);
      const message =
        err instanceof Error ? err.message : 'Failed to retrieve analytics summary';
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

export const defaultAnalyticsController = new AnalyticsController();
