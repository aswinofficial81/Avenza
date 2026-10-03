import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { SkillsController } from './skills.controller';
import { SupabaseSkillsRepository } from './skills.repository';
import { SkillsService } from './skills.service';

export interface SkillsRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  skillsController?: SkillsController;
}

export function createSkillsRoutes(opts: SkillsRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;

  return async (fastify) => {
    const controller =
      opts.skillsController ||
      (() => {
        const repo = new SupabaseSkillsRepository();
        const service = new SkillsService(repo);
        return new SkillsController(service);
      })();

    // POST /api/v1/skills — Create skill
    fastify.post(
      '/api/v1/skills',
      { preHandler: [authHook] },
      async (request, reply) => controller.createSkill(request, reply)
    );

    // GET /api/v1/skills — List skills with optional filters & mastery
    fastify.get(
      '/api/v1/skills',
      { preHandler: [authHook] },
      async (request, reply) => controller.listSkills(request, reply)
    );

    // GET /api/v1/skills/:id — Get single skill with mastery
    fastify.get(
      '/api/v1/skills/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getSkill(request, reply)
    );

    // GET /api/v1/skills/:id/detail — Get full skill detail (mastery, evidence, goals, tasks, topics)
    fastify.get(
      '/api/v1/skills/:id/detail',
      { preHandler: [authHook] },
      async (request, reply) => controller.getSkillDetail(request, reply)
    );

    // GET /api/v1/skills/:id/mastery — Derived mastery only
    fastify.get(
      '/api/v1/skills/:id/mastery',
      { preHandler: [authHook] },
      async (request, reply) => controller.getSkillMastery(request, reply)
    );

    // PATCH /api/v1/skills/:id — Update skill
    fastify.patch(
      '/api/v1/skills/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateSkill(request, reply)
    );

    // POST /api/v1/skills/:id/archive — Archive skill
    fastify.post(
      '/api/v1/skills/:id/archive',
      { preHandler: [authHook] },
      async (request, reply) => controller.archiveSkill(request, reply)
    );

    // DELETE /api/v1/skills/:id — Delete skill
    fastify.delete(
      '/api/v1/skills/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteSkill(request, reply)
    );

    // POST /api/v1/skills/:id/evidence — Link evidence to skill
    fastify.post(
      '/api/v1/skills/:id/evidence',
      { preHandler: [authHook] },
      async (request, reply) => controller.linkEvidence(request, reply)
    );

    // DELETE /api/v1/skills/:id/evidence/:evidenceId — Unlink evidence from skill
    fastify.delete(
      '/api/v1/skills/:id/evidence/:evidenceId',
      { preHandler: [authHook] },
      async (request, reply) => controller.unlinkEvidence(request, reply)
    );

    // POST /api/v1/skills/:id/goals — Link goal to skill
    fastify.post(
      '/api/v1/skills/:id/goals',
      { preHandler: [authHook] },
      async (request, reply) => controller.linkGoal(request, reply)
    );

    // DELETE /api/v1/skills/:id/goals/:goalId — Unlink goal from skill
    fastify.delete(
      '/api/v1/skills/:id/goals/:goalId',
      { preHandler: [authHook] },
      async (request, reply) => controller.unlinkGoal(request, reply)
    );

    // POST /api/v1/skills/:id/tasks — Link task to skill
    fastify.post(
      '/api/v1/skills/:id/tasks',
      { preHandler: [authHook] },
      async (request, reply) => controller.linkTask(request, reply)
    );

    // DELETE /api/v1/skills/:id/tasks/:taskId — Unlink task from skill
    fastify.delete(
      '/api/v1/skills/:id/tasks/:taskId',
      { preHandler: [authHook] },
      async (request, reply) => controller.unlinkTask(request, reply)
    );

    // POST /api/v1/skills/:id/topics — Link academic topic to skill
    fastify.post(
      '/api/v1/skills/:id/topics',
      { preHandler: [authHook] },
      async (request, reply) => controller.linkTopic(request, reply)
    );

    // DELETE /api/v1/skills/:id/topics/:topicId — Unlink academic topic from skill
    fastify.delete(
      '/api/v1/skills/:id/topics/:topicId',
      { preHandler: [authHook] },
      async (request, reply) => controller.unlinkTopic(request, reply)
    );
  };
}

export const skillsRoutes: FastifyPluginAsync = createSkillsRoutes();
