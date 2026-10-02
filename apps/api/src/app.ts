import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { registerErrorHandler } from './plugins/error-handler';
import { healthRoutes } from './routes/health/health.routes';
import { profileRoutes } from './modules/identity/profile.routes';
import { goalsRoutes } from './modules/goals/goals.routes';
import { tasksRoutes } from './modules/tasks/tasks.routes';
import { todayRoutes } from './modules/today/today.routes';
import { focusRoutes } from './modules/focus/focus.routes';

export function buildApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const app = fastify({
    requestIdHeader: 'x-request-id',
    logger: {
      level: process.env['NODE_ENV'] === 'test' ? 'silent' : 'info',
    },
    ...opts,
  });

  // CORS configuration for local development
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

  app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return cb(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        (allowedOrigins.includes('http://localhost:3000') && origin === 'http://127.0.0.1:3000');

      if (isAllowed) {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'), false);
    },
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

  // Register goals domain routes
  app.register(goalsRoutes);

  // Register tasks domain routes
  app.register(tasksRoutes);

  // Register today execution routes
  app.register(todayRoutes);

  // Register focus session routes
  app.register(focusRoutes);

  return app;
}

