import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { defaultProviderRegistry } from '../../infrastructure/providers/base/provider.registry';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsRepositoryImpl } from './integrations.repository.impl';
import { IntegrationsServiceImpl } from './integrations.service.impl';

export interface IntegrationsRoutesOptions {
  requireAuthMiddleware?: preHandlerHookHandler;
  integrationsController?: IntegrationsController;
}

export function createIntegrationsRoutes(opts: IntegrationsRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;

  return async (fastify) => {
    const controller =
      opts.integrationsController ||
      (() => {
        const repository = new IntegrationsRepositoryImpl();
        const service = new IntegrationsServiceImpl(repository, defaultProviderRegistry);
        return new IntegrationsController(service);
      })();

    // 1. List connections
    fastify.get(
      '/api/v1/integrations',
      { preHandler: [authHook] },
      async (request, reply) => controller.listConnections(request, reply)
    );

    // 2. Specific provider connection
    fastify.get<{ Params: { provider: string } }>(
      '/api/v1/integrations/:provider',
      { preHandler: [authHook] },
      async (request, reply) => controller.getConnection(request, reply)
    );

    // 3. Initiate OAuth
    fastify.post<{ Params: { provider: string }; Body?: { redirect_url?: string } }>(
      '/api/v1/integrations/:provider/connect',
      { preHandler: [authHook] },
      async (request, reply) => controller.connect(request, reply)
    );

    // 4. OAuth Callback
    fastify.get<{ Params: { provider: string }; Querystring: { code?: string; state?: string } }>(
      '/api/v1/integrations/:provider/callback',
      { preHandler: [authHook] },
      async (request, reply) => controller.callback(request, reply)
    );

    // 5. Trigger sync
    fastify.post<{ Params: { provider: string } }>(
      '/api/v1/integrations/:provider/sync',
      { preHandler: [authHook] },
      async (request, reply) => controller.sync(request, reply)
    );

    // 6. Disconnect
    fastify.post<{ Params: { provider: string } }>(
      '/api/v1/integrations/:provider/disconnect',
      { preHandler: [authHook] },
      async (request, reply) => controller.disconnect(request, reply)
    );

    // 7. Get status
    fastify.get<{ Params: { provider: string } }>(
      '/api/v1/integrations/:provider/status',
      { preHandler: [authHook] },
      async (request, reply) => controller.getStatus(request, reply)
    );

    // 8. Normalized repositories
    fastify.get<{ Params: { provider: string } }>(
      '/api/v1/integrations/:provider/repositories',
      { preHandler: [authHook] },
      async (request, reply) => controller.listRepositories(request, reply)
    );

    // 9. Normalized activities
    fastify.get<{ Params: { provider: string }; Querystring: { limit?: string } }>(
      '/api/v1/integrations/:provider/activities',
      { preHandler: [authHook] },
      async (request, reply) => controller.listActivities(request, reply)
    );

    // 10. Normalized calendar events
    fastify.get<{
      Params: { provider: string };
      Querystring: { calendar_id?: string; time_min?: string; time_max?: string };
    }>(
      '/api/v1/integrations/:provider/events',
      { preHandler: [authHook] },
      async (request, reply) => controller.listCalendarEvents(request, reply)
    );
  };
}

export const integrationsRoutes: FastifyPluginAsync = createIntegrationsRoutes();
