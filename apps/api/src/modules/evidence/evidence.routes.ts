import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { SupabaseEvidenceRepository } from './evidence.repository';
import { SupabaseGoalsRepository } from '../goals/goals.repository';
import { SupabaseTasksRepository } from '../tasks/tasks.repository';
import { SupabaseFocusRepository } from '../focus/focus.repository';

export interface EvidenceRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  evidenceController?: EvidenceController;
}

export function createEvidenceRoutes(opts: EvidenceRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;

  return async (fastify) => {
    const controller =
      opts.evidenceController ||
      (() => {
        const evidenceRepo = new SupabaseEvidenceRepository();
        const goalsRepo = new SupabaseGoalsRepository();
        const tasksRepo = new SupabaseTasksRepository();
        const focusRepo = new SupabaseFocusRepository();
        const service = new EvidenceService(evidenceRepo, tasksRepo, goalsRepo, focusRepo);
        return new EvidenceController(service);
      })();

    // POST /api/v1/evidence — Create manual evidence
    fastify.post(
      '/api/v1/evidence',
      { preHandler: [authHook] },
      async (request, reply) => controller.createEvidence(request, reply)
    );

    // GET /api/v1/evidence — List evidence with optional filters
    fastify.get(
      '/api/v1/evidence',
      { preHandler: [authHook] },
      async (request, reply) => controller.getEvidence(request, reply)
    );

    // GET /api/v1/evidence/:id — Get single evidence item
    fastify.get(
      '/api/v1/evidence/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getEvidenceById(request, reply)
    );

    // PATCH /api/v1/evidence/:id — Update evidence
    fastify.patch(
      '/api/v1/evidence/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateEvidence(request, reply)
    );

    // DELETE /api/v1/evidence/:id — Delete evidence
    fastify.delete(
      '/api/v1/evidence/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteEvidence(request, reply)
    );

    // POST /api/v1/evidence/from-focus-session/:sessionId — Record evidence from a completed focus session
    fastify.post(
      '/api/v1/evidence/from-focus-session/:sessionId',
      { preHandler: [authHook] },
      async (request, reply) => controller.recordFocusSessionEvidence(request, reply)
    );
  };
}

export const evidenceRoutes: FastifyPluginAsync = createEvidenceRoutes();
