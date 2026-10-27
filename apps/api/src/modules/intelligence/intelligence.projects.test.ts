import { describe, it, expect, beforeEach } from 'vitest';
import { IntelligenceContextBuilder } from './context/context-builder';
import { CandidateGenerator } from './candidates/candidate-generator';
import { CandidateScorer } from './scoring/candidate-scoring';
import { IntelligenceService } from './intelligence.service';
import { InMemoryTasksRepository } from '../tasks/tasks.repository';
import { InMemoryGoalsRepository } from '../goals/goals.repository';
import { InMemoryFocusRepository } from '../focus/focus.repository';
import { InMemoryEvidenceRepository } from '../evidence/evidence.repository';
import { InMemoryPreferencesRepository } from '../preferences/preferences.repository';
import { InMemoryProfileRepository } from '../identity/profile.repository';
import { InMemoryProjectsRepository } from '../projects/projects.repository';
import type { CandidateAction } from './candidates/candidate.types';
import type { IntelligenceContext, TaskContextItem } from './context/context.types';

describe('Phase 15F: Project Intelligence & Next Best Action', () => {
  let tasksRepo: InMemoryTasksRepository;
  let goalsRepo: InMemoryGoalsRepository;
  let focusRepo: InMemoryFocusRepository;
  let evidenceRepo: InMemoryEvidenceRepository;
  let preferencesRepo: InMemoryPreferencesRepository;
  let profileRepo: InMemoryProfileRepository;
  let projectsRepo: InMemoryProjectsRepository;

  let contextBuilder: IntelligenceContextBuilder;
  let candidateGenerator: CandidateGenerator;
  let candidateScorer: CandidateScorer;
  let intelligenceService: IntelligenceService;

  const aliceId = 'user-alice-15f';
  const bobId = 'user-bob-15f';

  beforeEach(() => {
    tasksRepo = new InMemoryTasksRepository();
    goalsRepo = new InMemoryGoalsRepository();
    focusRepo = new InMemoryFocusRepository();
    evidenceRepo = new InMemoryEvidenceRepository();
    preferencesRepo = new InMemoryPreferencesRepository();
    profileRepo = new InMemoryProfileRepository();
    projectsRepo = new InMemoryProjectsRepository(tasksRepo.getTasksMap());

    contextBuilder = new IntelligenceContextBuilder(
      tasksRepo,
      goalsRepo,
      focusRepo,
      evidenceRepo,
      preferencesRepo,
      profileRepo,
      projectsRepo
    );
    candidateGenerator = new CandidateGenerator();
    candidateScorer = new CandidateScorer();
    intelligenceService = new IntelligenceService(
      contextBuilder,
      candidateGenerator,
      candidateScorer
    );
  });

  // =========================================================================
  // SECTION 18: CONTEXT BUILDER TESTS (1 - 10)
  // =========================================================================
  describe('18. Context Builder Tests', () => {
    it('1. includes active projects for the authenticated user in context', async () => {
      const proj = await projectsRepo.createProject({
        user_id: aliceId,
        title: 'Avenza Core',
        slug: 'avenza-core',
        status: 'in_progress',
        priority: 'high',
        project_type: 'software',
        target_date: '2026-11-01T00:00:00Z',
      });

      const context = await contextBuilder.buildContext(aliceId);
      expect(context.activeProjects).toHaveLength(1);
      expect(context.activeProjects![0]!.project_id).toBe(proj.id);
      expect(context.activeProjects![0]!.title).toBe('Avenza Core');
      expect(context.activeProjects![0]!.status).toBe('in_progress');
    });

    it('2. handles completed projects with health = completed', async () => {
      await projectsRepo.createProject({
        user_id: aliceId,
        title: 'Legacy V1',
        slug: 'legacy-v1',
        status: 'completed',
        priority: 'low',
        project_type: 'software',
        target_date: '2026-09-01T00:00:00Z',
      });

      const context = await contextBuilder.buildContext(aliceId);
      expect(context.activeProjects).toHaveLength(1);
      expect(context.activeProjects![0]!.health).toBe('completed');
      expect(context.activeProjects![0]!.progress).toBe(100);
      expect(context.activeProjects![0]!.next_pending_milestone).toBeNull();
    });

    it('3. derives health = at_risk when target date is passed with incomplete progress', async () => {
      await projectsRepo.createProject({
        user_id: aliceId,
        title: 'Overdue Project',
        slug: 'overdue-proj',
        status: 'in_progress',
        priority: 'high',
        project_type: 'software',
        start_date: '2026-08-01T00:00:00Z',
        target_date: '2026-09-01T00:00:00Z', // Past date
      });

      const context = await contextBuilder.buildContext(aliceId, {
        currentTime: '2026-10-08T12:00:00.000Z',
      });
      expect(context.activeProjects[0]!.health).toBe('at_risk');
    });

    it('4. derives health = on_track when active project is proceeding normally', async () => {
      await projectsRepo.createProject({
        user_id: aliceId,
        title: 'On-Track Engine',
        slug: 'ontrack-engine',
        status: 'in_progress',
        priority: 'medium',
        project_type: 'software',
        start_date: '2026-10-01T00:00:00Z',
        target_date: '2026-12-31T00:00:00Z',
      });

      const context = await contextBuilder.buildContext(aliceId, {
        currentTime: '2026-10-08T12:00:00.000Z',
      });
      expect(context.activeProjects[0]!.health).toBe('on_track');
    });

    it('5. derives health = unknown when target date is null or project is in backlog/planning', async () => {
      await projectsRepo.createProject({
        user_id: aliceId,
        title: 'Exploratory Idea',
        slug: 'exploratory-idea',
        status: 'planning',
        priority: 'low',
        project_type: 'research',
        target_date: null,
      });

      const context = await contextBuilder.buildContext(aliceId);
      expect(context.activeProjects[0]!.health).toBe('unknown');
    });

    it('6. deterministically identifies next pending milestone by status, target_date, order_index, and id', async () => {
      const proj = await projectsRepo.createProject({
        user_id: aliceId,
        title: 'Multi-Milestone Project',
        slug: 'multi-m',
        status: 'in_progress',
        priority: 'high',
        project_type: 'software',
      });

      // M1: completed
      await projectsRepo.createMilestone({
        project_id: proj.id,
        user_id: aliceId,
        title: 'M1 Architecture',
        status: 'completed',
        order_index: 0,
        target_date: '2026-10-01T00:00:00Z',
      });

      // M2: pending, target Oct 25
      const m2 = await projectsRepo.createMilestone({
        project_id: proj.id,
        user_id: aliceId,
        title: 'M2 Core Engine',
        status: 'pending',
        order_index: 1,
        target_date: '2026-10-25T00:00:00Z',
      });

      // M3: pending, target Nov 15
      await projectsRepo.createMilestone({
        project_id: proj.id,
        user_id: aliceId,
        title: 'M3 Integrations',
        status: 'pending',
        order_index: 2,
        target_date: '2026-11-15T00:00:00Z',
      });

      const context = await contextBuilder.buildContext(aliceId);
      expect(context.activeProjects[0]!.next_pending_milestone?.id).toBe(m2.id);
      expect(context.activeProjects[0]!.next_pending_milestone?.title).toBe('M2 Core Engine');
    });

    it('7. returns next_pending_milestone = null when project has no pending milestones', async () => {
      const proj = await projectsRepo.createProject({
        user_id: aliceId,
        title: 'Finished Milestones Project',
        slug: 'finished-m',
        status: 'in_progress',
        priority: 'medium',
        project_type: 'software',
      });

      await projectsRepo.createMilestone({
        project_id: proj.id,
        user_id: aliceId,
        title: 'Only Milestone',
        status: 'completed',
        order_index: 0,
      });

      const context = await contextBuilder.buildContext(aliceId);
      expect(context.activeProjects[0]!.next_pending_milestone).toBeNull();
    });

    it('8. builds project task context with project_id and project_milestone_id', async () => {
      const proj = await projectsRepo.createProject({
        user_id: aliceId,
        title: 'Web Platform',
        slug: 'web-platform',
        status: 'in_progress',
        priority: 'high',
        project_type: 'software',
      });

      const m = await projectsRepo.createMilestone({
        project_id: proj.id,
        user_id: aliceId,
        title: 'Frontend Polish',
        status: 'in_progress',
        order_index: 0,
      });

      const task = await tasksRepo.createTask({
        user_id: aliceId,
        title: 'Polish overview filters',
        status: 'planned',
        priority: 'high',
        task_type: 'project',
        project_id: proj.id,
        project_milestone_id: m.id,
      });

      const context = await contextBuilder.buildContext(aliceId);
      const foundTask = context.openTasks.find((t) => t.id === task.id);
      expect(foundTask).toBeDefined();
      expect(foundTask?.project_id).toBe(proj.id);
      expect(foundTask?.project_milestone_id).toBe(m.id);
    });

    it('9. enforces strict tenant isolation between User A and User B project contexts', async () => {
      await projectsRepo.createProject({
        user_id: bobId,
        title: 'Bob Secret Project',
        slug: 'bob-secret',
        status: 'in_progress',
        priority: 'high',
        project_type: 'software',
      });

      const aliceContext = await contextBuilder.buildContext(aliceId);
      expect(aliceContext.activeProjects).toHaveLength(0);

      const bobContext = await contextBuilder.buildContext(bobId);
      expect(bobContext.activeProjects).toHaveLength(1);
      expect(bobContext.activeProjects[0]!.title).toBe('Bob Secret Project');
    });

    it('10. uses bounded queries (pageSize 50) for projects', async () => {
      for (let i = 0; i < 60; i++) {
        await projectsRepo.createProject({
          user_id: aliceId,
          title: `Project ${i}`,
          slug: `proj-${i}`,
          status: 'in_progress',
          priority: 'medium',
          project_type: 'software',
        });
      }

      const context = await contextBuilder.buildContext(aliceId);
      expect(context.activeProjects.length).toBeLessThanOrEqual(50);
    });
  });

  // =========================================================================
  // SECTION 19: SCORER TESTS (11 - 20)
  // =========================================================================
  describe('19. Candidate Scorer Tests', () => {
    function createMockTaskContextItem(overrides?: Partial<TaskContextItem>): TaskContextItem {
      return {
        id: 't-default',
        goal_id: null,
        milestone_id: null,
        project_id: null,
        project_milestone_id: null,
        title: 'Build Feature',
        description: null,
        priority: 'medium',
        task_type: 'project',
        status: 'planned',
        due_at: null,
        scheduled_date: null,
        estimated_minutes: 30,
        actual_minutes: 0,
        is_blocked: false,
        unblocks_count: 0,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
        ...overrides,
      };
    }

    function createMockContext(overrides?: Partial<IntelligenceContext>): IntelligenceContext {
      return {
        userId: aliceId,
        currentDate: '2026-10-08',
        currentTimeIso: '2026-10-08T12:00:00.000Z',
        timezone: 'UTC',
        activeGoals: [],
        activeMilestones: [],
        activeProjects: [],
        projects: [],
        openTasks: [],
        recentCompletedTasks: [],
        recentFocusSessions: [],
        recentEvidence: [],
        activeFocusSessionTaskId: null,
        ...overrides,
      };
    }

    it('11. awards +10 urgency points to candidate belonging to an at-risk project', () => {
      const task = createMockTaskContextItem({ id: 't-1', priority: 'medium' });
      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: task.id,
        task,
        projectId: 'p-1',
        projectHealth: 'at_risk',
        projectTitle: 'Critical Platform',
      };

      const scored = candidateScorer.scoreCandidate(candidate, createMockContext());
      expect(scored.scoreBreakdown.urgencySignal).toBe(10);
      expect(scored.scoreBreakdown.projectSignal).toBe(10);
    });

    it('12. awards +15 priority alignment points to candidate belonging to next pending milestone', () => {
      const task = createMockTaskContextItem({ id: 't-2', priority: 'medium' });
      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: task.id,
        task,
        projectId: 'p-1',
        projectHealth: 'on_track',
        isNextPendingMilestone: true,
        projectTitle: 'Avenza Core',
      };

      const scored = candidateScorer.scoreCandidate(candidate, createMockContext());
      // medium priority is 20 + 15 = 35
      expect(scored.scoreBreakdown.prioritySignal).toBe(35);
      expect(scored.scoreBreakdown.projectSignal).toBe(15);
    });

    it('13. awards zero project bonus to task without a project', () => {
      const task = createMockTaskContextItem({ id: 't-3', priority: 'medium' });
      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: task.id,
        task,
      };

      const scored = candidateScorer.scoreCandidate(candidate, createMockContext());
      expect(scored.scoreBreakdown.urgencySignal).toBe(0);
      expect(scored.scoreBreakdown.prioritySignal).toBe(20);
      expect(scored.scoreBreakdown.projectSignal).toBe(0);
    });

    it('14. does not award active urgency or milestone bonuses to completed project tasks', () => {
      const task = createMockTaskContextItem({ id: 't-4', priority: 'medium' });
      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: task.id,
        task,
        projectId: 'p-comp',
        projectHealth: 'completed',
        isNextPendingMilestone: true,
      };

      const scored = candidateScorer.scoreCandidate(candidate, createMockContext());
      expect(scored.scoreBreakdown.urgencySignal).toBe(0);
      expect(scored.scoreBreakdown.prioritySignal).toBe(20);
      expect(scored.scoreBreakdown.projectSignal).toBe(0);
    });

    it('15. does not award +15 milestone bonus if milestone is not the next pending milestone', () => {
      const task = createMockTaskContextItem({ id: 't-5', priority: 'medium' });
      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: task.id,
        task,
        projectId: 'p-1',
        projectHealth: 'on_track',
        isNextPendingMilestone: false,
      };

      const scored = candidateScorer.scoreCandidate(candidate, createMockContext());
      expect(scored.scoreBreakdown.prioritySignal).toBe(20);
      expect(scored.scoreBreakdown.projectSignal).toBe(0);
    });

    it('16. combines +10 urgency and +15 priority alignment correctly (+25 projectSignal)', () => {
      const task = createMockTaskContextItem({ id: 't-6', priority: 'medium' });
      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: task.id,
        task,
        projectId: 'p-urgent',
        projectHealth: 'at_risk',
        isNextPendingMilestone: true,
        projectTitle: 'Urgent System',
      };

      const scored = candidateScorer.scoreCandidate(candidate, createMockContext());
      expect(scored.scoreBreakdown.urgencySignal).toBe(10);
      expect(scored.scoreBreakdown.prioritySignal).toBe(35);
      expect(scored.scoreBreakdown.projectSignal).toBe(25);
      expect(scored.primaryReason.code).toBe('project_at_risk');
      expect(scored.primaryReason.explanation).toContain('is at risk and this task belongs to its next milestone');
    });

    it('17. strictly prevents double-counting between task due date and project deadline', () => {
      // Task with its own due date in 24h (+12 urgency)
      const task = createMockTaskContextItem({
        id: 't-7',
        due_at: '2026-10-09T12:00:00.000Z',
      });
      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: task.id,
        task,
        projectId: 'p-1',
        projectHealth: 'on_track',
        projectTargetDate: '2026-10-09T12:00:00.000Z',
        projectMilestoneTargetDate: '2026-10-09T12:00:00.000Z',
      };

      const scored = candidateScorer.scoreCandidate(candidate, createMockContext());
      // Urgency should be evaluated only once for 24h window (12 points), NOT 3x (36 points)
      expect(scored.scoreBreakdown.urgencySignal).toBe(12);
    });

    it('18. preserves existing goal relevance scoring (+10 goal, +5 milestone)', () => {
      const context = createMockContext({
        activeGoals: [{ id: 'g-1', title: 'Goal 1', status: 'active', priority: 1 }],
      });
      const task = createMockTaskContextItem({
        id: 't-8',
        goal_id: 'g-1',
        milestone_id: 'm-1',
      });
      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: task.id,
        task,
        goalTitle: 'Goal 1',
      };

      const scored = candidateScorer.scoreCandidate(candidate, context);
      expect(scored.scoreBreakdown.goalSignal).toBe(15);
    });

    it('19. leaves existing non-project tasks scoring unchanged', () => {
      const task = createMockTaskContextItem({
        id: 't-dsa',
        task_type: 'dsa',
        priority: 'high',
      });
      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: task.id,
        task,
      };

      const scored = candidateScorer.scoreCandidate(candidate, createMockContext());
      expect(scored.scoreBreakdown.prioritySignal).toBe(30);
      expect(scored.scoreBreakdown.projectSignal).toBe(0);
      expect(scored.scoreBreakdown.totalScore).toBe(30);
    });

    it('20. enforces deterministic tie-breaking without random fluctuations', () => {
      const taskA = createMockTaskContextItem({ id: 't-alpha', created_at: '2026-10-01T00:00:00Z' });
      const taskB = createMockTaskContextItem({ id: 't-beta', created_at: '2026-10-01T00:00:00Z' });

      const candA: CandidateAction = { type: 'focus_task', taskId: taskA.id, task: taskA };
      const candB: CandidateAction = { type: 'focus_task', taskId: taskB.id, task: taskB };

      const sorted1 = candidateScorer.scoreCandidates([candB, candA], createMockContext());
      const sorted2 = candidateScorer.scoreCandidates([candA, candB], createMockContext());

      expect(sorted1.map((s) => s.candidate.taskId)).toEqual(sorted2.map((s) => s.candidate.taskId));
      expect(sorted1[0]!.candidate.taskId).toBe('t-alpha'); // alphabetical tie-breaker
    });
  });

  // =========================================================================
  // SECTION 20: NEXT BEST ACTION TESTS (21 - 28)
  // =========================================================================
  describe('20. Next Best Action Pipeline Tests', () => {
    it('21. recommends project task as Next Best Action when boosted by at-risk and next-milestone', async () => {
      const proj = await projectsRepo.createProject({
        user_id: aliceId,
        title: 'Payments Engine',
        slug: 'payments-engine',
        status: 'in_progress',
        priority: 'critical',
        project_type: 'software',
        start_date: '2026-08-01T00:00:00Z',
        target_date: '2026-09-01T00:00:00Z', // past => at_risk
      });

      const m = await projectsRepo.createMilestone({
        project_id: proj.id,
        user_id: aliceId,
        title: 'Stripe Webhooks',
        status: 'in_progress',
        order_index: 0,
        target_date: '2026-10-25T00:00:00Z',
      });

      await tasksRepo.createTask({
        user_id: aliceId,
        title: 'Verify Stripe signature middleware',
        status: 'planned',
        priority: 'high',
        task_type: 'project',
        project_id: proj.id,
        project_milestone_id: m.id,
      });

      // Regular task
      await tasksRepo.createTask({
        user_id: aliceId,
        title: 'Review documentation',
        status: 'planned',
        priority: 'low',
        task_type: 'general',
      });

      const result = await intelligenceService.getNextAction(aliceId, {
        date: '2026-10-08',
      });

      expect(result.action).not.toBeNull();
      expect(result.action?.title).toBe('Verify Stripe signature middleware');
      expect(result.action?.projectId).toBe(proj.id);
      expect(result.action?.projectTitle).toBe('Payments Engine');
      expect(result.action?.projectHealth).toBe('at_risk');
      expect(result.reason.code).toBe('project_at_risk');
    });

    it('22. preserves overdue priority above normal project priority', async () => {
      // Overdue standalone task (due 3 days ago)
      await tasksRepo.createTask({
        user_id: aliceId,
        title: 'Critical server security patch',
        status: 'planned',
        priority: 'high',
        due_at: '2026-10-05T00:00:00Z',
      });

      // On-track project task
      const proj = await projectsRepo.createProject({
        user_id: aliceId,
        title: 'New Dashboard',
        slug: 'new-dash',
        status: 'in_progress',
        priority: 'medium',
        project_type: 'software',
        target_date: '2026-12-31T00:00:00Z',
      });

      await tasksRepo.createTask({
        user_id: aliceId,
        title: 'Add analytics chart',
        status: 'planned',
        priority: 'medium',
        project_id: proj.id,
      });

      const result = await intelligenceService.getNextAction(aliceId, {
        date: '2026-10-08',
      });

      expect(result.action?.title).toBe('Critical server security patch');
      expect(result.reason.code).toBe('overdue');
    });

    it('23. preserves critical priority above non-critical project task', async () => {
      await tasksRepo.createTask({
        user_id: aliceId,
        title: 'Database connection pool exhausted',
        status: 'planned',
        priority: 'critical',
      });

      const proj = await projectsRepo.createProject({
        user_id: aliceId,
        title: 'Blog redesign',
        slug: 'blog-redesign',
        status: 'in_progress',
        priority: 'low',
        project_type: 'software',
      });

      await tasksRepo.createTask({
        user_id: aliceId,
        title: 'CSS color updates',
        status: 'planned',
        priority: 'low',
        project_id: proj.id,
      });

      const result = await intelligenceService.getNextAction(aliceId, {
        date: '2026-10-08',
      });

      expect(result.action?.title).toBe('Database connection pool exhausted');
      expect(result.reason.code).toBe('critical_priority');
    });

    it('24. preserves due-today tasks above future project milestone tasks', async () => {
      await tasksRepo.createTask({
        user_id: aliceId,
        title: 'Submit tax compliance declaration',
        status: 'planned',
        priority: 'high',
        due_at: '2026-10-08T18:00:00Z',
      });

      const proj = await projectsRepo.createProject({
        user_id: aliceId,
        title: 'Cloud Migration',
        slug: 'cloud-mig',
        status: 'in_progress',
        priority: 'medium',
        project_type: 'software',
        target_date: '2026-11-30T00:00:00Z',
      });

      await tasksRepo.createTask({
        user_id: aliceId,
        title: 'Configure Terraform S3 backend',
        status: 'planned',
        priority: 'medium',
        project_id: proj.id,
      });

      const result = await intelligenceService.getNextAction(aliceId, {
        date: '2026-10-08',
      });

      expect(result.action?.title).toBe('Submit tax compliance declaration');
      expect(result.reason.code).toBe('due_today');
    });

    it('25. preserves goal relevance alongside project signals', async () => {
      const goal = await goalsRepo.createGoal({
        user_id: aliceId,
        title: 'Achieve SOC2 Compliance',
        status: 'active',
        priority: 'high',
        goal_type: 'career',
      });

      await tasksRepo.createTask({
        user_id: aliceId,
        title: 'Write audit logging policy',
        status: 'planned',
        priority: 'high',
        goal_id: goal.id,
      });

      const result = await intelligenceService.getNextAction(aliceId, {
        date: '2026-10-08',
      });

      expect(result.action?.title).toBe('Write audit logging policy');
      expect(result.action?.goalId).toBe(goal.id);
      expect(result.action?.goalTitle).toBe('Achieve SOC2 Compliance');
    });

    it('26. enriches candidates with project metadata without breaking schema', async () => {
      const proj = await projectsRepo.createProject({
        user_id: aliceId,
        title: 'Avenza IDE',
        slug: 'avenza-ide',
        status: 'in_progress',
        priority: 'high',
        project_type: 'software',
        target_date: '2026-11-15T00:00:00Z',
      });

      const m = await projectsRepo.createMilestone({
        project_id: proj.id,
        user_id: aliceId,
        title: 'Syntax Highlighter',
        status: 'in_progress',
        order_index: 0,
      });

      await tasksRepo.createTask({
        user_id: aliceId,
        title: 'Integrate Tree-Sitter wasm parser',
        status: 'planned',
        priority: 'high',
        project_id: proj.id,
        project_milestone_id: m.id,
      });

      const result = await intelligenceService.getNextAction(aliceId, {
        date: '2026-10-08',
      });

      expect(result.action?.projectId).toBe(proj.id);
      expect(result.action?.projectTitle).toBe('Avenza IDE');
      expect(result.action?.projectMilestoneId).toBe(m.id);
      expect(result.action?.projectMilestoneTitle).toBe('Syntax Highlighter');
      expect(result.scoreBreakdown?.projectSignal).toBe(15);
    });

    it('27. ensures low-priority project task does not bypass higher-priority standalone candidate', async () => {
      await tasksRepo.createTask({
        user_id: aliceId,
        title: 'Resolve production memory leak',
        status: 'planned',
        priority: 'high',
        due_at: '2026-10-08T20:00:00Z',
      });

      const proj = await projectsRepo.createProject({
        user_id: aliceId,
        title: 'Docs Site',
        slug: 'docs-site',
        status: 'in_progress',
        priority: 'low',
        project_type: 'content',
      });

      await tasksRepo.createTask({
        user_id: aliceId,
        title: 'Fix typo in footer',
        status: 'planned',
        priority: 'low',
        project_id: proj.id,
      });

      const result = await intelligenceService.getNextAction(aliceId, {
        date: '2026-10-08',
      });

      expect(result.action?.title).toBe('Resolve production memory leak');
    });

    it('28. guarantees 100 consecutive identical runs produce byte-for-byte identical recommendation output', async () => {
      const proj = await projectsRepo.createProject({
        user_id: aliceId,
        title: 'Consensus Engine',
        slug: 'consensus-engine',
        status: 'in_progress',
        priority: 'high',
        project_type: 'software',
        start_date: '2026-08-01T00:00:00Z',
        target_date: '2026-09-01T00:00:00Z', // at risk
      });

      const m = await projectsRepo.createMilestone({
        project_id: proj.id,
        user_id: aliceId,
        title: 'Raft protocol',
        status: 'in_progress',
        order_index: 0,
      });

      await tasksRepo.createTask({
        user_id: aliceId,
        title: 'Implement leader election RPC',
        status: 'planned',
        priority: 'high',
        project_id: proj.id,
        project_milestone_id: m.id,
      });

      await tasksRepo.createTask({
        user_id: aliceId,
        title: 'Write snapshot tests',
        status: 'planned',
        priority: 'medium',
        project_id: proj.id,
        project_milestone_id: m.id,
      });

      const firstRun = await intelligenceService.getNextAction(aliceId, {
        date: '2026-10-08',
      });

      // Extract deterministic footprint (excluding generatedAt which updates on each clock call)
      const extractFootprint = (res: typeof firstRun) => ({
        action: res.action,
        reason: res.reason,
        confidence: res.confidence,
        scoreBreakdown: res.scoreBreakdown,
      });

      const firstFootprint = JSON.stringify(extractFootprint(firstRun));

      for (let i = 0; i < 99; i++) {
        const nextRun = await intelligenceService.getNextAction(aliceId, {
          date: '2026-10-08',
        });
        const nextFootprint = JSON.stringify(extractFootprint(nextRun));
        expect(nextFootprint).toBe(firstFootprint);
      }
    });
  });
});
