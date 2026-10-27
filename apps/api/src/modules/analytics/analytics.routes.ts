import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { defaultAnalyticsController, AnalyticsController } from './analytics.controller';

export interface AnalyticsRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  analyticsController?: AnalyticsController;
}

export function createAnalyticsRoutes(opts: AnalyticsRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;
  const controller = opts.analyticsController || defaultAnalyticsController;

  return async (fastify) => {
    fastify.get(
      '/api/v1/analytics/summary',
      { preHandler: [authHook] },
      async (request, reply) => controller.getSummary(request, reply)
    );
  };
}

export const analyticsRoutes: FastifyPluginAsync = createAnalyticsRoutes();
