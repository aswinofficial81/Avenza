import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  CreateTaskDependencySchema,
  TaskQuerySchema,
  type ApiErrorResponse,
} from '@avenza/shared';
import { z } from 'zod';
import { TasksService, defaultTasksService } from './tasks.service';
import { TaskBlockedError } from './tasks.types';

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

const DependencyParamsSchema = z.object({
  id: z.string().uuid(),
  dependencyId: z.string().uuid().optional(),
});

export class TasksController {
  constructor(private readonly service: TasksService = defaultTasksService) {}

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

  private sendValidationError(reply: FastifyReply, error: z.ZodError | string): void {
    if (typeof error === 'string') {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error,
        },
      };
      reply.status(400).send(errorResponse);
      return;
    }

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

  // GET /api/v1/tasks
  async listTasks(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const queryParsed = TaskQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return this.sendValidationError(reply, queryParsed.error);
    }

    const result = await this.service.listTasks({
      ...queryParsed.data,
      userId,
    });

    return reply.status(200).send({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }

  // GET /api/v1/tasks/:id
  async getTask(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const task = await this.service.getTaskById(paramsParsed.data.id, userId);
    if (!task) {
      return this.sendNotFound(reply, 'Task not found');
    }

    return reply.status(200).send({
      success: true,
      data: task,
    });
  }

  // POST /api/v1/tasks
  async createTask(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const bodyParsed = CreateTaskSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    try {
      const created = await this.service.createTask(userId, bodyParsed.data);
      return reply.status(201).send({
        success: true,
        data: created,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create task';
      return this.sendValidationError(reply, message);
    }
  }

  // PATCH /api/v1/tasks/:id
  async updateTask(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const bodyParsed = UpdateTaskSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    try {
      const updated = await this.service.updateTask(paramsParsed.data.id, userId, bodyParsed.data);
      if (!updated) {
        return this.sendNotFound(reply, 'Task not found');
      }

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err: unknown) {
      if (err instanceof TaskBlockedError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: 'TASK_BLOCKED',
            message: err.message,
            details: err.blockedBy ? { blocked_by: err.blockedBy } : undefined,
          },
        };
        return reply.status(400).send(errorResponse);
      }
      const message = err instanceof Error ? err.message : 'Failed to update task';
      return this.sendValidationError(reply, message);
    }
  }

  // DELETE /api/v1/tasks/:id
  async deleteTask(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const deleted = await this.service.deleteTask(paramsParsed.data.id, userId);
    if (!deleted) {
      return this.sendNotFound(reply, 'Task not found');
    }

    return reply.status(200).send({
      success: true,
      data: { id: paramsParsed.data.id, deleted: true },
    });
  }

  // GET /api/v1/tasks/:id/dependencies
  async listDependencies(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    try {
      const dependencies = await this.service.listDependencies(paramsParsed.data.id, userId);
      return reply.status(200).send({
        success: true,
        data: dependencies,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Task not found';
      return this.sendNotFound(reply, message);
    }
  }

  // POST /api/v1/tasks/:id/dependencies
  async createDependency(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const bodyParsed = CreateTaskDependencySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    try {
      const created = await this.service.createDependency(
        paramsParsed.data.id,
        bodyParsed.data,
        userId
      );

      return reply.status(201).send({
        success: true,
        data: created,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create dependency';
      return this.sendValidationError(reply, message);
    }
  }

  // DELETE /api/v1/tasks/:id/dependencies/:dependencyId
  async deleteDependency(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = DependencyParamsSchema.safeParse(request.params);
    if (!paramsParsed.success || !paramsParsed.data.dependencyId) {
      return this.sendValidationError(
        reply,
        paramsParsed.success
          ? 'Dependency ID is required.'
          : paramsParsed.error
      );
    }

    const deleted = await this.service.deleteDependency(
      paramsParsed.data.id,
      paramsParsed.data.dependencyId,
      userId
    );

    if (!deleted) {
      return this.sendNotFound(reply, 'Dependency not found');
    }

    return reply.status(200).send({
      success: true,
      data: { id: paramsParsed.data.dependencyId, deleted: true },
    });
  }
}

export const defaultTasksController = new TasksController();
