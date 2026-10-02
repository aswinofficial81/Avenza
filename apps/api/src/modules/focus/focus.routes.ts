import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { defaultFocusController, FocusController } from './focus.controller';

export interface FocusRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  focusController?: FocusController;
}

export function createFocusRoutes(opts: FocusRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;
  const controller = opts.focusController || defaultFocusController;

  return async (fastify) => {
    // POST /api/v1/focus-sessions
    fastify.post(
      '/api/v1/focus-sessions',
      { preHandler: [authHook] },
      async (request, reply) => controller.startSession(request, reply)
    );

    // GET /api/v1/focus-sessions/active
    fastify.get(
      '/api/v1/focus-sessions/active',
      { preHandler: [authHook] },
      async (request, reply) => controller.getActiveSession(request, reply)
    );

    // GET /api/v1/focus-sessions
    fastify.get(
      '/api/v1/focus-sessions',
      { preHandler: [authHook] },
      async (request, reply) => controller.listSessions(request, reply)
    );

    // GET /api/v1/focus-sessions/:id
    fastify.get(
      '/api/v1/focus-sessions/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getSessionById(request, reply)
    );

    // POST /api/v1/focus-sessions/:id/complete
    fastify.post(
      '/api/v1/focus-sessions/:id/complete',
      { preHandler: [authHook] },
      async (request, reply) => controller.completeSession(request, reply)
    );

    // POST /api/v1/focus-sessions/:id/cancel
    fastify.post(
      '/api/v1/focus-sessions/:id/cancel',
      { preHandler: [authHook] },
      async (request, reply) => controller.cancelSession(request, reply)
    );
  };
}

export const focusRoutes: FastifyPluginAsync = createFocusRoutes();
