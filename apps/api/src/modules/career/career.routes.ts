import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { CareerController, defaultCareerController } from './career.controller';

export interface CareerRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  careerController?: CareerController;
}

export function createCareerRoutes(opts: CareerRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;
  const controller = opts.careerController || defaultCareerController;

  return async (fastify) => {
    // ==============================================================================
    // 1. Career Targets
    // ==============================================================================

    fastify.post(
      '/api/v1/career/targets',
      { preHandler: [authHook] },
      async (request, reply) => controller.createTarget(request, reply)
    );

    fastify.get(
      '/api/v1/career/targets',
      { preHandler: [authHook] },
      async (request, reply) => controller.listTargets(request, reply)
    );

    fastify.get(
      '/api/v1/career/targets/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getTarget(request, reply)
    );

    fastify.patch(
      '/api/v1/career/targets/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateTarget(request, reply)
    );

    fastify.delete(
      '/api/v1/career/targets/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteTarget(request, reply)
    );

    fastify.post(
      '/api/v1/career/targets/:id/primary',
      { preHandler: [authHook] },
      async (request, reply) => controller.setPrimaryTarget(request, reply)
    );

    fastify.delete(
      '/api/v1/career/targets/:id/primary',
      { preHandler: [authHook] },
      async (request, reply) => controller.unsetPrimaryTarget(request, reply)
    );

    // ==============================================================================
    // 2. Career Target Skills
    // ==============================================================================

    fastify.get(
      '/api/v1/career/targets/:targetId/skills',
      { preHandler: [authHook] },
      async (request, reply) => controller.listTargetSkills(request, reply)
    );

    fastify.post(
      '/api/v1/career/targets/:targetId/skills',
      { preHandler: [authHook] },
      async (request, reply) => controller.addTargetSkill(request, reply)
    );

    fastify.patch(
      '/api/v1/career/targets/:targetId/skills/:skillId',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateTargetSkill(request, reply)
    );

    fastify.delete(
      '/api/v1/career/targets/:targetId/skills/:skillId',
      { preHandler: [authHook] },
      async (request, reply) => controller.removeTargetSkill(request, reply)
    );

    // ==============================================================================
    // 3. Career Opportunities
    // ==============================================================================

    fastify.post(
      '/api/v1/career/opportunities',
      { preHandler: [authHook] },
      async (request, reply) => controller.createOpportunity(request, reply)
    );

    fastify.get(
      '/api/v1/career/opportunities',
      { preHandler: [authHook] },
      async (request, reply) => controller.listOpportunities(request, reply)
    );

    fastify.get(
      '/api/v1/career/opportunities/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getOpportunity(request, reply)
    );

    fastify.patch(
      '/api/v1/career/opportunities/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateOpportunity(request, reply)
    );

    fastify.delete(
      '/api/v1/career/opportunities/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteOpportunity(request, reply)
    );

    // ==============================================================================
    // 4. Career Opportunity Skills
    // ==============================================================================

    fastify.get(
      '/api/v1/career/opportunities/:opportunityId/skills',
      { preHandler: [authHook] },
      async (request, reply) => controller.listOpportunitySkills(request, reply)
    );

    fastify.post(
      '/api/v1/career/opportunities/:opportunityId/skills',
      { preHandler: [authHook] },
      async (request, reply) => controller.addOpportunitySkill(request, reply)
    );

    fastify.patch(
      '/api/v1/career/opportunities/:opportunityId/skills/:skillId',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateOpportunitySkill(request, reply)
    );

    fastify.delete(
      '/api/v1/career/opportunities/:opportunityId/skills/:skillId',
      { preHandler: [authHook] },
      async (request, reply) => controller.removeOpportunitySkill(request, reply)
    );

    // ==============================================================================
    // 5. Career Applications & State Machine
    // ==============================================================================

    fastify.post(
      '/api/v1/career/applications',
      { preHandler: [authHook] },
      async (request, reply) => controller.createApplication(request, reply)
    );

    fastify.get(
      '/api/v1/career/applications',
      { preHandler: [authHook] },
      async (request, reply) => controller.listApplications(request, reply)
    );

    fastify.get(
      '/api/v1/career/applications/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getApplication(request, reply)
    );

    fastify.patch(
      '/api/v1/career/applications/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateApplication(request, reply)
    );

    fastify.delete(
      '/api/v1/career/applications/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteApplication(request, reply)
    );

    fastify.get(
      '/api/v1/career/applications/:id/history',
      { preHandler: [authHook] },
      async (request, reply) => controller.listApplicationHistory(request, reply)
    );

    // Stage transition endpoint supporting both POST and PATCH
    fastify.post(
      '/api/v1/career/applications/:id/stage',
      { preHandler: [authHook] },
      async (request, reply) => controller.transitionStage(request, reply)
    );

    fastify.patch(
      '/api/v1/career/applications/:id/stage',
      { preHandler: [authHook] },
      async (request, reply) => controller.transitionStage(request, reply)
    );

    // Preparation & Readiness integration
    fastify.get(
      '/api/v1/career/applications/:id/preparation',
      { preHandler: [authHook] },
      async (request, reply) => controller.getApplicationPreparation(request, reply)
    );

    fastify.get(
      '/api/v1/career/applications/:id/tasks',
      { preHandler: [authHook] },
      async (request, reply) => controller.listApplicationTasks(request, reply)
    );

    // ==============================================================================
    // 6. Career Application Projects
    // ==============================================================================

    fastify.get(
      '/api/v1/career/applications/:applicationId/projects',
      { preHandler: [authHook] },
      async (request, reply) => controller.listApplicationProjects(request, reply)
    );

    fastify.post(
      '/api/v1/career/applications/:applicationId/projects',
      { preHandler: [authHook] },
      async (request, reply) => controller.attachApplicationProject(request, reply)
    );

    fastify.patch(
      '/api/v1/career/applications/:applicationId/projects/:projectId',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateApplicationProject(request, reply)
    );

    fastify.delete(
      '/api/v1/career/applications/:applicationId/projects/:projectId',
      { preHandler: [authHook] },
      async (request, reply) => controller.removeApplicationProject(request, reply)
    );

    // ==============================================================================
    // 7. Career Interviews
    // ==============================================================================

    fastify.post(
      '/api/v1/career/applications/:applicationId/interviews',
      { preHandler: [authHook] },
      async (request, reply) => controller.createInterview(request, reply)
    );

    fastify.get(
      '/api/v1/career/applications/:applicationId/interviews',
      { preHandler: [authHook] },
      async (request, reply) => controller.listApplicationInterviews(request, reply)
    );

    fastify.get(
      '/api/v1/career/interviews',
      { preHandler: [authHook] },
      async (request, reply) => controller.listInterviews(request, reply)
    );

    fastify.get(
      '/api/v1/career/interviews/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getInterview(request, reply)
    );

    fastify.patch(
      '/api/v1/career/interviews/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateInterview(request, reply)
    );

    fastify.delete(
      '/api/v1/career/interviews/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteInterview(request, reply)
    );
  };
}

export const careerRoutes = createCareerRoutes();
