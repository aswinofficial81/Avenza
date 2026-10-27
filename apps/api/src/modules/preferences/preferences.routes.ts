import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { PreferencesController, defaultPreferencesController } from './preferences.controller';

export interface PreferencesRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  preferencesController?: PreferencesController;
}

export function createPreferencesRoutes(opts: PreferencesRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;
  const controller = opts.preferencesController || defaultPreferencesController;

  return async (fastify) => {
    // GET /api/v1/preferences — fetch (or lazily create) the current user's preferences
    fastify.get(
      '/api/v1/preferences',
      { preHandler: [authHook] },
      async (request, reply) => controller.getPreferences(request, reply)
    );

    // PATCH /api/v1/preferences — partial-update the current user's preferences
    fastify.patch(
      '/api/v1/preferences',
      { preHandler: [authHook] },
      async (request, reply) => controller.updatePreferences(request, reply)
    );
  };
}

export const preferencesRoutes: FastifyPluginAsync = createPreferencesRoutes();
