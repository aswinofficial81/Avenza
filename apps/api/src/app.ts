import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { registerErrorHandler } from './plugins/error-handler';
import { healthRoutes } from './routes/health/health.routes';
import { profileRoutes } from './modules/identity/profile.routes';
import { webhooksRoutes } from './modules/identity/webhooks.routes';
import { goalsRoutes } from './modules/goals/goals.routes';
import { tasksRoutes } from './modules/tasks/tasks.routes';
import { todayRoutes } from './modules/today/today.routes';
import { focusRoutes } from './modules/focus/focus.routes';
import { evidenceRoutes } from './modules/evidence/evidence.routes';
import { intelligenceRoutes } from './modules/intelligence/intelligence.routes';
import { academicsRoutes } from './modules/academics/academics.routes';
import { skillsRoutes } from './modules/skills/skills.routes';
import { dsaRoutes } from './modules/dsa/dsa.routes';
import { integrationsRoutes } from './modules/integrations/integrations.routes';
import { projectsRoutes } from './modules/projects/projects.routes';
import { careerRoutes } from './modules/career/career.routes';
import { plannerRoutes } from './modules/planner/planner.routes';
import { analyticsRoutes } from './modules/analytics/analytics.routes';
import { weeklyReviewRoutes } from './modules/weekly-review/weekly-review.routes';

export function buildApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const app = fastify({
    requestIdHeader: 'x-request-id',
    logger: {
      level: process.env['NODE_ENV'] === 'test' ? 'silent' : 'info',
    },
    ...opts,
  });

  // CORS configuration for local development
  const configuredOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  const allowedOrigins = Array.from(
    new Set([
      ...configuredOrigins,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://[::1]:3000',
      'http://[::1]:3001',
    ])
  );

  app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      // Also allow 'null' opaque origins — Chrome sends this for localhost in some dev modes
      if (!origin || origin === 'null') return cb(null, true);

      if (allowedOrigins.includes(origin)) {
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

  // Gracefully handle empty body with application/json without throwing FST_ERR_CTP_EMPTY_JSON_BODY
  // Also preserve rawBody on request for webhook signature verification
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body: string | Buffer, done) => {
      const str = typeof body === 'string' ? body : body?.toString('utf8') || '';
      req.rawBody = str;
      if (!str || str.trim() === '') {
        done(null, {});
        return;
      }
      try {
        const json = JSON.parse(str);
        done(null, json);
      } catch (err: unknown) {
        done(err as Error, undefined);
      }
    }
  );

  // Register foundational public routes
  app.register(healthRoutes);

  // Register identity & authentication routes
  app.register(profileRoutes);
  app.register(webhooksRoutes);

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

  // Register external integrations routes
  app.register(integrationsRoutes);

  // Register projects domain routes
  app.register(projectsRoutes);

  // Register career domain routes
  app.register(careerRoutes);

  // Register adaptive planner routes
  app.register(plannerRoutes);

  // Register analytics routes
  app.register(analyticsRoutes);
  app.register(weeklyReviewRoutes);

  return app;
}

