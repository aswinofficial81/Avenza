import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { registerErrorHandler } from './plugins/error-handler';
import { healthRoutes } from './routes/health/health.routes';
import { profileRoutes } from './modules/identity/profile.routes';

export function buildApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const app = fastify({
    requestIdHeader: 'x-request-id',
    logger: {
      level: process.env['NODE_ENV'] === 'test' ? 'silent' : 'info',
    },
    ...opts,
  });

  // CORS configuration for local development
  app.register(cors, {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'x-request-id'],
    credentials: true,
  });

  // Attach Request-ID to all responses for distributed tracing
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  // Centralized Error Handling
  registerErrorHandler(app);

  // Register foundational public routes
  app.register(healthRoutes);

  // Register identity & authentication routes
  app.register(profileRoutes);

  return app;
}
