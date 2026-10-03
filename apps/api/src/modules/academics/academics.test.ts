import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerErrorHandler } from '../../plugins/error-handler';
import { AcademicsController } from './academics.controller';
import { InMemoryAcademicsRepository } from './academics.repository';
import { createAcademicsRoutes } from './academics.routes';
import { AcademicsService } from './academics.service';
import type { requireAuth } from '../../auth/auth.middleware';

describe('Academics Domain & API Routes (/api/v1/...)', () => {
  let app: FastifyInstance;
  let repo: InMemoryAcademicsRepository;
  let service: AcademicsService;
  let controller: AcademicsController;

  const mockUserA = { profileId: 'user-a-uuid', clerkUserId: 'clerk_user_a' };
  const mockUserB = { profileId: 'user-b-uuid', clerkUserId: 'clerk_user_b' };
  let currentAuthUser: { profileId: string; clerkUserId: string } | null = mockUserA;

  const mockAuthMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!currentAuthUser) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      });
    }
    request.auth = { profileId: currentAuthUser.profileId, clerkUserId: currentAuthUser.clerkUserId };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    request.profile = { id: currentAuthUser.profileId } as any;
  };

  beforeAll(async () => {
    app = fastify({ logger: false });
    registerErrorHandler(app);

    repo = new InMemoryAcademicsRepository();
    service = new AcademicsService(repo);
    controller = new AcademicsController(service);

    const routes = createAcademicsRoutes({
      requireAuthMiddleware: mockAuthMiddleware as unknown as typeof requireAuth,
      academicsController: controller,
    });
    await app.register(routes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    currentAuthUser = null;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/terms',
    });
    expect(res.statusCode).toBe(401);
  });

  it('manages Academic Years with date validation', async () => {
    currentAuthUser = mockUserA;

    // Create Academic Year
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/academic-years',
      payload: {
        name: '2026-2027',
        start_date: '2026-08-01',
        end_date: '2027-05-31',
        is_current: true,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const year = createRes.json().data;
    expect(year.name).toBe('2026-2027');
    expect(year.is_current).toBe(true);

    // List Academic Years
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/academic-years',
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().data.length).toBe(1);

    // Reject invalid date range
    const invalidRes = await app.inject({
      method: 'POST',
      url: '/api/v1/academic-years',
      payload: {
        name: 'Invalid Year',
        start_date: '2027-08-01',
        end_date: '2026-05-31',
      },
    });
    expect(invalidRes.statusCode).toBe(400);
  });

  it('manages Terms as the primary academic container', async () => {
    currentAuthUser = mockUserA;

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/terms',
      payload: {
        name: 'Fall 2026',
        code: 'FA26',
        start_date: '2026-08-15',
        end_date: '2026-12-15',
        status: 'active',
        is_current: true,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const term = createRes.json().data;
    expect(term.name).toBe('Fall 2026');
    expect(term.status).toBe('active');

    // Get Term by ID
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/terms/${term.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().data.name).toBe('Fall 2026');
  });

  it('manages Subjects belonging to a Term', async () => {
    currentAuthUser = mockUserA;
    const term = repo.terms[0]!;

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/subjects',
      payload: {
        term_id: term.id,
        name: 'Distributed Systems',
        code: 'CS602',
        instructor: 'Dr. Lamport',
        credits: 4.0,
        status: 'active',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const subject = createRes.json().data;
    expect(subject.name).toBe('Distributed Systems');
    expect(subject.credits).toBe(4.0);

    // List subjects
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/subjects?termId=${term.id}`,
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().data.length).toBe(1);
  });

  it('manages Topics with deterministic ordering and coverage states', async () => {
    currentAuthUser = mockUserA;
    const subject = repo.subjects[0]!;

    // Add 3 topics with different coverage states
    const t1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/subjects/${subject.id}/topics`,
      payload: {
        name: 'Chandy-Lamport Snapshots',
        order_index: 1,
        status: 'covered',
        importance: 'high',
        estimated_minutes: 120,
      },
    });
    expect(t1Res.statusCode).toBe(201);

    const t2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/subjects/${subject.id}/topics`,
      payload: {
        name: 'Raft Consensus',
        order_index: 2,
        status: 'in_progress',
        importance: 'critical',
        estimated_minutes: 180,
      },
    });
    expect(t2Res.statusCode).toBe(201);

    const t3Res = await app.inject({
      method: 'POST',
      url: `/api/v1/subjects/${subject.id}/topics`,
      payload: {
        name: 'Byzantine Fault Tolerance',
        order_index: 3,
        status: 'not_started',
        importance: 'medium',
        estimated_minutes: 150,
      },
    });
    expect(t3Res.statusCode).toBe(201);

    // Verify Subject Detail Bundle computes syllabus coverage accurately (1 of 3 covered = 33%)
    const bundleRes = await app.inject({
      method: 'GET',
      url: `/api/v1/subjects/${subject.id}/bundle`,
    });
    expect(bundleRes.statusCode).toBe(200);
    const bundle = bundleRes.json().data;
    expect(bundle.topics.length).toBe(3);
    expect(bundle.subject.coverage.total_topics).toBe(3);
    expect(bundle.subject.coverage.covered_topics).toBe(1);
    expect(bundle.subject.coverage.in_progress_topics).toBe(1);
    expect(bundle.subject.coverage.not_started_topics).toBe(1);
    expect(bundle.subject.coverage.coverage_percentage).toBe(33);
  });

  it('manages Assessments with marks and weight validation', async () => {
    currentAuthUser = mockUserA;
    const term = repo.terms[0]!;
    const subject = repo.subjects[0]!;
    const topic = repo.topics[0]!;

    // Valid assessment
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/assessments',
      payload: {
        term_id: term.id,
        subject_id: subject.id,
        title: 'Raft Implementation Lab',
        assessment_type: 'lab',
        max_marks: 100,
        obtained_marks: 95,
        weight_percent: 25,
        status: 'submitted',
        topic_ids: [topic.id],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const asmt = createRes.json().data;
    expect(asmt.title).toBe('Raft Implementation Lab');
    expect(asmt.obtained_marks).toBe(95);

    // Invalid marks: obtained > max
    const invalidMarks = await app.inject({
      method: 'POST',
      url: '/api/v1/assessments',
      payload: {
        term_id: term.id,
        subject_id: subject.id,
        title: 'Faulty Quiz',
        assessment_type: 'quiz',
        max_marks: 20,
        obtained_marks: 25,
      },
    });
    expect(invalidMarks.statusCode).toBe(400);
  });

  it('manages Exams with date/time and duration', async () => {
    currentAuthUser = mockUserA;
    const term = repo.terms[0]!;
    const subject = repo.subjects[0]!;
    const topic = repo.topics[0]!;

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/exams',
      payload: {
        term_id: term.id,
        subject_id: subject.id,
        title: 'Distributed Systems Midterm',
        exam_type: 'midterm',
        exam_date: '2026-10-25T14:00:00Z',
        duration_minutes: 120,
        location: 'Hall B',
        weight_percent: 30,
        status: 'planned',
        topic_ids: [topic.id],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const exam = createRes.json().data;
    expect(exam.title).toBe('Distributed Systems Midterm');
    expect(exam.duration_minutes).toBe(120);
  });

  it('generates the Academics Overview answering the core questions', async () => {
    currentAuthUser = mockUserA;

    const overviewRes = await app.inject({
      method: 'GET',
      url: '/api/v1/academics/overview',
    });
    expect(overviewRes.statusCode).toBe(200);
    const overview = overviewRes.json().data;

    // 1. What term am I in?
    expect(overview.active_term).toBeDefined();
    expect(overview.active_term.name).toBe('Fall 2026');

    // 2. What subjects am I taking?
    expect(overview.subjects.length).toBeGreaterThan(0);
    expect(overview.subjects[0].name).toBe('Distributed Systems');

    // 3. What exams are upcoming?
    expect(overview.upcoming_exams.length).toBeGreaterThan(0);
    expect(overview.upcoming_exams[0].title).toBe('Distributed Systems Midterm');

    // 4. What assessments are due?
    expect(overview.upcoming_assessments.length).toBeGreaterThan(0);
    expect(overview.upcoming_assessments[0].title).toBe('Raft Implementation Lab');

    // 5. How much syllabus is covered?
    expect(overview.overall_coverage).toBeDefined();
    expect(overview.overall_coverage.total_topics).toBe(3);
    expect(overview.overall_coverage.covered_topics).toBe(1);
    expect(overview.overall_coverage.coverage_percentage).toBe(33);
  });

  it('enforces cross-user ownership isolation in the service layer', async () => {
    currentAuthUser = mockUserA;
    const termA = repo.terms[0]!;

    // User B tries to create a subject inside User A's term
    currentAuthUser = mockUserB;
    const crossRes = await app.inject({
      method: 'POST',
      url: '/api/v1/subjects',
      payload: {
        term_id: termA.id,
        name: 'User B Subject in User A Term',
      },
    });
    expect(crossRes.statusCode).toBe(400);
    expect(crossRes.json().error.code).toBe('INVALID_TERM');
  });
});
