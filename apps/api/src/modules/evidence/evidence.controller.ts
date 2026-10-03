import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  CreateEvidenceInputSchema,
  EvidenceQuerySchema,
  UpdateEvidenceInputSchema,
} from '@avenza/shared';
import { EvidenceError, type EvidenceService } from './evidence.service';

export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  private getProfileId(request: FastifyRequest): string {
    const profileId = request.auth?.profileId || request.profile?.id;
    if (!profileId) {
      throw new EvidenceError('User profile not resolved.', 'UNAUTHORIZED', 401);
    }
    return profileId;
  }

  createEvidence = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const parsed = CreateEvidenceInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid evidence input data.',
            details: parsed.error.format(),
          },
        });
      }

      const created = await this.evidenceService.createManualEvidence(userId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: created,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  getEvidence = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const parsed = EvidenceQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters.',
            details: parsed.error.format(),
          },
        });
      }

      const result = await this.evidenceService.getEvidence(userId, parsed.data);
      return reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
        summary: result.summary,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  getEvidenceById = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const evidence = await this.evidenceService.getEvidenceById(id, userId);
      return reply.status(200).send({
        success: true,
        data: evidence,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  updateEvidence = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const parsed = UpdateEvidenceInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update data.',
            details: parsed.error.format(),
          },
        });
      }

      const updated = await this.evidenceService.updateEvidence(id, userId, parsed.data);
      return reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  deleteEvidence = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      await this.evidenceService.deleteEvidence(id, userId);
      return reply.status(200).send({
        success: true,
        data: { deleted: true },
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  recordFocusSessionEvidence = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { sessionId } = request.params as { sessionId: string };
      const created = await this.evidenceService.recordFocusSessionEvidence(userId, sessionId);
      return reply.status(201).send({
        success: true,
        data: created,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  private handleError(err: unknown, reply: FastifyReply) {
    if (err instanceof EvidenceError) {
      return reply.status(err.statusCode).send({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    });
  }
}
