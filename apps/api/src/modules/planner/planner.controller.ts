import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  ApplyScheduleInputSchema,
  ProposeScheduleInputSchema,
} from '@avenza/shared';
import { PlannerService, defaultPlannerService } from './planner.service';

export class PlannerController {
  constructor(private readonly service: PlannerService = defaultPlannerService) {}

  private getProfileId(request: FastifyRequest): string | null {
    return request.profile?.id || null;
  }

  private sendUnauthorized(reply: FastifyReply): void {
    reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required to access Planner',
      },
    });
  }

  // POST /api/v1/planner/propose
  async proposeSchedule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) {
      return this.sendUnauthorized(reply);
    }

    const bodyParsed = ProposeScheduleInputSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid schedule proposal request parameters',
          details: bodyParsed.error.flatten().fieldErrors,
        },
      });
    }

    try {
      const proposal = await this.service.proposeSchedule(userId, bodyParsed.data);
      return reply.status(200).send({
        success: true,
        data: proposal,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate schedule proposal';

      if (message.includes('Study window preferences')) {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'CONFIGURATION_REQUIRED',
            message,
          },
        });
      }

      if (message.includes('Invalid study window')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_STUDY_WINDOW',
            message,
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message,
        },
      });
    }
  }

  // POST /api/v1/planner/apply
  async applySchedule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) {
      return this.sendUnauthorized(reply);
    }

    const bodyParsed = ApplyScheduleInputSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid schedule application parameters',
          details: bodyParsed.error.flatten().fieldErrors,
        },
      });
    }

    try {
      const result = await this.service.applySchedule(userId, bodyParsed.data);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to apply schedule';

      if (message.includes('Stale proposal')) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'STALE_PROPOSAL',
            message: 'One or more tasks were modified after the proposal was generated. Please refresh the proposal.',
          },
        });
      }

      if (message.toLowerCase().includes('overlap') || message.includes('Schedule conflict')) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'SCHEDULE_CONFLICT',
            message,
          },
        });
      }

      if (message.includes('Study window preferences')) {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'CONFIGURATION_REQUIRED',
            message,
          },
        });
      }

      if (message.includes('whole-minute boundaries') || message.includes('minute-aligned') || message.includes('exact number of minutes')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message,
          },
        });
      }

      if (message.includes('Invalid block duration') || message.includes('does not match task estimate')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DURATION',
            message,
          },
        });
      }

      if (message.includes('outside the user\'s configured study window') || message.includes('outside the configured study window')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'BLOCK_OUTSIDE_STUDY_WINDOW',
            message,
          },
        });
      }

      if (message.includes('exceeds configured maximum daily') || message.includes('exceeds the configured maximum daily')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'CAPACITY_EXCEEDED',
            message,
          },
        });
      }

      if (message.includes('non-schedulable status') || message.includes('terminal status')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'TASK_INELIGIBLE',
            message,
          },
        });
      }

      if (message.includes('blocked by') || message.includes('incomplete prerequisite')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'TASK_BLOCKED',
            message,
          },
        });
      }

      if (message.includes('not found') || message.includes('another user')) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message,
          },
        });
      }

      return reply.status(400).send({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message,
        },
      });
    }
  }
}
