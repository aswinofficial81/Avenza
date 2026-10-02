import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { defaultTodayController, TodayController } from './today.controller';

export interface TodayRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  todayController?: TodayController;
}

export function createTodayRoutes(opts: TodayRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;
  const controller = opts.todayController || defaultTodayController;

  return async (fastify) => {
    fastify.get(
      '/api/v1/today',
      { preHandler: [authHook] },
      async (request, reply) => controller.getToday(request, reply)
    );
  };
}

export const todayRoutes: FastifyPluginAsync = createTodayRoutes();
