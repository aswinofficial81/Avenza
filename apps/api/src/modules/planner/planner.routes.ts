import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { PlannerController } from './planner.controller';

export interface PlannerRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  plannerController?: PlannerController;
}

export function createPlannerRoutes(opts: PlannerRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;
  const controller = opts.plannerController || new PlannerController();

  return async (fastify) => {
    fastify.post(
      '/api/v1/planner/propose',
      { preHandler: [authHook] },
      async (request, reply) => controller.proposeSchedule(request, reply)
    );

    fastify.post(
      '/api/v1/planner/apply',
      { preHandler: [authHook] },
      async (request, reply) => controller.applySchedule(request, reply)
    );
  };
}

export const plannerRoutes: FastifyPluginAsync = createPlannerRoutes();
