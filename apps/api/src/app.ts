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
import { evidenceRoutes } from './modules/evidence/evidence.routes';
import { intelligenceRoutes } from './modules/intelligence/intelligence.routes';
import { academicsRoutes } from './modules/academics/academics.routes';
import { skillsRoutes } from './modules/skills/skills.routes';
import { dsaRoutes } from './modules/dsa/dsa.routes';

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
      // DEBUG: log exact origin bytes to diagnose CORS mismatch
      app.log.warn({ corsOrigin: origin, corsOriginBytes: origin ? [...origin].map((c) => c.charCodeAt(0)) : [] }, 'CORS origin check');

      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      // Also allow 'null' opaque origins — Chrome sends this for localhost in some dev modes
      if (!origin || origin === 'null') return cb(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        (allowedOrigins.includes('http://localhost:3000') && origin === 'http://127.0.0.1:3000');

      if (isAllowed) {
        return cb(null, true);
      }
      app.log.error({ rejectedOrigin: origin, allowedOrigins }, 'CORS rejected origin');
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

  // Register evidence domain routes
  app.register(evidenceRoutes);

  // Register intelligence next-action routes
  app.register(intelligenceRoutes);

  // Register academics domain routes
  app.register(academicsRoutes);

  // Register skills domain routes
  app.register(skillsRoutes);

  // Register DSA domain routes
  app.register(dsaRoutes);

  return app;
}

