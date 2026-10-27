import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { createCareerRoutes } from './career.routes';
import type { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { CareerController } from './career.controller';
import { CareerService } from './career.service';
import { InMemoryCareerRepository } from './career.repository.impl';
import { TasksService } from '../tasks/tasks.service';
import { InMemoryTasksRepository } from '../tasks/tasks.repository';

describe('Phase 16D: Career Relationships & Preparation Integration', () => {
  let app: FastifyInstance;
  let careerRepo: InMemoryCareerRepository;
  let careerService: CareerService;
  let careerController: CareerController;
  let tasksRepo: InMemoryTasksRepository;
  let tasksService: TasksService;

  const ALICE_ID = '00000000-0000-0000-0000-000000000001';
  const BOB_ID = '00000000-0000-0000-0000-000000000002';

  let currentUserId: string = ALICE_ID;

  beforeEach(async () => {
    currentUserId = ALICE_ID;
    careerRepo = new InMemoryCareerRepository();
    careerService = new CareerService(careerRepo);
    careerController = new CareerController(careerService);

    tasksRepo = new InMemoryTasksRepository();
    tasksService = new TasksService(tasksRepo);

    app = Fastify();

    // Authenticated profile middleware mock
    const mockAuthMiddleware = async (request: FastifyRequest) => {
      (request as unknown as { profile: { id: string } }).profile = { id: currentUserId };
    };

    const routes = createCareerRoutes({
      requireAuthMiddleware: mockAuthMiddleware as unknown as typeof defaultRequireAuth,
      careerController,
    });
    await app.register(routes);
    await app.ready();
  });

  // ============================================================================
  // 1. Career Targets <-> Goals
  // ============================================================================
  describe('1. Career Targets <-> Goals', () => {
    const GOAL_1_ID = '11111111-1111-4000-8000-000000000001';
    const BOB_GOAL_ID = '11111111-1111-4000-8000-000000000002';

    beforeEach(() => {
      careerRepo.goals = [
        { id: GOAL_1_ID, user_id: ALICE_ID, title: 'Become Staff Engineer' },
        { id: BOB_GOAL_ID, user_id: BOB_ID, title: "Bob's Goal" },
      ];
    });

    it('attaches an existing user-owned goal to a career target', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/career/targets',
        payload: {
          title: 'Senior Distributed Systems Engineer',
          target_role: 'Staff Engineer',
          goal_id: GOAL_1_ID,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json().data;
      expect(data.goal_id).toBe(GOAL_1_ID);
    });

    it('rejects attaching another user goal', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/career/targets',
        payload: {
          title: 'Senior Engineer',
          target_role: 'Staff Engineer',
          goal_id: BOB_GOAL_ID,
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    });

    it('allows updating a career target to detach its linked goal (goal_id = null)', async () => {
      const target = await careerRepo.createTarget(ALICE_ID, {
        title: 'Platform Lead',
        target_role: 'Lead',
        goal_id: GOAL_1_ID,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/career/targets/${target.id}`,
        payload: {
          goal_id: null,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.goal_id).toBeNull();
    });

    it('deleting a goal leaves the career target intact with goal_id = null (ON DELETE SET NULL)', async () => {
      const target = await careerRepo.createTarget(ALICE_ID, {
        title: 'Platform Lead',
        target_role: 'Lead',
        goal_id: GOAL_1_ID,
      });
      expect(target.goal_id).toBe(GOAL_1_ID);

      // Simulate goal deletion in goals domain
      const deleted = careerRepo.deleteGoal(GOAL_1_ID);
      expect(deleted).toBe(true);

      // Target remains intact
      const fetched = await careerRepo.getTargetById(ALICE_ID, target.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.goal_id).toBeNull();
      expect(fetched?.title).toBe('Platform Lead');
    });

    it('updating a career target never automatically modifies or completes its linked goal', async () => {
      const target = await careerRepo.createTarget(ALICE_ID, {
        title: 'Platform Lead',
        target_role: 'Lead',
        goal_id: GOAL_1_ID,
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/v1/career/targets/${target.id}`,
        payload: {
          title: 'Senior Platform Architect',
          notes: 'Target updated',
        },
      });

      const goal = careerRepo.goals.find((g) => g.id === GOAL_1_ID);
      expect(goal).toBeDefined();
      expect(goal?.title).toBe('Become Staff Engineer');
    });
  });

  // ============================================================================
  // 2. Career Targets & Opportunities <-> Skills
  // ============================================================================
  describe('2. Career Targets & Opportunities <-> Skills', () => {
    const SKILL_1 = '22222222-2222-4000-8000-000000000001';
    const SKILL_2 = '22222222-2222-4000-8000-000000000002';
    const BOB_SKILL = '22222222-2222-4000-8000-000000000003';

    let targetId: string;
    let oppId: string;

    beforeEach(async () => {
      careerRepo.skills = [
        {
          id: SKILL_1,
          user_id: ALICE_ID,
          name: 'Distributed Systems',
          slug: 'distributed-systems',
          category: 'backend',
          level: 'intermediate',
          mastery_score: 75,
          status: 'in_progress',
          verified: true,
        },
        {
          id: SKILL_2,
          user_id: ALICE_ID,
          name: 'Kubernetes',
          slug: 'kubernetes',
          category: 'devops',
          level: null,
          mastery_score: null,
          status: null,
          verified: false,
        },
        {
          id: BOB_SKILL,
          user_id: BOB_ID,
          name: 'Rust',
          slug: 'rust',
          category: 'backend',
        },
      ];

      const target = await careerRepo.createTarget(ALICE_ID, {
        title: 'Infrastructure Lead',
        target_role: 'Lead',
      });
      targetId = target.id;

      const opp = await careerRepo.createOpportunity(ALICE_ID, {
        company_name: 'Acme Corp',
        role_title: 'Infrastructure Engineer',
        source: 'referral',
        target_id: targetId,
      });
      oppId = opp.id;
    });

    it('attaches desired skills to target with importance values and tenant check', async () => {
      // 1. Required
      const res1 = await app.inject({
        method: 'POST',
        url: `/api/v1/career/targets/${targetId}/skills`,
        payload: { skill_id: SKILL_1, importance: 'required' },
      });
      expect(res1.statusCode).toBe(201);
      expect(res1.json().data.importance).toBe('required');
      expect(res1.json().data.skill_name).toBe('Distributed Systems');

      // 2. Reject cross-user skill
      const resBob = await app.inject({
        method: 'POST',
        url: `/api/v1/career/targets/${targetId}/skills`,
        payload: { skill_id: BOB_SKILL, importance: 'preferred' },
      });
      expect(resBob.statusCode).toBe(404);

      // 3. Preferred
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/career/targets/${targetId}/skills`,
        payload: { skill_id: SKILL_2, importance: 'preferred' },
      });
      expect(res2.statusCode).toBe(201);
      expect(res2.json().data.importance).toBe('preferred');

      // 4. Update importance
      const resUpdate = await app.inject({
        method: 'PATCH',
        url: `/api/v1/career/targets/${targetId}/skills/${SKILL_2}`,
        payload: { importance: 'bonus' },
      });
      expect(resUpdate.statusCode).toBe(200);
      expect(resUpdate.json().data.importance).toBe('bonus');

      // 5. Detach
      const resDetach = await app.inject({
        method: 'DELETE',
        url: `/api/v1/career/targets/${targetId}/skills/${SKILL_2}`,
      });
      expect(resDetach.statusCode).toBe(200);

      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/career/targets/${targetId}/skills`,
      });
      expect(listRes.json().data.length).toBe(1);
      expect(listRes.json().data[0].skill_id).toBe(SKILL_1);
    });

    it('attaches skill requirements to opportunity with importance values and tenant check', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/career/opportunities/${oppId}/skills`,
        payload: { skill_id: SKILL_1, importance: 'required' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.importance).toBe('required');

      // Reject Bob skill
      const resBob = await app.inject({
        method: 'POST',
        url: `/api/v1/career/opportunities/${oppId}/skills`,
        payload: { skill_id: BOB_SKILL, importance: 'required' },
      });
      expect(resBob.statusCode).toBe(404);

      // Update
      const resUpdate = await app.inject({
        method: 'PATCH',
        url: `/api/v1/career/opportunities/${oppId}/skills/${SKILL_1}`,
        payload: { importance: 'bonus' },
      });
      expect(resUpdate.statusCode).toBe(200);
      expect(resUpdate.json().data.importance).toBe('bonus');

      // Detach
      const resDelete = await app.inject({
        method: 'DELETE',
        url: `/api/v1/career/opportunities/${oppId}/skills/${SKILL_1}`,
      });
      expect(resDelete.statusCode).toBe(200);
    });

    it('career does not store or recalculate authoritative mastery, confidence, or verification', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/career/targets/${targetId}/skills`,
        payload: { skill_id: SKILL_1, importance: 'required' },
      });
      expect(res.statusCode).toBe(201);

      // Verify stored record has only importance, skill_id, target_id, user_id
      const stored = careerRepo.targetSkills.find((s) => s.target_id === targetId && s.skill_id === SKILL_1);
      expect(stored).toBeDefined();
      expect(stored?.importance).toBe('required');
      expect('mastery_score' in (stored ?? {})).toBe(false);
      expect('level' in (stored ?? {})).toBe(false);
    });
  });

  // ============================================================================
  // 3. Career Applications <-> Projects
  // ============================================================================
  describe('3. Career Applications <-> Projects', () => {
    const PROJ_1 = '33333333-3333-4000-8000-000000000001';
    const BOB_PROJ = '33333333-3333-4000-8000-000000000002';

    let appId: string;

    beforeEach(async () => {
      careerRepo.projects = [
        { id: PROJ_1, user_id: ALICE_ID, title: 'Consensus Engine', slug: 'consensus-engine', status: 'completed' },
        { id: BOB_PROJ, user_id: BOB_ID, title: "Bob's App", slug: 'bob-app', status: 'in_progress' },
      ];

      const target = await careerRepo.createTarget(ALICE_ID, {
        title: 'Distributed Systems Architect',
        target_role: 'Architect',
      });
      const opp = await careerRepo.createOpportunity(ALICE_ID, {
        company_name: 'Stripe',
        role_title: 'Staff Infrastructure Engineer',
        source: 'referral',
        target_id: target.id,
      });
      const appRecord = await careerRepo.createApplication(ALICE_ID, {
        opportunity_id: opp.id,
      });
      appId = appRecord.id;
    });

    it('attaches and updates project with is_featured and talking_points', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${appId}/projects`,
        payload: {
          project_id: PROJ_1,
          is_featured: true,
          talking_points: 'Led implementation of Raft consensus algorithm with sub-10ms failover.',
        },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json().data;
      expect(data.is_featured).toBe(true);
      expect(data.talking_points).toContain('Raft consensus');
      expect(data.project_title).toBe('Consensus Engine');

      // Update
      const resUpdate = await app.inject({
        method: 'PATCH',
        url: `/api/v1/career/applications/${appId}/projects/${PROJ_1}`,
        payload: {
          is_featured: false,
          talking_points: 'Updated talking points',
        },
      });
      expect(resUpdate.statusCode).toBe(200);
      expect(resUpdate.json().data.is_featured).toBe(false);
      expect(resUpdate.json().data.talking_points).toBe('Updated talking points');

      // Detach
      const resDetach = await app.inject({
        method: 'DELETE',
        url: `/api/v1/career/applications/${appId}/projects/${PROJ_1}`,
      });
      expect(resDetach.statusCode).toBe(200);
      expect(careerRepo.applicationProjects.length).toBe(0);
    });

    it('rejects cross-user project attachment', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${appId}/projects`,
        payload: {
          project_id: BOB_PROJ,
          is_featured: true,
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    });

    it('deleting an application removes its project links', async () => {
      await careerRepo.attachApplicationProject(ALICE_ID, appId, {
        project_id: PROJ_1,
        is_featured: true,
      });
      expect(careerRepo.applicationProjects.length).toBe(1);

      await careerRepo.deleteApplication(ALICE_ID, appId);
      expect(careerRepo.applicationProjects.length).toBe(0);
    });

    it('deleting a referenced Project respects ON DELETE RESTRICT', async () => {
      await careerRepo.attachApplicationProject(ALICE_ID, appId, {
        project_id: PROJ_1,
        is_featured: true,
      });

      expect(() => careerRepo.deleteProject(PROJ_1)).toThrow(/ON DELETE RESTRICT/);
    });
  });

  // ============================================================================
  // 4. Career Applications <-> Tasks
  // ============================================================================
  describe('4. Career Applications <-> Tasks', () => {
    let appId: string;

    beforeEach(async () => {
      const opp = await careerRepo.createOpportunity(ALICE_ID, {
        company_name: 'Datadog',
        role_title: 'SRE Lead',
        source: 'referral',
      });
      const appRecord = await careerRepo.createApplication(ALICE_ID, {
        opportunity_id: opp.id,
      });
      appId = appRecord.id;
    });

    it('allows creating tasks with application_id and queries them tenant-safely', async () => {
      const task = await tasksService.createTask(ALICE_ID, {
        title: 'Review System Design notes for Datadog',
        status: 'inbox',
        priority: 'high',
        task_type: 'career',
        application_id: appId,
      });

      expect(task.application_id).toBe(appId);

      // Filter tasks by application_id
      const list = await tasksService.listTasks({
        userId: ALICE_ID,
        application_id: appId,
      });
      expect(list.data.length).toBe(1);
      expect(list.data[0]?.id).toBe(task.id);

      // Bob cannot view Alice application tasks
      const bobList = await tasksService.listTasks({
        userId: BOB_ID,
        application_id: appId,
      });
      expect(bobList.data.length).toBe(0);
    });

    it('completing a linked task does NOT change application stage', async () => {
      const task = await tasksService.createTask(ALICE_ID, {
        title: 'Prepare behavioral stories',
        status: 'inbox',
        priority: 'medium',
        task_type: 'career',
        application_id: appId,
      });

      const appBefore = await careerRepo.getApplicationById(ALICE_ID, appId);
      expect(appBefore?.stage).toBe('saved');

      // Complete the task
      await tasksService.updateTask(task.id, ALICE_ID, {
        status: 'completed',
      });

      const appAfter = await careerRepo.getApplicationById(ALICE_ID, appId);
      expect(appAfter?.stage).toBe('saved');
    });

    it('changing application stage does NOT complete or mutate linked tasks', async () => {
      const task = await tasksService.createTask(ALICE_ID, {
        title: 'Send resume',
        status: 'inbox',
        priority: 'medium',
        task_type: 'career',
        application_id: appId,
      });

      // Transition application to submitted
      await careerService.transitionApplicationStage(ALICE_ID, appId, {
        stage: 'applied',
        notes: 'Submitted via portal',
      });

      const fetchedTask = await tasksService.getTaskById(task.id, ALICE_ID);
      expect(fetchedTask?.status).toBe('inbox');
      expect(fetchedTask?.completed_at).toBeNull();
    });

    it('deleting an application leaves tasks intact and sets application_id = null', async () => {
      const task = await tasksRepo.createTask({
        user_id: ALICE_ID,
        title: 'Follow up with recruiter',
        application_id: appId,
      });

      // Also register in careerRepo mock tasks
      careerRepo.tasks.push({
        id: task.id,
        user_id: ALICE_ID,
        application_id: appId,
        title: task.title,
        status: task.status,
        priority: task.priority,
      });

      await careerRepo.deleteApplication(ALICE_ID, appId);

      const taskInCareerRepo = careerRepo.tasks.find((t) => t.id === task.id);
      expect(taskInCareerRepo).toBeDefined();
      expect(taskInCareerRepo?.application_id).toBeNull();
    });
  });

  // ============================================================================
  // 5. Readiness & Preparation Summaries
  // ============================================================================
  describe('5. Readiness & Preparation Summaries', () => {
    const SKILL_REQ = '44444444-4444-4000-8000-000000000001';
    const SKILL_PREF = '44444444-4444-4000-8000-000000000002';
    const SKILL_BONUS = '44444444-4444-4000-8000-000000000003';
    const PROJ_ID = '55555555-5555-4000-8000-000000000001';
    const EVIDENCE_ID = '66666666-6666-4000-8000-000000000001';

    let appId: string;
    let targetId: string;
    let oppId: string;

    beforeEach(async () => {
      // 1. Setup Skills in Skills domain
      careerRepo.skills = [
        {
          id: SKILL_REQ,
          user_id: ALICE_ID,
          name: 'Distributed Tracing',
          slug: 'distributed-tracing',
          category: 'backend',
          level: 'advanced',
          mastery_score: 88,
          confidence_score: 90,
          status: 'mastered',
          verified: true,
        },
        {
          id: SKILL_PREF,
          user_id: ALICE_ID,
          name: 'eBPF',
          slug: 'ebpf',
          category: 'systems',
          level: null,
          mastery_score: null,
          confidence_score: null,
          status: null,
          verified: false,
        },
        {
          id: SKILL_BONUS,
          user_id: ALICE_ID,
          name: 'OpenTelemetry',
          slug: 'opentelemetry',
          category: 'observability',
          level: 'beginner',
          mastery_score: 40,
          confidence_score: 50,
          status: 'in_progress',
          verified: false,
        },
      ];

      // 2. Setup Target & Opportunity
      const target = await careerRepo.createTarget(ALICE_ID, {
        title: 'Observability Architect',
        target_role: 'Architect',
      });
      targetId = target.id;

      await careerRepo.addTargetSkill(ALICE_ID, targetId, {
        skill_id: SKILL_REQ,
        importance: 'required',
      });

      const opp = await careerRepo.createOpportunity(ALICE_ID, {
        company_name: 'Grafana Labs',
        role_title: 'Staff Observability Engineer',
        source: 'referral',
        target_id: targetId,
      });
      oppId = opp.id;

      await careerRepo.addOpportunitySkill(ALICE_ID, oppId, {
        skill_id: SKILL_PREF,
        importance: 'preferred',
      });
      await careerRepo.addOpportunitySkill(ALICE_ID, oppId, {
        skill_id: SKILL_BONUS,
        importance: 'bonus',
      });

      // 3. Application
      const appRecord = await careerRepo.createApplication(ALICE_ID, {
        opportunity_id: oppId,
      });
      appId = appRecord.id;

      // 4. Project and Evidence
      careerRepo.projects = [
        {
          id: PROJ_ID,
          user_id: ALICE_ID,
          title: 'Trace Collector',
          slug: 'trace-collector',
          status: 'completed',
        },
      ];
      await careerRepo.attachApplicationProject(ALICE_ID, appId, {
        project_id: PROJ_ID,
        is_featured: true,
        talking_points: 'Built high-throughput OTLP collector handling 50k spans/sec.',
      });

      careerRepo.evidence = [
        {
          id: EVIDENCE_ID,
          user_id: ALICE_ID,
          title: 'Trace Collector Benchmarks',
          evidence_type: 'artifact',
          verification_status: 'verified',
          occurred_at: '2026-10-01T00:00:00Z',
          external_url: 'https://github.com/example/benchmarks',
        },
      ];
      careerRepo.evidenceLinks = [
        {
          evidence_id: EVIDENCE_ID,
          entity_type: 'project',
          entity_id: PROJ_ID,
        },
      ];

      // 5. Tasks
      careerRepo.tasks = [
        {
          id: '77777777-7777-4000-8000-000000000001',
          user_id: ALICE_ID,
          application_id: appId,
          title: 'Review Grafana Mimir architecture',
          status: 'planned',
          priority: 'high',
        },
        {
          id: '77777777-7777-4000-8000-000000000002',
          user_id: ALICE_ID,
          application_id: appId,
          title: 'Submit resume',
          status: 'completed',
          priority: 'medium',
        },
      ];

      // 6. Interview round
      await careerRepo.createInterview(ALICE_ID, appId, {
        round_number: 1,
        round_type: 'recruiter_screen',
        duration_minutes: 30,
        notes: 'Introductory discussion with talent partner.',
      });
    });

    it('returns explainable, deterministic preparation summary with authoritative records', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/career/applications/${appId}/preparation`,
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;

      // Metadata
      expect(data.application_id).toBe(appId);
      expect(data.company_name).toBe('Grafana Labs');
      expect(data.role_title).toBe('Staff Observability Engineer');

      // Skills gap analysis
      expect(data.skills.required.length).toBe(1);
      expect(data.skills.required[0].skill_name).toBe('Distributed Tracing');
      expect(data.skills.required[0].is_acquired).toBe(true);
      expect(data.skills.required[0].current_level).toBe('advanced');
      expect(data.skills.required[0].mastery_score).toBe(88);

      expect(data.skills.preferred.length).toBe(1);
      expect(data.skills.preferred[0].skill_name).toBe('eBPF');
      expect(data.skills.preferred[0].is_acquired).toBe(false);

      expect(data.skills.bonus.length).toBe(1);
      expect(data.skills.bonus[0].skill_name).toBe('OpenTelemetry');
      expect(data.skills.bonus[0].is_acquired).toBe(true);

      expect(data.skills.summary.total_skills).toBe(3);
      expect(data.skills.summary.acquired_skills).toBe(2);
      expect(data.skills.summary.missing_skills).toBe(1);
      expect(data.skills.summary.required_total).toBe(1);
      expect(data.skills.summary.required_acquired).toBe(1);

      // Featured projects & evidence
      expect(data.projects.featured.length).toBe(1);
      const featured = data.projects.featured[0];
      expect(featured.title).toBe('Trace Collector');
      expect(featured.talking_points).toContain('OTLP collector');
      expect(featured.evidence.length).toBe(1);
      expect(featured.evidence[0].title).toBe('Trace Collector Benchmarks');
      expect(featured.evidence[0].verification_status).toBe('verified');

      // Tasks
      expect(data.tasks.open_count).toBe(1);
      expect(data.tasks.completed_count).toBe(1);
      expect(data.tasks.open[0].title).toBe('Review Grafana Mimir architecture');
      expect(data.tasks.completed[0].title).toBe('Submit resume');

      // Interviews
      expect(data.interviews.length).toBe(1);
      expect(data.interviews[0].round_type).toBe('recruiter_screen');
    });

    it('enforces tenant isolation on preparation summary endpoint', async () => {
      // Bob attempts to fetch Alice application preparation
      currentUserId = BOB_ID;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/career/applications/${appId}/preparation`,
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    });

    it('lists application tasks via dedicated application endpoint', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/career/applications/${appId}/tasks`,
      });

      expect(res.statusCode).toBe(200);
      const tasks = res.json().data;
      expect(tasks.length).toBe(2);
      expect(tasks.map((t: { title: string }) => t.title)).toContain('Review Grafana Mimir architecture');
    });
  });
});
