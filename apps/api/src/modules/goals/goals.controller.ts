import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  CreateGoalSchema,
  UpdateGoalSchema,
  CreateMilestoneSchema,
  UpdateMilestoneSchema,
  GoalQuerySchema,
  type ApiErrorResponse,
  type ApiSuccessResponse,
} from '@avenza/shared';
import { z } from 'zod';
import { GoalsService, defaultGoalsService } from './goals.service';

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

const MilestoneParamsSchema = z.object({
  goalId: z.string().uuid(),
  milestoneId: z.string().uuid().optional(),
});

export class GoalsController {
  constructor(private readonly service: GoalsService = defaultGoalsService) {}

  private getProfileId(request: FastifyRequest): string | null {
    return request.profile?.id || null;
  }

  private sendUnauthorized(reply: FastifyReply): void {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authenticated profile context is required.',
      },
    };
    reply.status(401).send(errorResponse);
  }

  private sendNotFound(reply: FastifyReply, message = 'Resource not found'): void {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message,
      },
    };
    reply.status(404).send(errorResponse);
  }

  private sendValidationError(reply: FastifyReply, error: z.ZodError): void {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload validation failed.',
        details: error.flatten().fieldErrors,
      },
    };
    reply.status(400).send(errorResponse);
  }

  // GET /api/v1/goals
  async listGoals(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const queryParsed = GoalQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return this.sendValidationError(reply, queryParsed.error);
    }

    const result = await this.service.listGoals({
      ...queryParsed.data,
      userId,
    });

    return reply.status(200).send({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }

  // GET /api/v1/goals/:id
  async getGoal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const goal = await this.service.getGoalById(paramsParsed.data.id, userId);
    if (!goal) {
      return this.sendNotFound(reply, 'Goal not found');
    }

    const response: ApiSuccessResponse<typeof goal> = {
      success: true,
      data: goal,
    };
    return reply.status(200).send(response);
  }

  // POST /api/v1/goals
  async createGoal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const bodyParsed = CreateGoalSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    const goal = await this.service.createGoal(bodyParsed.data, userId);
    const response: ApiSuccessResponse<typeof goal> = {
      success: true,
      data: goal,
    };
    return reply.status(201).send(response);
  }

  // PATCH /api/v1/goals/:id
  async updateGoal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const bodyParsed = UpdateGoalSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    const updated = await this.service.updateGoal(paramsParsed.data.id, userId, bodyParsed.data);
    if (!updated) {
      return this.sendNotFound(reply, 'Goal not found');
    }

    const response: ApiSuccessResponse<typeof updated> = {
      success: true,
      data: updated,
    };
    return reply.status(200).send(response);
  }

  // DELETE /api/v1/goals/:id
  async deleteGoal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const deleted = await this.service.deleteGoal(paramsParsed.data.id, userId);
    if (!deleted) {
      return this.sendNotFound(reply, 'Goal not found');
    }

    return reply.status(200).send({
      success: true,
      data: { deleted: true },
    });
  }

  // GET /api/v1/goals/:goalId/milestones
  async listMilestones(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = MilestoneParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const milestones = await this.service.listMilestones(paramsParsed.data.goalId, userId);
    if (milestones === null) {
      return this.sendNotFound(reply, 'Parent goal not found');
    }

    return reply.status(200).send({
      success: true,
      data: milestones,
    });
  }

  // POST /api/v1/goals/:goalId/milestones
  async createMilestone(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = MilestoneParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const bodyParsed = CreateMilestoneSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    const milestone = await this.service.createMilestone(
      paramsParsed.data.goalId,
      userId,
      bodyParsed.data
    );
    if (!milestone) {
      return this.sendNotFound(reply, 'Parent goal not found');
    }

    return reply.status(201).send({
      success: true,
      data: milestone,
    });
  }

  // PATCH /api/v1/goals/:goalId/milestones/:milestoneId
  async updateMilestone(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = MilestoneParamsSchema.safeParse(request.params);
    if (!paramsParsed.success || !paramsParsed.data.milestoneId) {
      return this.sendValidationError(
        reply,
        paramsParsed.error || new z.ZodError([{ code: 'custom', path: ['milestoneId'], message: 'Required' }])
      );
    }

    const bodyParsed = UpdateMilestoneSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    const updated = await this.service.updateMilestone(
      paramsParsed.data.milestoneId,
      paramsParsed.data.goalId,
      userId,
      bodyParsed.data
    );

    if (!updated) {
      return this.sendNotFound(reply, 'Milestone or parent goal not found');
    }

    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }

  // DELETE /api/v1/goals/:goalId/milestones/:milestoneId
  async deleteMilestone(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = MilestoneParamsSchema.safeParse(request.params);
    if (!paramsParsed.success || !paramsParsed.data.milestoneId) {
      return this.sendValidationError(
        reply,
        paramsParsed.error || new z.ZodError([{ code: 'custom', path: ['milestoneId'], message: 'Required' }])
      );
    }

    const deleted = await this.service.deleteMilestone(
      paramsParsed.data.milestoneId,
      paramsParsed.data.goalId,
      userId
    );

    if (!deleted) {
      return this.sendNotFound(reply, 'Milestone or parent goal not found');
    }

    return reply.status(200).send({
      success: true,
      data: { deleted: true },
    });
  }
}

export const defaultGoalsController = new GoalsController();
