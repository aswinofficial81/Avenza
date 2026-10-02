import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { registerErrorHandler } from './plugins/error-handler';
import { healthRoutes } from './routes/health/health.routes';

export function buildApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const app = fastify({
    requestIdHeader: 'x-request-id',
    logger: {
      level: process.env['NODE_ENV'] === 'test' ? 'silent' : 'info',
    },
    ...opts,
  });

  // Attach Request-ID to all responses for distributed tracing
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  // Centralized Error Handling
  registerErrorHandler(app);

  // Register foundational routes
  app.register(healthRoutes);

  return app;
}
