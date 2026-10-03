import {
  CreateSkillInputSchema,
  LinkEvidenceToSkillInputSchema,
  LinkGoalToSkillInputSchema,
  LinkTaskToSkillInputSchema,
  LinkTopicToSkillInputSchema,
  SkillQuerySchema,
  UpdateSkillInputSchema,
} from '@avenza/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ISkillsService } from './skills.types';

export class SkillError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'SKILL_ERROR',
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'SkillError';
  }
}

export class SkillsController {
  constructor(private readonly service: ISkillsService) {}

  private getProfileId(request: FastifyRequest): string {
    const profileId = request.auth?.profileId || request.profile?.id;
    if (!profileId) {
      throw new SkillError('User profile not resolved.', 'UNAUTHORIZED', 401);
    }
    return profileId;
  }

  createSkill = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const parsed = CreateSkillInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid skill input.',
            details: parsed.error.format(),
          },
        });
      }

      const created = await this.service.createSkill(userId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: created,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  listSkills = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const parsed = SkillQuerySchema.safeParse(request.query);
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

      const skills = await this.service.listSkills(userId, parsed.data);
      return reply.status(200).send({
        success: true,
        data: skills,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  getSkill = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const result = await this.service.getSkill(userId, id);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  getSkillDetail = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const detail = await this.service.getSkillDetail(userId, id);
      return reply.status(200).send({
        success: true,
        data: detail,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  getSkillMastery = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const mastery = await this.service.getSkillMastery(userId, id);
      return reply.status(200).send({
        success: true,
        data: mastery,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  updateSkill = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const parsed = UpdateSkillInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update payload.',
            details: parsed.error.format(),
          },
        });
      }

      const updated = await this.service.updateSkill(userId, id, parsed.data);
      return reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  archiveSkill = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const archived = await this.service.archiveSkill(userId, id);
      return reply.status(200).send({
        success: true,
        data: archived,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  deleteSkill = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      await this.service.deleteSkill(userId, id);
      return reply.status(200).send({
        success: true,
        data: { message: 'Skill deleted successfully.' },
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  // ----------------------------------------------------------------------------
  // Relationship Endpoints
  // ----------------------------------------------------------------------------
  linkEvidence = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id: skillId } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const parsed = LinkEvidenceToSkillInputSchema.safeParse({
        ...body,
        skill_id: skillId,
      });

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid link evidence payload.',
            details: parsed.error.format(),
          },
        });
      }

      const linked = await this.service.linkEvidence(userId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: linked,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  unlinkEvidence = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id: skillId, evidenceId } = request.params as { id: string; evidenceId: string };
      await this.service.unlinkEvidence(userId, evidenceId, skillId);
      return reply.status(200).send({
        success: true,
        data: { message: 'Evidence unlinked successfully.' },
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  linkGoal = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id: skillId } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const parsed = LinkGoalToSkillInputSchema.safeParse({
        ...body,
        skill_id: skillId,
      });

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid link goal payload.',
            details: parsed.error.format(),
          },
        });
      }

      const linked = await this.service.linkGoal(userId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: linked,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  unlinkGoal = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id: skillId, goalId } = request.params as { id: string; goalId: string };
      await this.service.unlinkGoal(userId, goalId, skillId);
      return reply.status(200).send({
        success: true,
        data: { message: 'Goal unlinked successfully.' },
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  linkTask = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id: skillId } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const parsed = LinkTaskToSkillInputSchema.safeParse({
        ...body,
        skill_id: skillId,
      });

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid link task payload.',
            details: parsed.error.format(),
          },
        });
      }

      const linked = await this.service.linkTask(userId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: linked,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  unlinkTask = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id: skillId, taskId } = request.params as { id: string; taskId: string };
      await this.service.unlinkTask(userId, taskId, skillId);
      return reply.status(200).send({
        success: true,
        data: { message: 'Task unlinked successfully.' },
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  linkTopic = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id: skillId } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const parsed = LinkTopicToSkillInputSchema.safeParse({
        ...body,
        skill_id: skillId,
      });

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid link topic payload.',
            details: parsed.error.format(),
          },
        });
      }

      const linked = await this.service.linkTopic(userId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: linked,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  unlinkTopic = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id: skillId, topicId } = request.params as { id: string; topicId: string };
      await this.service.unlinkTopic(userId, topicId, skillId);
      return reply.status(200).send({
        success: true,
        data: { message: 'Topic unlinked successfully.' },
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  private handleError(err: unknown, reply: FastifyReply) {
    if (err instanceof SkillError) {
      return reply.status(err.statusCode).send({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    const message = err instanceof Error ? err.message : 'Internal Server Error';
    const isClientError =
      message.includes('not found') ||
      message.includes('belong') ||
      message.includes('Circular') ||
      message.includes('violates');

    return reply.status(isClientError ? 400 : 500).send({
      success: false,
      error: {
        code: isClientError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR',
        message,
      },
    });
  }
}
