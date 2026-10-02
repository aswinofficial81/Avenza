import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { defaultGoalsController, GoalsController } from './goals.controller';

export interface GoalsRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  goalsController?: GoalsController;
}

export function createGoalsRoutes(opts: GoalsRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;
  const controller = opts.goalsController || defaultGoalsController;

  return async (fastify) => {
    // 1. Goal Routes
    fastify.get(
      '/api/v1/goals',
      { preHandler: [authHook] },
      async (request, reply) => controller.listGoals(request, reply)
    );

    fastify.post(
      '/api/v1/goals',
      { preHandler: [authHook] },
      async (request, reply) => controller.createGoal(request, reply)
    );

    fastify.get(
      '/api/v1/goals/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getGoal(request, reply)
    );

    fastify.patch(
      '/api/v1/goals/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateGoal(request, reply)
    );

    fastify.delete(
      '/api/v1/goals/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteGoal(request, reply)
    );

    // 2. Milestone Routes
    fastify.get(
      '/api/v1/goals/:goalId/milestones',
      { preHandler: [authHook] },
      async (request, reply) => controller.listMilestones(request, reply)
    );

    fastify.post(
      '/api/v1/goals/:goalId/milestones',
      { preHandler: [authHook] },
      async (request, reply) => controller.createMilestone(request, reply)
    );

    fastify.patch(
      '/api/v1/goals/:goalId/milestones/:milestoneId',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateMilestone(request, reply)
    );

    fastify.delete(
      '/api/v1/goals/:goalId/milestones/:milestoneId',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteMilestone(request, reply)
    );
  };
}

export const goalsRoutes = createGoalsRoutes();
