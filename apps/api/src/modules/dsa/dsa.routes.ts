import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { DsaController } from './dsa.controller';
import { DsaRepositoryImpl } from './dsa.repository.impl';
import { DsaServiceImpl } from './dsa.service.impl';

export interface DsaRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  dsaController?: DsaController;
}

export function createDsaRoutes(opts: DsaRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;

  return async (fastify) => {
    const controller =
      opts.dsaController ||
      (() => {
        const repository = new DsaRepositoryImpl();
        const service = new DsaServiceImpl(repository);
        return new DsaController(service);
      })();

    // Problem routes
    fastify.post(
      '/api/v1/dsa/problems',
      { preHandler: [authHook] },
      async (request, reply) => controller.createProblem(request, reply)
    );

    fastify.get(
      '/api/v1/dsa/problems',
      { preHandler: [authHook] },
      async (request, reply) => controller.listProblems(request, reply)
    );

    fastify.get(
      '/api/v1/dsa/problems/:problemId',
      { preHandler: [authHook] },
      async (request, reply) => controller.getProblem(request, reply)
    );

    fastify.get(
      '/api/v1/dsa/problems/:problemId/detail',
      { preHandler: [authHook] },
      async (request, reply) => controller.getProblemDetail(request, reply)
    );

    fastify.patch(
      '/api/v1/dsa/problems/:problemId',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateProblem(request, reply)
    );

    fastify.delete(
      '/api/v1/dsa/problems/:problemId',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteProblem(request, reply)
    );

    fastify.post(
      '/api/v1/dsa/problems/:problemId/archive',
      { preHandler: [authHook] },
      async (request, reply) => controller.archiveProblem(request, reply)
    );

    // Attempt routes
    fastify.post(
      '/api/v1/dsa/problems/:problemId/attempts',
      { preHandler: [authHook] },
      async (request, reply) => controller.createAttempt(request, reply)
    );

    fastify.get(
      '/api/v1/dsa/problems/:problemId/attempts',
      { preHandler: [authHook] },
      async (request, reply) => controller.listAttemptsByProblem(request, reply)
    );

    fastify.get(
      '/api/v1/dsa/attempts/:attemptId',
      { preHandler: [authHook] },
      async (request, reply) => controller.getAttempt(request, reply)
    );

    fastify.patch(
      '/api/v1/dsa/attempts/:attemptId',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateAttempt(request, reply)
    );

    // Topic routes
    fastify.post(
      '/api/v1/dsa/topics',
      { preHandler: [authHook] },
      async (request, reply) => controller.createTopic(request, reply)
    );

    fastify.get(
      '/api/v1/dsa/topics',
      { preHandler: [authHook] },
      async (request, reply) => controller.listTopics(request, reply)
    );

    fastify.get(
      '/api/v1/dsa/topics/:topicId',
      { preHandler: [authHook] },
      async (request, reply) => controller.getTopic(request, reply)
    );

    fastify.patch(
      '/api/v1/dsa/topics/:topicId',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateTopic(request, reply)
    );

    fastify.delete(
      '/api/v1/dsa/topics/:topicId',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteTopic(request, reply)
    );

    fastify.post(
      '/api/v1/dsa/topics/:topicId/archive',
      { preHandler: [authHook] },
      async (request, reply) => controller.archiveTopic(request, reply)
    );

    // Problem-Topic relationships
    fastify.post(
      '/api/v1/dsa/problems/:problemId/topics',
      { preHandler: [authHook] },
      async (request, reply) => controller.linkProblemTopic(request, reply)
    );

    fastify.delete(
      '/api/v1/dsa/problems/:problemId/topics/:topicId',
      { preHandler: [authHook] },
      async (request, reply) => controller.unlinkProblemTopic(request, reply)
    );

    // Problem-Skill relationships
    fastify.post(
      '/api/v1/dsa/problems/:problemId/skills',
      { preHandler: [authHook] },
      async (request, reply) => controller.linkProblemSkill(request, reply)
    );

    fastify.delete(
      '/api/v1/dsa/problems/:problemId/skills/:skillId',
      { preHandler: [authHook] },
      async (request, reply) => controller.unlinkProblemSkill(request, reply)
    );

    // Problem-Goal relationships
    fastify.post(
      '/api/v1/dsa/problems/:problemId/goals',
      { preHandler: [authHook] },
      async (request, reply) => controller.linkProblemGoal(request, reply)
    );

    fastify.delete(
      '/api/v1/dsa/problems/:problemId/goals/:goalId',
      { preHandler: [authHook] },
      async (request, reply) => controller.unlinkProblemGoal(request, reply)
    );

    // Problem-Task relationships
    fastify.post(
      '/api/v1/dsa/problems/:problemId/tasks',
      { preHandler: [authHook] },
      async (request, reply) => controller.linkProblemTask(request, reply)
    );

    fastify.delete(
      '/api/v1/dsa/problems/:problemId/tasks/:taskId',
      { preHandler: [authHook] },
      async (request, reply) => controller.unlinkProblemTask(request, reply)
    );

    // Overview and analytics
    fastify.get(
      '/api/v1/dsa/overview',
      { preHandler: [authHook] },
      async (request, reply) => controller.getOverview(request, reply)
    );
  };
}

export const dsaRoutes: FastifyPluginAsync = createDsaRoutes();