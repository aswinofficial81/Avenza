import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  CreateFocusSessionSchema,
  CompleteFocusSessionSchema,
  CancelFocusSessionSchema,
  FocusSessionsQuerySchema,
  type ApiErrorResponse,
} from '@avenza/shared';
import { z } from 'zod';
import { FocusService, defaultFocusService, FocusError } from './focus.service';

const IdParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid focus session UUID' }),
});

export class FocusController {
  constructor(private readonly service: FocusService = defaultFocusService) {}

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

  private handleError(reply: FastifyReply, error: unknown): void {
    if (error instanceof FocusError) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      };
      reply.status(error.statusCode).send(errorResponse);
      return;
    }

    if (error instanceof z.ZodError) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request payload validation failed.',
          details: error.flatten().fieldErrors,
        },
      };
      reply.status(400).send(errorResponse);
      return;
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message,
      },
    };
    reply.status(500).send(errorResponse);
  }

  // POST /api/v1/focus-sessions
  async startSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    try {
      const parsed = CreateFocusSessionSchema.parse(request.body);
      const session = await this.service.startSession(userId, parsed);
      return reply.status(201).send({
        success: true,
        data: session,
      });
    } catch (err) {
      return this.handleError(reply, err);
    }
  }

  // GET /api/v1/focus-sessions/active
  async getActiveSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    try {
      const active = await this.service.getActiveSession(userId);
      return reply.status(200).send({
        success: true,
        data: active,
      });
    } catch (err) {
      return this.handleError(reply, err);
    }
  }

  // GET /api/v1/focus-sessions/:id
  async getSessionById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    try {
      const { id } = IdParamSchema.parse(request.params);
      const session = await this.service.getSessionById(id, userId);
      if (!session) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Focus session not found.',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: session,
      });
    } catch (err) {
      return this.handleError(reply, err);
    }
  }

  // GET /api/v1/focus-sessions
  async listSessions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    try {
      const parsed = FocusSessionsQuerySchema.parse(request.query);
      const result = await this.service.listSessions(userId, parsed);
      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      return this.handleError(reply, err);
    }
  }

  // POST /api/v1/focus-sessions/:id/complete
  async completeSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    try {
      const { id } = IdParamSchema.parse(request.params);
      const body = CompleteFocusSessionSchema.safeParse(request.body || {});
      const notes = body.success ? body.data.notes : null;

      const completed = await this.service.completeSession(id, userId, notes);
      return reply.status(200).send({
        success: true,
        data: completed,
      });
    } catch (err) {
      return this.handleError(reply, err);
    }
  }

  // POST /api/v1/focus-sessions/:id/cancel
  async cancelSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    try {
      const { id } = IdParamSchema.parse(request.params);
      const body = CancelFocusSessionSchema.safeParse(request.body || {});
      const notes = body.success ? body.data.notes : null;

      const cancelled = await this.service.cancelSession(id, userId, notes);
      return reply.status(200).send({
        success: true,
        data: cancelled,
      });
    } catch (err) {
      return this.handleError(reply, err);
    }
  }
}

export const defaultFocusController = new FocusController();
