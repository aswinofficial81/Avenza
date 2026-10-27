import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  CreateProjectMilestoneSchema,
  CreateProjectSchema,
  ProjectQuerySchema,
  ProjectSkillRoleSchema,
  type TaskStatus,
  UpdateProjectMilestoneSchema,
  UpdateProjectSchema,
  type ApiErrorResponse,
} from '@avenza/shared';
import { z } from 'zod';
import { defaultProjectsService, ProjectsService } from './projects.service';
import { ProjectsError } from './projects.types';

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

const ProjectMilestoneParamsSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid().optional(),
});

const GoalLinkParamsSchema = z.object({
  id: z.string().uuid(),
  goalId: z.string().uuid(),
});

const SkillLinkParamsSchema = z.object({
  id: z.string().uuid(),
  skillId: z.string().uuid(),
});

const LinkRepositoryBodySchema = z.object({
  repositoryId: z.string().uuid().nullable().optional(),
  repository_id: z.string().uuid().nullable().optional(),
}).refine(
  (data) => data.repositoryId !== undefined || data.repository_id !== undefined,
  { message: 'repositoryId or repository_id must be provided' }
);

const AttachGoalBodySchema = z.object({
  goalId: z.string().uuid().optional(),
  goal_id: z.string().uuid().optional(),
  isPrimary: z.boolean().optional(),
  is_primary: z.boolean().optional(),
}).refine(
  (data) => data.goalId !== undefined || data.goal_id !== undefined,
  { message: 'goalId or goal_id must be provided' }
);

const UpdateGoalBodySchema = z.object({
  isPrimary: z.boolean().optional(),
  is_primary: z.boolean().optional(),
}).refine(
  (data) => data.isPrimary !== undefined || data.is_primary !== undefined,
  { message: 'isPrimary or is_primary must be provided' }
);

const AttachSkillBodySchema = z.object({
  skillId: z.string().uuid().optional(),
  skill_id: z.string().uuid().optional(),
  role: ProjectSkillRoleSchema.default('primary'),
}).refine(
  (data) => data.skillId !== undefined || data.skill_id !== undefined,
  { message: 'skillId or skill_id must be provided' }
);

const UpdateSkillBodySchema = z.object({
  role: ProjectSkillRoleSchema,
});

const ActivitiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export class ProjectsController {
  constructor(private readonly service: ProjectsService = defaultProjectsService) {}

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
    if (error instanceof ProjectsError) {
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

  // GET /api/v1/projects
  async listProjects(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const queryParsed = ProjectQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return this.sendValidationError(reply, queryParsed.error);
    }

    try {
      const result = await this.service.listProjects({
        ...queryParsed.data,
        userId,
      });

      reply.status(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // POST /api/v1/projects
  async createProject(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const bodyParsed = CreateProjectSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    try {
      const created = await this.service.createProject(userId, bodyParsed.data);
      reply.status(201).send({
        success: true,
        data: created,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // GET /api/v1/projects/:id
  async getProject(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    try {
      const project = await this.service.getProjectById(paramsParsed.data.id, userId);
      if (!project) {
        reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found or access denied.',
          },
        });
        return;
      }

      reply.status(200).send({
        success: true,
        data: project,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // PATCH /api/v1/projects/:id
  async updateProject(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const bodyParsed = UpdateProjectSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    try {
      const updated = await this.service.updateProject(
        paramsParsed.data.id,
        userId,
        bodyParsed.data
      );

      reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // DELETE /api/v1/projects/:id
  async deleteProject(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    try {
      await this.service.deleteProject(paramsParsed.data.id, userId);
      reply.status(200).send({
        success: true,
        data: { deleted: true },
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // GET /api/v1/projects/:projectId/milestones
  async listMilestones(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = ProjectMilestoneParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    try {
      const milestones = await this.service.listMilestones(paramsParsed.data.projectId, userId);
      reply.status(200).send({
        success: true,
        data: milestones,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // POST /api/v1/projects/:projectId/milestones
  async createMilestone(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = ProjectMilestoneParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const bodyParsed = CreateProjectMilestoneSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    try {
      const milestone = await this.service.createMilestone(
        paramsParsed.data.projectId,
        userId,
        bodyParsed.data
      );

      reply.status(201).send({
        success: true,
        data: milestone,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // PATCH /api/v1/projects/:projectId/milestones/:id
  async updateMilestone(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = ProjectMilestoneParamsSchema.safeParse(request.params);
    if (!paramsParsed.success || !paramsParsed.data.id) {
      return this.sendValidationError(
        reply,
        paramsParsed.error ||
          new z.ZodError([
            {
              code: 'custom',
              path: ['id'],
              message: 'Milestone id parameter is required',
            },
          ])
      );
    }

    const bodyParsed = UpdateProjectMilestoneSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    try {
      const milestone = await this.service.updateMilestone(
        paramsParsed.data.projectId,
        paramsParsed.data.id,
        userId,
        bodyParsed.data
      );

      reply.status(200).send({
        success: true,
        data: milestone,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // DELETE /api/v1/projects/:projectId/milestones/:id
  async deleteMilestone(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = ProjectMilestoneParamsSchema.safeParse(request.params);
    if (!paramsParsed.success || !paramsParsed.data.id) {
      return this.sendValidationError(
        reply,
        paramsParsed.error ||
          new z.ZodError([
            {
              code: 'custom',
              path: ['id'],
              message: 'Milestone id parameter is required',
            },
          ])
      );
    }

    try {
      await this.service.deleteMilestone(paramsParsed.data.projectId, paramsParsed.data.id, userId);
      reply.status(200).send({
        success: true,
        data: { deleted: true },
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // POST /api/v1/projects/:id/link-repository
  async linkRepository(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const bodyParsed = LinkRepositoryBodySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    const repoId =
      bodyParsed.data.repositoryId !== undefined
        ? bodyParsed.data.repositoryId
        : bodyParsed.data.repository_id !== undefined
          ? bodyParsed.data.repository_id
          : null;

    try {
      const updated = await this.service.linkRepository(paramsParsed.data.id, userId, repoId);
      reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // GET /api/v1/projects/:id/goals
  async listGoals(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    try {
      const goals = await this.service.listGoals(paramsParsed.data.id, userId);
      reply.status(200).send({
        success: true,
        data: goals,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // POST /api/v1/projects/:id/goals
  async attachGoal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const bodyParsed = AttachGoalBodySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    const goalId = bodyParsed.data.goalId || bodyParsed.data.goal_id!;
    const isPrimary = bodyParsed.data.isPrimary ?? bodyParsed.data.is_primary ?? false;

    try {
      const attached = await this.service.attachGoal(
        paramsParsed.data.id,
        userId,
        goalId,
        isPrimary
      );

      reply.status(201).send({
        success: true,
        data: attached,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // PATCH /api/v1/projects/:id/goals/:goalId
  async updateGoal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = GoalLinkParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const bodyParsed = UpdateGoalBodySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    const isPrimary = bodyParsed.data.isPrimary ?? bodyParsed.data.is_primary ?? false;

    try {
      const updated = await this.service.updateGoal(
        paramsParsed.data.id,
        userId,
        paramsParsed.data.goalId,
        isPrimary
      );

      reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // DELETE /api/v1/projects/:id/goals/:goalId
  async detachGoal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = GoalLinkParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    try {
      await this.service.detachGoal(paramsParsed.data.id, userId, paramsParsed.data.goalId);
      reply.status(200).send({
        success: true,
        data: { unlinked: true },
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // GET /api/v1/projects/:id/skills
  async listSkills(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    try {
      const skills = await this.service.listSkills(paramsParsed.data.id, userId);
      reply.status(200).send({
        success: true,
        data: skills,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // POST /api/v1/projects/:id/skills
  async attachSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const bodyParsed = AttachSkillBodySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    const skillId = bodyParsed.data.skillId || bodyParsed.data.skill_id!;
    const role = bodyParsed.data.role;

    try {
      const attached = await this.service.attachSkill(
        paramsParsed.data.id,
        userId,
        skillId,
        role
      );

      reply.status(201).send({
        success: true,
        data: attached,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // PATCH /api/v1/projects/:id/skills/:skillId
  async updateSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = SkillLinkParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const bodyParsed = UpdateSkillBodySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return this.sendValidationError(reply, bodyParsed.error);
    }

    try {
      const updated = await this.service.updateSkill(
        paramsParsed.data.id,
        userId,
        paramsParsed.data.skillId,
        bodyParsed.data.role
      );

      reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // DELETE /api/v1/projects/:id/skills/:skillId
  async detachSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = SkillLinkParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    try {
      await this.service.detachSkill(paramsParsed.data.id, userId, paramsParsed.data.skillId);
      reply.status(200).send({
        success: true,
        data: { unlinked: true },
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // GET /api/v1/projects/:id/activities
  async getActivities(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const queryParsed = ActivitiesQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return this.sendValidationError(reply, queryParsed.error);
    }

    try {
      const activities = await this.service.getProjectActivities(
        paramsParsed.data.id,
        userId,
        queryParsed.data.limit,
        queryParsed.data.cursor
      );

      reply.status(200).send({
        success: true,
        data: activities,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // GET /api/v1/projects/:id/tasks
  async listProjectTasks(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = IdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return this.sendValidationError(reply, paramsParsed.error);
    }

    const query = request.query as { status?: TaskStatus; milestone_id?: string } | undefined;
    try {
      const tasks = await this.service.listProjectTasks(paramsParsed.data.id, userId, {
        status: query?.status,
        milestoneId: query?.milestone_id,
      });

      reply.status(200).send({
        success: true,
        data: tasks,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }

  // GET /api/v1/projects/:projectId/milestones/:id/tasks
  async listMilestoneTasks(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const paramsParsed = ProjectMilestoneParamsSchema.safeParse(request.params);
    if (!paramsParsed.success || !paramsParsed.data.id) {
      return this.sendValidationError(reply, paramsParsed.error || 'Milestone ID is required');
    }

    const query = request.query as { status?: TaskStatus } | undefined;
    try {
      const tasks = await this.service.listMilestoneTasks(
        paramsParsed.data.projectId,
        paramsParsed.data.id,
        userId,
        { status: query?.status }
      );

      reply.status(200).send({
        success: true,
        data: tasks,
      });
    } catch (err) {
      this.handleError(reply, err);
    }
  }
}

export const defaultProjectsController = new ProjectsController();
