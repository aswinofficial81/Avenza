import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { defaultProjectsController, ProjectsController } from './projects.controller';

export interface ProjectsRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  projectsController?: ProjectsController;
}

export function createProjectsRoutes(opts: ProjectsRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;
  const controller = opts.projectsController || defaultProjectsController;

  return async (fastify) => {
    // 1. Project CRUD
    fastify.get(
      '/api/v1/projects',
      { preHandler: [authHook] },
      async (request, reply) => controller.listProjects(request, reply)
    );

    fastify.post(
      '/api/v1/projects',
      { preHandler: [authHook] },
      async (request, reply) => controller.createProject(request, reply)
    );

    fastify.get(
      '/api/v1/projects/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getProject(request, reply)
    );

    fastify.patch(
      '/api/v1/projects/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateProject(request, reply)
    );

    fastify.delete(
      '/api/v1/projects/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteProject(request, reply)
    );

    // 2. Project Milestone CRUD
    fastify.get(
      '/api/v1/projects/:projectId/milestones',
      { preHandler: [authHook] },
      async (request, reply) => controller.listMilestones(request, reply)
    );

    fastify.post(
      '/api/v1/projects/:projectId/milestones',
      { preHandler: [authHook] },
      async (request, reply) => controller.createMilestone(request, reply)
    );

    fastify.patch(
      '/api/v1/projects/:projectId/milestones/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateMilestone(request, reply)
    );

    fastify.delete(
      '/api/v1/projects/:projectId/milestones/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteMilestone(request, reply)
    );

    // 3. Repository Linking
    fastify.post(
      '/api/v1/projects/:id/link-repository',
      { preHandler: [authHook] },
      async (request, reply) => controller.linkRepository(request, reply)
    );

    // 4. Goal Linking
    fastify.get(
      '/api/v1/projects/:id/goals',
      { preHandler: [authHook] },
      async (request, reply) => controller.listGoals(request, reply)
    );

    fastify.post(
      '/api/v1/projects/:id/goals',
      { preHandler: [authHook] },
      async (request, reply) => controller.attachGoal(request, reply)
    );

    fastify.patch(
      '/api/v1/projects/:id/goals/:goalId',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateGoal(request, reply)
    );

    fastify.delete(
      '/api/v1/projects/:id/goals/:goalId',
      { preHandler: [authHook] },
      async (request, reply) => controller.detachGoal(request, reply)
    );

    // 5. Skill Linking
    fastify.get(
      '/api/v1/projects/:id/skills',
      { preHandler: [authHook] },
      async (request, reply) => controller.listSkills(request, reply)
    );

    fastify.post(
      '/api/v1/projects/:id/skills',
      { preHandler: [authHook] },
      async (request, reply) => controller.attachSkill(request, reply)
    );

    fastify.patch(
      '/api/v1/projects/:id/skills/:skillId',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateSkill(request, reply)
    );

    fastify.delete(
      '/api/v1/projects/:id/skills/:skillId',
      { preHandler: [authHook] },
      async (request, reply) => controller.detachSkill(request, reply)
    );

    // 6. Project Activities
    fastify.get(
      '/api/v1/projects/:id/activities',
      { preHandler: [authHook] },
      async (request, reply) => controller.getActivities(request, reply)
    );

    // 7. Project & Milestone Tasks Queries
    fastify.get(
      '/api/v1/projects/:id/tasks',
      { preHandler: [authHook] },
      async (request, reply) => controller.listProjectTasks(request, reply)
    );

    fastify.get(
      '/api/v1/projects/:projectId/milestones/:id/tasks',
      { preHandler: [authHook] },
      async (request, reply) => controller.listMilestoneTasks(request, reply)
    );
  };
}

export const projectsRoutes = createProjectsRoutes();
