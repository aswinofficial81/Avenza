import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  AddCareerOpportunitySkillSchema,
  AddCareerTargetSkillSchema,
  AttachCareerApplicationProjectSchema,
  CareerApplicationQuerySchema,
  CareerInterviewQuerySchema,
  CareerOpportunityQuerySchema,
  CareerTargetQuerySchema,
  CreateCareerApplicationSchema,
  CreateCareerInterviewSchema,
  CreateCareerOpportunitySchema,
  CreateCareerTargetSchema,
  UpdateCareerApplicationProjectSchema,
  UpdateCareerApplicationSchema,
  UpdateCareerInterviewSchema,
  UpdateCareerOpportunitySchema,
  UpdateCareerOpportunitySkillSchema,
  UpdateCareerTargetSchema,
  UpdateCareerTargetSkillSchema,
  type ApiErrorResponse,
} from '@avenza/shared';
import { z } from 'zod';
import { CareerService, defaultCareerService } from './career.service';
import {
  CareerServiceError,
  TransitionCareerApplicationStageSchema,
} from './career.types';

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

const TargetIdParamSchema = z.object({
  targetId: z.string().uuid(),
});

const TargetSkillParamsSchema = z.object({
  targetId: z.string().uuid(),
  skillId: z.string().uuid(),
});

const OpportunityIdParamSchema = z.object({
  opportunityId: z.string().uuid(),
});

const OpportunitySkillParamsSchema = z.object({
  opportunityId: z.string().uuid(),
  skillId: z.string().uuid(),
});

const ApplicationIdParamSchema = z.object({
  applicationId: z.string().uuid(),
});

