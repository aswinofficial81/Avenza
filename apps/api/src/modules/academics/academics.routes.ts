import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { AcademicsController } from './academics.controller';
import { AcademicsService } from './academics.service';
import { SupabaseAcademicsRepository } from './academics.repository';

export interface AcademicsRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  academicsController?: AcademicsController;
}

export function createAcademicsRoutes(opts: AcademicsRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;

  return async (fastify) => {
    const controller =
      opts.academicsController ||
      (() => {
        const repo = new SupabaseAcademicsRepository();
        const service = new AcademicsService(repo);
        return new AcademicsController(service);
      })();

    // --- Overview ---
    fastify.get(
      '/api/v1/academics/overview',
      { preHandler: [authHook] },
      async (request, reply) => controller.getAcademicsOverview(request, reply)
    );

    // --- Academic Years ---
    fastify.post(
      '/api/v1/academic-years',
      { preHandler: [authHook] },
      async (request, reply) => controller.createAcademicYear(request, reply)
    );
    fastify.get(
      '/api/v1/academic-years',
      { preHandler: [authHook] },
      async (request, reply) => controller.getAcademicYears(request, reply)
    );
    fastify.get(
      '/api/v1/academic-years/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getAcademicYearById(request, reply)
    );
    fastify.patch(
      '/api/v1/academic-years/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateAcademicYear(request, reply)
    );
    fastify.delete(
      '/api/v1/academic-years/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteAcademicYear(request, reply)
    );

    // --- Terms ---
    fastify.post(
      '/api/v1/terms',
      { preHandler: [authHook] },
      async (request, reply) => controller.createTerm(request, reply)
    );
    fastify.get(
      '/api/v1/terms',
      { preHandler: [authHook] },
      async (request, reply) => controller.getTerms(request, reply)
    );
    fastify.get(
      '/api/v1/terms/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getTermById(request, reply)
    );
    fastify.patch(
      '/api/v1/terms/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateTerm(request, reply)
    );
    fastify.delete(
      '/api/v1/terms/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteTerm(request, reply)
    );

    // --- Subjects ---
    fastify.post(
      '/api/v1/subjects',
      { preHandler: [authHook] },
      async (request, reply) => controller.createSubject(request, reply)
    );
    fastify.get(
      '/api/v1/subjects',
      { preHandler: [authHook] },
      async (request, reply) => controller.getSubjects(request, reply)
    );
    fastify.get(
      '/api/v1/subjects/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getSubjectById(request, reply)
    );
    fastify.get(
      '/api/v1/subjects/:id/bundle',
      { preHandler: [authHook] },
      async (request, reply) => controller.getSubjectBundle(request, reply)
    );
    fastify.patch(
      '/api/v1/subjects/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateSubject(request, reply)
    );
    fastify.delete(
      '/api/v1/subjects/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteSubject(request, reply)
    );

    // --- Topics ---
    fastify.post(
      '/api/v1/subjects/:subjectId/topics',
      { preHandler: [authHook] },
      async (request, reply) => controller.createTopic(request, reply)
    );
    fastify.get(
      '/api/v1/subjects/:subjectId/topics',
      { preHandler: [authHook] },
      async (request, reply) => controller.getTopicsBySubjectId(request, reply)
    );
    fastify.get(
      '/api/v1/topics/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getTopicById(request, reply)
    );
    fastify.patch(
      '/api/v1/topics/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateTopic(request, reply)
    );
    fastify.delete(
      '/api/v1/topics/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteTopic(request, reply)
    );

    // --- Assessments ---
    fastify.post(
      '/api/v1/assessments',
      { preHandler: [authHook] },
      async (request, reply) => controller.createAssessment(request, reply)
    );
    fastify.get(
      '/api/v1/assessments',
      { preHandler: [authHook] },
      async (request, reply) => controller.getAssessments(request, reply)
    );
    fastify.get(
      '/api/v1/assessments/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getAssessmentById(request, reply)
    );
    fastify.patch(
      '/api/v1/assessments/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateAssessment(request, reply)
    );
    fastify.delete(
      '/api/v1/assessments/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteAssessment(request, reply)
    );

    // --- Exams ---
    fastify.post(
      '/api/v1/exams',
      { preHandler: [authHook] },
      async (request, reply) => controller.createExam(request, reply)
    );
    fastify.get(
      '/api/v1/exams',
      { preHandler: [authHook] },
      async (request, reply) => controller.getExams(request, reply)
    );
    fastify.get(
      '/api/v1/exams/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getExamById(request, reply)
    );
    fastify.patch(
      '/api/v1/exams/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateExam(request, reply)
    );
    fastify.delete(
      '/api/v1/exams/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteExam(request, reply)
    );
  };
}

export const academicsRoutes = createAcademicsRoutes();
