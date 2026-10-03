import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { IntelligenceController } from './intelligence.controller';
import { IntelligenceService } from './intelligence.service';

export interface IntelligenceRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  intelligenceController?: IntelligenceController;
}

export function createIntelligenceRoutes(
  opts: IntelligenceRoutesOptions = {}
): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;

  return async (fastify) => {
    const controller =
      opts.intelligenceController || new IntelligenceController(new IntelligenceService());

    // GET /api/v1/intelligence/next-action
    fastify.get(
      '/api/v1/intelligence/next-action',
      { preHandler: [authHook] },
      async (request, reply) => controller.getNextAction(request, reply)
    );
  };
}

export const intelligenceRoutes = createIntelligenceRoutes();