const ApplicationProjectParamsSchema = z.object({
  applicationId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export class CareerController {
  constructor(private readonly service: CareerService = defaultCareerService) {}

  private getProfileId(request: FastifyRequest): string | null {
    return request.auth?.profileId || request.profile?.id || null;
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

  private handleError(reply: FastifyReply, error: unknown): void {
    if (error instanceof CareerServiceError) {
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
      return this.sendValidationError(reply, error);
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    });
  }

  // ==============================================================================
  // 1. Career Targets
  // ==============================================================================

  async createTarget(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const parsed = CreateCareerTargetSchema.safeParse(request.body);
    if (!parsed.success) return this.sendValidationError(reply, parsed.error);

    try {
      const created = await this.service.createTarget(userId, parsed.data);
      reply.status(201).send({ success: true, data: created });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async listTargets(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const parsed = CareerTargetQuerySchema.safeParse(request.query);
    if (!parsed.success) return this.sendValidationError(reply, parsed.error);

    try {
      const targets = await this.service.listTargets(userId, parsed.data);
      reply.status(200).send({ success: true, ...targets });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async getTarget(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      const target = await this.service.getTargetDetail(userId, paramsParsed.data.id);
      reply.status(200).send({ success: true, data: target });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async updateTarget(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    const bodyParsed = UpdateCareerTargetSchema.safeParse(request.body);
    if (!bodyParsed.success) return this.sendValidationError(reply, bodyParsed.error);

    try {
      const updated = await this.service.updateTarget(
        userId,
        paramsParsed.data.id,
        bodyParsed.data
      );
      reply.status(200).send({ success: true, data: updated });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async deleteTarget(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      await this.service.deleteTarget(userId, paramsParsed.data.id);
      reply.status(200).send({ success: true, data: { message: 'Target deleted successfully' } });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async setPrimaryTarget(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      const updated = await this.service.setPrimaryTarget(userId, paramsParsed.data.id);
      reply.status(200).send({ success: true, data: updated });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async unsetPrimaryTarget(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      const updated = await this.service.unsetPrimaryTarget(userId, paramsParsed.data.id);
      reply.status(200).send({ success: true, data: updated });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // ==============================================================================
  // 2. Career Target Skills
  // ==============================================================================

  async listTargetSkills(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = TargetIdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      const skills = await this.service.listTargetSkills(userId, paramsParsed.data.targetId);
      reply.status(200).send({ success: true, data: skills });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async addTargetSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = TargetIdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    const bodyParsed = AddCareerTargetSkillSchema.safeParse(request.body);
    if (!bodyParsed.success) return this.sendValidationError(reply, bodyParsed.error);

    try {
      const added = await this.service.addTargetSkill(
        userId,
        paramsParsed.data.targetId,
        bodyParsed.data
      );
      reply.status(201).send({ success: true, data: added });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async updateTargetSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = TargetSkillParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    const bodyParsed = UpdateCareerTargetSkillSchema.safeParse(request.body);
    if (!bodyParsed.success) return this.sendValidationError(reply, bodyParsed.error);

    try {
      const updated = await this.service.updateTargetSkill(
        userId,
        paramsParsed.data.targetId,
        paramsParsed.data.skillId,
        bodyParsed.data
      );
      reply.status(200).send({ success: true, data: updated });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async removeTargetSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = TargetSkillParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      await this.service.removeTargetSkill(
        userId,
        paramsParsed.data.targetId,
        paramsParsed.data.skillId
      );
      reply.status(200).send({ success: true, data: { message: 'Skill removed from target' } });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // ==============================================================================
  // 3. Career Opportunities
  // ==============================================================================

  async createOpportunity(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const parsed = CreateCareerOpportunitySchema.safeParse(request.body);
    if (!parsed.success) return this.sendValidationError(reply, parsed.error);

    try {
      const created = await this.service.createOpportunity(userId, parsed.data);
      reply.status(201).send({ success: true, data: created });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async listOpportunities(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const parsed = CareerOpportunityQuerySchema.safeParse(request.query);
    if (!parsed.success) return this.sendValidationError(reply, parsed.error);

    try {
      const opps = await this.service.listOpportunities(userId, parsed.data);
      reply.status(200).send({ success: true, ...opps });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async getOpportunity(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      const opp = await this.service.getOpportunityDetail(userId, paramsParsed.data.id);
      reply.status(200).send({ success: true, data: opp });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async updateOpportunity(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    const bodyParsed = UpdateCareerOpportunitySchema.safeParse(request.body);
    if (!bodyParsed.success) return this.sendValidationError(reply, bodyParsed.error);

    try {
      const updated = await this.service.updateOpportunity(
        userId,
        paramsParsed.data.id,
        bodyParsed.data
      );
      reply.status(200).send({ success: true, data: updated });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async deleteOpportunity(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      await this.service.deleteOpportunity(userId, paramsParsed.data.id);
      reply.status(200).send({ success: true, data: { message: 'Opportunity deleted successfully' } });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // ==============================================================================
  // 4. Career Opportunity Skills
  // ==============================================================================

  async listOpportunitySkills(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = OpportunityIdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      const skills = await this.service.listOpportunitySkills(
        userId,
        paramsParsed.data.opportunityId
      );
      reply.status(200).send({ success: true, data: skills });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async addOpportunitySkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = OpportunityIdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    const bodyParsed = AddCareerOpportunitySkillSchema.safeParse(request.body);
    if (!bodyParsed.success) return this.sendValidationError(reply, bodyParsed.error);

    try {
      const added = await this.service.addOpportunitySkill(
        userId,
        paramsParsed.data.opportunityId,
        bodyParsed.data
      );
      reply.status(201).send({ success: true, data: added });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async updateOpportunitySkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = OpportunitySkillParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    const bodyParsed = UpdateCareerOpportunitySkillSchema.safeParse(request.body);
    if (!bodyParsed.success) return this.sendValidationError(reply, bodyParsed.error);

    try {
      const updated = await this.service.updateOpportunitySkill(
        userId,
        paramsParsed.data.opportunityId,
        paramsParsed.data.skillId,
        bodyParsed.data
      );
      reply.status(200).send({ success: true, data: updated });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async removeOpportunitySkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = OpportunitySkillParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      await this.service.removeOpportunitySkill(
        userId,
        paramsParsed.data.opportunityId,
        paramsParsed.data.skillId
      );
      reply.status(200).send({
        success: true,
        data: { message: 'Opportunity skill requirement removed' },
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // ==============================================================================
  // 5. Career Applications & State Machine
  // ==============================================================================

  async createApplication(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const parsed = CreateCareerApplicationSchema.safeParse(request.body);
    if (!parsed.success) return this.sendValidationError(reply, parsed.error);

    try {
      const created = await this.service.createApplication(userId, parsed.data);
      reply.status(201).send({ success: true, data: created });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async listApplications(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const parsed = CareerApplicationQuerySchema.safeParse(request.query);
    if (!parsed.success) return this.sendValidationError(reply, parsed.error);

    try {
      const apps = await this.service.listApplications(userId, parsed.data);
      reply.status(200).send({ success: true, ...apps });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async getApplication(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      const app = await this.service.getApplicationDetail(userId, paramsParsed.data.id);
      reply.status(200).send({ success: true, data: app });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async updateApplication(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    const bodyParsed = UpdateCareerApplicationSchema.safeParse(request.body);
    if (!bodyParsed.success) return this.sendValidationError(reply, bodyParsed.error);

    try {
      const updated = await this.service.updateApplication(
        userId,
        paramsParsed.data.id,
        bodyParsed.data
      );
      reply.status(200).send({ success: true, data: updated });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async deleteApplication(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      await this.service.deleteApplication(userId, paramsParsed.data.id);
      reply.status(200).send({
        success: true,
        data: { message: 'Application deleted successfully' },
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async listApplicationHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      const history = await this.service.listApplicationHistory(
        userId,
        paramsParsed.data.id
      );
      reply.status(200).send({ success: true, data: history });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async transitionStage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    const bodyParsed = TransitionCareerApplicationStageSchema.safeParse(request.body);
    if (!bodyParsed.success) return this.sendValidationError(reply, bodyParsed.error);

    try {
      const result = await this.service.transitionApplicationStage(
        userId,
        paramsParsed.data.id,
        bodyParsed.data
      );
      reply.status(200).send({ success: true, data: result });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // ==============================================================================
  // 6. Career Application Projects
  // ==============================================================================

  async listApplicationProjects(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = ApplicationIdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      const projects = await this.service.listApplicationProjects(
        userId,
        paramsParsed.data.applicationId
      );
      reply.status(200).send({ success: true, data: projects });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async attachApplicationProject(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = ApplicationIdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    const bodyParsed = AttachCareerApplicationProjectSchema.safeParse(request.body);
    if (!bodyParsed.success) return this.sendValidationError(reply, bodyParsed.error);

    try {
      const attached = await this.service.attachApplicationProject(
        userId,
        paramsParsed.data.applicationId,
        bodyParsed.data
      );
      reply.status(201).send({ success: true, data: attached });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async updateApplicationProject(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = ApplicationProjectParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    const bodyParsed = UpdateCareerApplicationProjectSchema.safeParse(request.body);
    if (!bodyParsed.success) return this.sendValidationError(reply, bodyParsed.error);

    try {
      const updated = await this.service.updateApplicationProject(
        userId,
        paramsParsed.data.applicationId,
        paramsParsed.data.projectId,
        bodyParsed.data
      );
      reply.status(200).send({ success: true, data: updated });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async removeApplicationProject(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = ApplicationProjectParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      await this.service.removeApplicationProject(
        userId,
        paramsParsed.data.applicationId,
        paramsParsed.data.projectId
      );
      reply.status(200).send({
        success: true,
        data: { message: 'Project removed from application collateral' },
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // ==============================================================================
  // 7. Career Interviews
  // ==============================================================================

  async createInterview(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = ApplicationIdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    const bodyParsed = CreateCareerInterviewSchema.safeParse(request.body);
    if (!bodyParsed.success) return this.sendValidationError(reply, bodyParsed.error);

    try {
      const created = await this.service.createInterview(
        userId,
        paramsParsed.data.applicationId,
        bodyParsed.data
      );
      reply.status(201).send({ success: true, data: created });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async listApplicationInterviews(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = ApplicationIdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      const interviews = await this.service.listInterviews(userId, {
        application_id: paramsParsed.data.applicationId,
      });
      reply.status(200).send({ success: true, ...interviews });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async listInterviews(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const parsed = CareerInterviewQuerySchema.safeParse(request.query);
    if (!parsed.success) return this.sendValidationError(reply, parsed.error);

    try {
      const interviews = await this.service.listInterviews(userId, parsed.data);
      reply.status(200).send({ success: true, ...interviews });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async getInterview(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      const interview = await this.service.getInterviewById(userId, paramsParsed.data.id);
      reply.status(200).send({ success: true, data: interview });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async updateInterview(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    const bodyParsed = UpdateCareerInterviewSchema.safeParse(request.body);
    if (!bodyParsed.success) return this.sendValidationError(reply, bodyParsed.error);

    try {
      const updated = await this.service.updateInterview(
        userId,
        paramsParsed.data.id,
        bodyParsed.data
      );
      reply.status(200).send({ success: true, data: updated });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async deleteInterview(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      await this.service.deleteInterview(userId, paramsParsed.data.id);
      reply.status(200).send({
        success: true,
        data: { message: 'Interview round deleted successfully' },
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // ==============================================================================
  // 8. Readiness & Preparation Integration
  // ==============================================================================

  async getApplicationPreparation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      const prep = await this.service.getApplicationPreparation(userId, paramsParsed.data.id);
      reply.status(200).send({ success: true, data: prep });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  async listApplicationTasks(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return this.sendValidationError(reply, paramsParsed.error);

    try {
      const tasks = await this.service.listApplicationTasks(userId, paramsParsed.data.id);
      reply.status(200).send({ success: true, data: tasks });
    } catch (err) {
      this.handleError(reply, err);
    }
  }
}

export const defaultCareerController = new CareerController();
