import fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { describe, expect, it, beforeEach } from 'vitest';
import { registerErrorHandler } from '../plugins/error-handler';
import type { requireAuth as defaultRequireAuth } from '../auth/auth.middleware';
import { InMemoryGoalsRepository } from '../modules/goals/goals.repository';
import { GoalsService } from '../modules/goals/goals.service';
import { GoalsController } from '../modules/goals/goals.controller';
import { createGoalsRoutes } from '../modules/goals/goals.routes';
import { InMemoryTasksRepository } from '../modules/tasks/tasks.repository';
import { TasksService } from '../modules/tasks/tasks.service';
import { TasksController } from '../modules/tasks/tasks.controller';
import { createTasksRoutes } from '../modules/tasks/tasks.routes';
import { InMemoryEvidenceRepository } from '../modules/evidence/evidence.repository';
import { EvidenceService } from '../modules/evidence/evidence.service';
import { EvidenceController } from '../modules/evidence/evidence.controller';
import { createEvidenceRoutes } from '../modules/evidence/evidence.routes';

describe('Phase 17C Journey A: Goal → Task → Evidence → Goal Progress', () => {
  let app: FastifyInstance;
  let goalsRepo: InMemoryGoalsRepository;
  let goalsService: GoalsService;
  let goalsController: GoalsController;

  let tasksRepo: InMemoryTasksRepository;
  let tasksService: TasksService;
  let tasksController: TasksController;

  let evidenceRepo: InMemoryEvidenceRepository;
  let evidenceService: EvidenceService;
  let evidenceController: EvidenceController;

  const ALICE_ID = '00000000-0000-4000-8000-000000000001';
  const BOB_ID = '00000000-0000-4000-8000-000000000002';

  let currentUserId: string = ALICE_ID;

  beforeEach(async () => {
    currentUserId = ALICE_ID;

    // 1. Repositories
    goalsRepo = new InMemoryGoalsRepository();
    tasksRepo = new InMemoryTasksRepository();
    evidenceRepo = new InMemoryEvidenceRepository();

    // 2. Services
    goalsService = new GoalsService(goalsRepo);
    tasksService = new TasksService(tasksRepo, goalsRepo);
    evidenceService = new EvidenceService(evidenceRepo, tasksRepo, goalsRepo);

    // 3. Controllers
    goalsController = new GoalsController(goalsService);
    tasksController = new TasksController(tasksService);
    evidenceController = new EvidenceController(evidenceService);

    // 4. Fastify App & Auth Hook
    app = fastify();
    registerErrorHandler(app);

    const mockAuthHook = async (request: FastifyRequest) => {
      (request as unknown as { profile: { id: string } }).profile = { id: currentUserId };
    };

    app.register(
      createGoalsRoutes({
        requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth,
        goalsController,
      })
    );

    app.register(
      createTasksRoutes({
        requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth,
        tasksController,
      })
    );

    app.register(
      createEvidenceRoutes({
        requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth,
        evidenceController,
      })
    );

    await app.ready();
  });

  // ============================================================================
  // Complete End-to-End Journey A
  // ============================================================================
  it('executes complete Goal → Task → Evidence → Goal Progress journey preserving domain invariants', async () => {
    // --------------------------------------------------------------------------
    // Step 1: Create a synthetic user's Goal
    // --------------------------------------------------------------------------
    const createGoalRes = await app.inject({
      method: 'POST',
      url: '/api/v1/goals',
      payload: {
        title: 'Master Distributed Systems Architecture',
        description: 'Deep dive into consensus algorithms, replicated logs, and formal verification.',
        goal_type: 'academic',
        priority: 'high',
        status: 'active',
        start_date: '2026-01-01T00:00:00.000Z',
        target_date: '2026-12-31T00:00:00.000Z',
      },
    });

    expect(createGoalRes.statusCode).toBe(201);
    const goal = JSON.parse(createGoalRes.body).data;
    expect(goal.id).toBeDefined();
    expect(goal.user_id).toBe(ALICE_ID);
    expect(goal.status).toBe('active');
    expect(goal.metrics.progressPercentage).toBe(0);
    expect(goal.metrics.milestoneCount).toBe(0);

    // --------------------------------------------------------------------------
    // Step 2: Create Milestones under the Goal
    // --------------------------------------------------------------------------
    const ms1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/goals/${goal.id}/milestones`,
      payload: {
        title: 'Implement Raft Consensus Engine',
        status: 'pending',
        priority: 'high',
        target_date: '2026-06-30T00:00:00.000Z',
      },
    });
    expect(ms1Res.statusCode).toBe(201);
    const milestone1 = JSON.parse(ms1Res.body).data;

    const ms2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/goals/${goal.id}/milestones`,
      payload: {
        title: 'Formally Verify State Machine Safety with TLA+',
        status: 'pending',
        priority: 'high',
        target_date: '2026-11-30T00:00:00.000Z',
      },
    });
    expect(ms2Res.statusCode).toBe(201);
    const milestone2 = JSON.parse(ms2Res.body).data;

    // Verify Goal metric recalculation with 2 pending milestones
    const initialGoalMetricsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/goals/${goal.id}`,
    });
    expect(initialGoalMetricsRes.statusCode).toBe(200);
    const initialGoal = JSON.parse(initialGoalMetricsRes.body).data;
    expect(initialGoal.metrics.milestoneCount).toBe(2);
    expect(initialGoal.metrics.completedMilestoneCount).toBe(0);
    expect(initialGoal.metrics.progressPercentage).toBe(0);

    // --------------------------------------------------------------------------
    // Step 3: Create Tasks Linked to Goal and Milestone 1
    // --------------------------------------------------------------------------
    // Task 1: Prerequisite task
    const task1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Define RPC Wire Protocol and State Machine Invariants',
        task_type: 'study',
        priority: 'high',
        goal_id: goal.id,
        milestone_id: milestone1.id,
      },
    });
    expect(task1Res.statusCode).toBe(201);
    const task1 = JSON.parse(task1Res.body).data;

    // Task 2: Dependent task
    const task2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Implement Leader Election & Log Replication',
        task_type: 'project',
        priority: 'critical',
        goal_id: goal.id,
        milestone_id: milestone1.id,
      },
    });
    expect(task2Res.statusCode).toBe(201);
    const task2 = JSON.parse(task2Res.body).data;

    // Establish dependency: Task 2 depends on Task 1
    const depRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${task2.id}/dependencies`,
      payload: {
        depends_on_task_id: task1.id,
      },
    });
    expect(depRes.statusCode).toBe(201);

    // --------------------------------------------------------------------------
    // Step 4: Verify Blocked State & Enforce Transition Rejections (DEF-17C-01)
    // --------------------------------------------------------------------------
    const task2BlockedCheck = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks/${task2.id}`,
    });
    expect(task2BlockedCheck.statusCode).toBe(200);
    const task2BlockedData = JSON.parse(task2BlockedCheck.body).data;
    expect(task2BlockedData.metrics.is_blocked).toBe(true);
    expect(task2BlockedData.metrics.blocking_task_count).toBe(1);
    expect(task2BlockedData.metrics.blocked_by).toEqual([
      expect.objectContaining({
        id: task1.id,
        title: 'Define RPC Wire Protocol and State Machine Invariants',
      }),
    ]);

    // Reject illegal transition: Blocked Task 2 -> completed
    const illegalCompleteRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${task2.id}`,
      payload: {
        status: 'completed',
      },
    });
    expect(illegalCompleteRes.statusCode).toBe(400);
    const illegalCompleteBody = JSON.parse(illegalCompleteRes.body);
    expect(illegalCompleteBody.error.code).toBe('TASK_BLOCKED');
    expect(illegalCompleteBody.error.message).toContain('blocked by 1 incomplete prerequisite');

    // Reject illegal transition: Blocked Task 2 -> in_progress
    const illegalInProgressRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${task2.id}`,
      payload: {
        status: 'in_progress',
      },
    });
    expect(illegalInProgressRes.statusCode).toBe(400);
    const illegalInProgressBody = JSON.parse(illegalInProgressRes.body);
    expect(illegalInProgressBody.error.code).toBe('TASK_BLOCKED');

    // Assert persisted state remains intact and untouched
    const task2Unchanged = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks/${task2.id}`,
    });
    expect(JSON.parse(task2Unchanged.body).data.status).toBe('inbox');
    expect(JSON.parse(task2Unchanged.body).data.completed_at).toBeNull();

    // --------------------------------------------------------------------------
    // Step 5: Complete Prerequisites and Verify Dependent Task Becomes Eligible
    // --------------------------------------------------------------------------
    // Transition Task 1 to in_progress (allowed, no prerequisites)
    const task1InProgressRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${task1.id}`,
      payload: { status: 'in_progress' },
    });
    expect(task1InProgressRes.statusCode).toBe(200);

    // Complete Task 1
    const task1CompleteRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${task1.id}`,
      payload: { status: 'completed' },
    });
    expect(task1CompleteRes.statusCode).toBe(200);
    const task1CompletedData = JSON.parse(task1CompleteRes.body).data;
    expect(task1CompletedData.status).toBe('completed');
    expect(task1CompletedData.completed_at).not.toBeNull();

    // Verify Task 2 is now unblocked and eligible
    const task2EligibleCheck = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks/${task2.id}`,
    });
    expect(task2EligibleCheck.statusCode).toBe(200);
    const task2EligibleData = JSON.parse(task2EligibleCheck.body).data;
    expect(task2EligibleData.metrics.is_blocked).toBe(false);
    expect(task2EligibleData.metrics.blocking_task_count).toBe(0);
    expect(task2EligibleData.metrics.blocked_by).toEqual([]);

    // Now transition Task 2 to in_progress and completed successfully
    const task2InProgressRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${task2.id}`,
      payload: { status: 'in_progress' },
    });
    expect(task2InProgressRes.statusCode).toBe(200);

    const task2CompleteRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${task2.id}`,
      payload: { status: 'completed' },
    });
    expect(task2CompleteRes.statusCode).toBe(200);
    expect(JSON.parse(task2CompleteRes.body).data.status).toBe('completed');

    // --------------------------------------------------------------------------
    // Step 6: Invariant Assertion — Task completion does NOT automatically complete Goal
    // --------------------------------------------------------------------------
    const goalStatusCheck = await app.inject({
      method: 'GET',
      url: `/api/v1/goals/${goal.id}`,
    });
    expect(goalStatusCheck.statusCode).toBe(200);
    const goalAfterTasks = JSON.parse(goalStatusCheck.body).data;
    // Goal remains active; task completion does not prematurely trigger goal completion
    expect(goalAfterTasks.status).toBe('active');
    expect(goalAfterTasks.completed_at).toBeNull();

    // --------------------------------------------------------------------------
    // Step 7: Record Valid Evidence with Traceable Provenance
    // --------------------------------------------------------------------------
    const recordEvidenceRes = await app.inject({
      method: 'POST',
      url: '/api/v1/evidence',
      payload: {
        evidence_type: 'task_completion',
        title: 'Raft State Machine Invariants Formal Verification',
        description: 'TLA+ model checker completed 1,000,000 states without safety invariant violations.',
        external_url: 'https://github.com/avenza/raft-core/pull/42',
        links: [
          { entity_type: 'task', entity_id: task1.id },
          { entity_type: 'goal', entity_id: goal.id },
        ],
      },
    });

    expect(recordEvidenceRes.statusCode).toBe(201);
    const evidence = JSON.parse(recordEvidenceRes.body).data;
    expect(evidence.id).toBeDefined();
    expect(evidence.user_id).toBe(ALICE_ID);
    expect(evidence.source_type).toBe('user');
    expect(evidence.links).toHaveLength(2);
    expect(evidence.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity_type: 'task',
          entity_id: task1.id,
          entity_title: 'Define RPC Wire Protocol and State Machine Invariants',
        }),
        expect.objectContaining({
          entity_type: 'goal',
          entity_id: goal.id,
          entity_title: 'Master Distributed Systems Architecture',
        }),
      ])
    );

    // --------------------------------------------------------------------------
    // Step 8: Recompute and Retrieve Truthful Goal Progress
    // --------------------------------------------------------------------------
    // Milestone 1 complete
    const completeMs1Res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/goals/${goal.id}/milestones/${milestone1.id}`,
      payload: { status: 'completed' },
    });
    expect(completeMs1Res.statusCode).toBe(200);

    // Progress must reflect exactly 1 of 2 milestones completed = 50%
    const goalHalfProgressRes = await app.inject({
      method: 'GET',
      url: `/api/v1/goals/${goal.id}`,
    });
    expect(goalHalfProgressRes.statusCode).toBe(200);
    const goalHalf = JSON.parse(goalHalfProgressRes.body).data;
    expect(goalHalf.metrics.completedMilestoneCount).toBe(1);
    expect(goalHalf.metrics.milestoneCount).toBe(2);
    expect(goalHalf.metrics.progressPercentage).toBe(50);
    expect(goalHalf.status).toBe('active');

    // Milestone 2 complete
    const completeMs2Res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/goals/${goal.id}/milestones/${milestone2.id}`,
      payload: { status: 'completed' },
    });
    expect(completeMs2Res.statusCode).toBe(200);

    // Progress must reflect 2 of 2 milestones completed = 100%
    const goalFullProgressRes = await app.inject({
      method: 'GET',
      url: `/api/v1/goals/${goal.id}`,
    });
    expect(goalFullProgressRes.statusCode).toBe(200);
    const goalFull = JSON.parse(goalFullProgressRes.body).data;
    expect(goalFull.metrics.completedMilestoneCount).toBe(2);
    expect(goalFull.metrics.milestoneCount).toBe(2);
    expect(goalFull.metrics.progressPercentage).toBe(100);
    // Explicit completion requirement: goal is active until explicitly completed
    expect(goalFull.status).toBe('active');

    // Explicit goal completion by user decision
    const finalizeGoalRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/goals/${goal.id}`,
      payload: { status: 'completed' },
    });
    expect(finalizeGoalRes.statusCode).toBe(200);
    const finalizedGoal = JSON.parse(finalizeGoalRes.body).data;
    expect(finalizedGoal.status).toBe('completed');
    expect(finalizedGoal.completed_at).not.toBeNull();
    expect(finalizedGoal.metrics.progressPercentage).toBe(100);
    expect(finalizedGoal.metrics.healthStatus).toBe('on_track');
  });

  // ============================================================================
  // Failure Cases & Edge Boundaries
  // ============================================================================
  describe('Failure cases, cross-tenant isolation, and invariant preservation', () => {
    it('rejects cross-tenant task creation linking to another user goal', async () => {
      // Alice creates a goal
      const aliceGoalRes = await app.inject({
        method: 'POST',
        url: '/api/v1/goals',
        payload: {
          title: 'Alice Private Goal',
          goal_type: 'learning',
          priority: 'medium',
          status: 'active',
        },
      });
      const aliceGoalId = JSON.parse(aliceGoalRes.body).data.id;

      // Switch context to Bob
      currentUserId = BOB_ID;

      // Bob tries to create a task linked to Alice's goal
      const bobTaskRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        payload: {
          title: 'Bob Unauthorized Task',
          goal_id: aliceGoalId,
        },
      });

      expect(bobTaskRes.statusCode).toBe(400);
      expect(JSON.parse(bobTaskRes.body).error.message).toContain('Goal not found or does not belong to the authenticated user');
    });

    it('rejects cross-tenant task dependency associations', async () => {
      // Alice creates task A
      const aliceTaskRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        payload: { title: 'Alice Task A' },
      });
      const aliceTaskId = JSON.parse(aliceTaskRes.body).data.id;

      // Switch context to Bob
      currentUserId = BOB_ID;

      // Bob creates task B
      const bobTaskRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        payload: { title: 'Bob Task B' },
      });
      const bobTaskId = JSON.parse(bobTaskRes.body).data.id;

      // Bob attempts to make his task depend on Alice's task
      const crossTenantDepRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${bobTaskId}/dependencies`,
        payload: { depends_on_task_id: aliceTaskId },
      });

      expect(crossTenantDepRes.statusCode).toBe(400);
      expect(JSON.parse(crossTenantDepRes.body).error.message).toContain('Prerequisite task not found or does not belong to the user');
    });

    it('rejects cross-tenant evidence linking to another user task', async () => {
      // Alice creates task
      const aliceTaskRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        payload: { title: 'Alice Task' },
      });
      const aliceTaskId = JSON.parse(aliceTaskRes.body).data.id;

      // Switch to Bob
      currentUserId = BOB_ID;

      // Bob tries to link evidence to Alice's task
      const bobEvidenceRes = await app.inject({
        method: 'POST',
        url: '/api/v1/evidence',
        payload: {
          evidence_type: 'task_completion',
          title: 'Bob Claiming Alice Task',
          links: [{ entity_type: 'task', entity_id: aliceTaskId }],
        },
      });

      expect(bobEvidenceRes.statusCode).toBe(403);
      expect(JSON.parse(bobEvidenceRes.body).error.message).toContain('not found or access denied');
    });

    it('rejects circular dependencies between tasks', async () => {
      const t1 = JSON.parse((await app.inject({ method: 'POST', url: '/api/v1/tasks', payload: { title: 'T1' } })).body).data;
      const t2 = JSON.parse((await app.inject({ method: 'POST', url: '/api/v1/tasks', payload: { title: 'T2' } })).body).data;

      // T2 depends on T1
      await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${t2.id}/dependencies`,
        payload: { depends_on_task_id: t1.id },
      });

      // Attempt T1 depends on T2 (would form a cycle T1 -> T2 -> T1)
      const cycleRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${t1.id}/dependencies`,
        payload: { depends_on_task_id: t2.id },
      });

      expect(cycleRes.statusCode).toBe(400);
      expect(JSON.parse(cycleRes.body).error.message).toMatch(/circular dependency/i);
    });

    it('rejects self dependencies', async () => {
      const t1 = JSON.parse((await app.inject({ method: 'POST', url: '/api/v1/tasks', payload: { title: 'Self Task' } })).body).data;

      const selfDepRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${t1.id}/dependencies`,
        payload: { depends_on_task_id: t1.id },
      });

      expect(selfDepRes.statusCode).toBe(400);
      expect(JSON.parse(selfDepRes.body).error.message).toContain('cannot depend on itself');
    });

    it('rejects duplicate dependency creation without duplicating records', async () => {
      const t1 = JSON.parse((await app.inject({ method: 'POST', url: '/api/v1/tasks', payload: { title: 'Parent' } })).body).data;
      const t2 = JSON.parse((await app.inject({ method: 'POST', url: '/api/v1/tasks', payload: { title: 'Child' } })).body).data;

      const firstDepRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${t2.id}/dependencies`,
        payload: { depends_on_task_id: t1.id },
      });
      expect(firstDepRes.statusCode).toBe(201);

      // Duplicate attempt
      const dupDepRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${t2.id}/dependencies`,
        payload: { depends_on_task_id: t1.id },
      });
      expect(dupDepRes.statusCode).toBe(400);
      expect(JSON.parse(dupDepRes.body).error.message).toContain('already exists');

      // Verify list still contains exactly 1 dependency
      const listDeps = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${t2.id}/dependencies`,
      });
      expect(JSON.parse(listDeps.body).data).toHaveLength(1);
    });

    it('leaves persisted task state consistent on failed status update', async () => {
      const t1 = JSON.parse((await app.inject({ method: 'POST', url: '/api/v1/tasks', payload: { title: 'Prereq' } })).body).data;
      const t2 = JSON.parse((await app.inject({ method: 'POST', url: '/api/v1/tasks', payload: { title: 'Blocked Task' } })).body).data;

      await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${t2.id}/dependencies`,
        payload: { depends_on_task_id: t1.id },
      });

      // Failed transition attempt with metadata update
      const failedRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${t2.id}`,
        payload: {
          title: 'Malicious Attempted Title',
          status: 'completed',
        },
      });
      expect(failedRes.statusCode).toBe(400);

      // Persisted title and status must remain completely unchanged
      const current = JSON.parse((await app.inject({ method: 'GET', url: `/api/v1/tasks/${t2.id}` })).body).data;
      expect(current.title).toBe('Blocked Task');
      expect(current.status).toBe('inbox');
    });
  });
});
