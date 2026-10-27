import fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TaskRow } from '@avenza/shared';
import { registerErrorHandler } from '../../plugins/error-handler';
import { InMemoryGoalsRepository } from '../goals/goals.repository';
import { InMemoryProjectsRepository } from '../projects/projects.repository';
import { ProjectsService } from '../projects/projects.service';
import { ProjectsController } from '../projects/projects.controller';
import { createProjectsRoutes } from '../projects/projects.routes';
import { InMemoryTasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { createTasksRoutes } from './tasks.routes';
import { TodayService } from '../today/today.service';
import { TodayController } from '../today/today.controller';
import { createTodayRoutes } from '../today/today.routes';
import { InMemoryFocusRepository } from '../focus/focus.repository';
import { FocusService } from '../focus/focus.service';
import { FocusController } from '../focus/focus.controller';
import { createFocusRoutes } from '../focus/focus.routes';
import { InMemoryProfileRepository } from '../identity/profile.repository';
import { InMemoryPreferencesRepository } from '../preferences/preferences.repository';

describe('Phase 15C — Project Execution Integration (Tasks, Projects, Today, Focus)', () => {
  const aliceUserId = '11111111-1111-1111-1111-111111111111';
  const bobUserId = '22222222-2222-2222-2222-222222222222';

  let tasksRepo: InMemoryTasksRepository;
  let projectsRepo: InMemoryProjectsRepository;
  let goalsRepo: InMemoryGoalsRepository;
  let focusRepo: InMemoryFocusRepository;
  let profileRepo: InMemoryProfileRepository;
  let prefsRepo: InMemoryPreferencesRepository;

  let tasksService: TasksService;
  let tasksController: TasksController;
  let projectsService: ProjectsService;
  let projectsController: ProjectsController;
  let todayService: TodayService;
  let todayController: TodayController;
  let focusService: FocusService;
  let focusController: FocusController;

  let app: FastifyInstance;
  let currentAuthUserId: string = aliceUserId;

  let aliceProjectId: string;
  let aliceMilestone1Id: string;
  let aliceMilestone2Id: string;
  let bobProjectId: string;
  let bobMilestoneId: string;

  beforeEach(async () => {
    currentAuthUserId = aliceUserId;

    tasksRepo = new InMemoryTasksRepository();
    projectsRepo = new InMemoryProjectsRepository(tasksRepo.getTasksMap());
    goalsRepo = new InMemoryGoalsRepository();
    focusRepo = new InMemoryFocusRepository();
    profileRepo = new InMemoryProfileRepository();
    prefsRepo = new InMemoryPreferencesRepository();

    // Seed Alice & Bob profiles
    await profileRepo.createProfile({
      id: aliceUserId,
      clerk_user_id: 'clerk_alice',
      display_name: 'Alice Architect',
    });
    await profileRepo.createProfile({
      id: bobUserId,
      clerk_user_id: 'clerk_bob',
      display_name: 'Bob Builder',
    });

    tasksService = new TasksService(tasksRepo, goalsRepo, projectsRepo);
    tasksController = new TasksController(tasksService);

    projectsService = new ProjectsService(projectsRepo);
    projectsController = new ProjectsController(projectsService);

    todayService = new TodayService(
      tasksRepo,
      goalsRepo,
      profileRepo,
      prefsRepo,
      focusRepo,
      projectsRepo
    );
    todayController = new TodayController(todayService);

    focusService = new FocusService(focusRepo, tasksRepo, goalsRepo, projectsRepo);
    focusController = new FocusController(focusService);

    app = fastify();
    registerErrorHandler(app);

    const mockAuth = async (req: FastifyRequest) => {
      const augmentedReq = req as unknown as {
        profile: { id: string; clerk_user_id: string };
        auth: { profileId: string; clerkUserId: string };
      };
      augmentedReq.profile = { id: currentAuthUserId, clerk_user_id: `clerk_${currentAuthUserId}` };
      augmentedReq.auth = { profileId: currentAuthUserId, clerkUserId: `clerk_${currentAuthUserId}` };
    };

    app.register(createTasksRoutes({ requireAuthMiddleware: mockAuth, tasksController }));
    app.register(createProjectsRoutes({ requireAuthMiddleware: mockAuth, projectsController }));
    app.register(createTodayRoutes({ requireAuthMiddleware: mockAuth, todayController }));
    app.register(createFocusRoutes({ requireAuthMiddleware: mockAuth, focusController }));

    // Seed Alice's project & milestones
    const aliceProj = await projectsRepo.createProject({
      user_id: aliceUserId,
      title: 'Avenza Core Platform',
      slug: 'avenza-core-platform',
      status: 'in_progress',
      priority: 'high',
      project_type: 'software',
    });
    aliceProjectId = aliceProj.id;

    const ms1 = await projectsRepo.createMilestone({
      project_id: aliceProjectId,
      user_id: aliceUserId,
      title: 'Milestone Alpha',
      status: 'pending',
      order_index: 0,
    });
    aliceMilestone1Id = ms1.id;

    const ms2 = await projectsRepo.createMilestone({
      project_id: aliceProjectId,
      user_id: aliceUserId,
      title: 'Milestone Beta',
      status: 'pending',
      order_index: 1,
    });
    aliceMilestone2Id = ms2.id;

    // Seed Bob's project & milestone
    const bobProj = await projectsRepo.createProject({
      user_id: bobUserId,
      title: 'Bob Secret Project',
      slug: 'bob-secret-project',
      status: 'in_progress',
      priority: 'medium',
      project_type: 'software',
    });
    bobProjectId = bobProj.id;

    const bobMs = await projectsRepo.createMilestone({
      project_id: bobProjectId,
      user_id: bobUserId,
      title: 'Bob Milestone 1',
      status: 'pending',
      order_index: 0,
    });
    bobMilestoneId = bobMs.id;
  });

  // 1. Create standalone task
  it('1. creates a standalone task with project_id and project_milestone_id as null', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Review PR notes',
        priority: 'medium',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.project_id).toBeNull();
    expect(body.data.project_milestone_id).toBeNull();
  });

  // 2. Create project task
  it('2. creates a task attached directly to a project without a milestone', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Setup Redis caching',
        project_id: aliceProjectId,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.project_id).toBe(aliceProjectId);
    expect(body.data.project_milestone_id).toBeNull();
    expect(body.data.project_title).toBe('Avenza Core Platform');
  });

  // 3. Create milestone task
  it('3. creates a task attached to a project and a milestone', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Implement DB Migrations',
        project_id: aliceProjectId,
        project_milestone_id: aliceMilestone1Id,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.project_id).toBe(aliceProjectId);
    expect(body.data.project_milestone_id).toBe(aliceMilestone1Id);
    expect(body.data.project_title).toBe('Avenza Core Platform');
    expect(body.data.project_milestone_title).toBe('Milestone Alpha');
  });

  // 4. Update task project
  it('4. updates a standalone task to attach to a project', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: { title: 'Refactor logger' },
    });
    const taskId = createRes.json().data.id;

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      payload: { project_id: aliceProjectId },
    });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().data.project_id).toBe(aliceProjectId);
    expect(patchRes.json().data.project_title).toBe('Avenza Core Platform');
  });

  // 5. Update task milestone
  it('5. updates a project task to assign to a project milestone', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: { title: 'Implement endpoints', project_id: aliceProjectId },
    });
    const taskId = createRes.json().data.id;

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      payload: { project_milestone_id: aliceMilestone1Id },
    });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().data.project_milestone_id).toBe(aliceMilestone1Id);
    expect(patchRes.json().data.project_milestone_title).toBe('Milestone Alpha');
  });

  // 6. Move task between milestones
  it('6. moves a task between milestones within the same project', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Integration tests',
        project_id: aliceProjectId,
        project_milestone_id: aliceMilestone1Id,
      },
    });
    const taskId = createRes.json().data.id;

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      payload: { project_milestone_id: aliceMilestone2Id },
    });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().data.project_milestone_id).toBe(aliceMilestone2Id);
    expect(patchRes.json().data.project_milestone_title).toBe('Milestone Beta');
  });

  // 7. Remove project association
  it('7. removes project association by setting project_id to null (also unlinks milestone)', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Explore AI SDK',
        project_id: aliceProjectId,
        project_milestone_id: aliceMilestone1Id,
      },
    });
    const taskId = createRes.json().data.id;

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      payload: { project_id: null },
    });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().data.project_id).toBeNull();
    expect(patchRes.json().data.project_milestone_id).toBeNull();
  });

  // 8. Remove milestone association
  it('8. removes milestone association by setting project_milestone_id to null (keeps project)', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Backend optimizations',
        project_id: aliceProjectId,
        project_milestone_id: aliceMilestone1Id,
      },
    });
    const taskId = createRes.json().data.id;

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      payload: { project_milestone_id: null },
    });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().data.project_id).toBe(aliceProjectId);
    expect(patchRes.json().data.project_milestone_id).toBeNull();
  });

  // 9. Cross-user project rejection
  it('9. rejects attaching a task to another user project (IDOR)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Unauthorized project task',
        project_id: bobProjectId,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  // 10. Cross-user milestone rejection
  it('10. rejects attaching a task to another user milestone', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Unauthorized milestone task',
        project_id: aliceProjectId,
        project_milestone_id: bobMilestoneId,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  // 11. Cross-project milestone rejection
  it('11. rejects assigning a milestone that belongs to a different project', async () => {
    // Create second project for Alice
    const aliceProj2 = await projectsRepo.createProject({
      user_id: aliceUserId,
      title: 'Alice Other Project',
      slug: 'alice-other-project',
      status: 'in_progress',
      priority: 'low',
      project_type: 'software',
    });
    const msOther = await projectsRepo.createMilestone({
      project_id: aliceProj2.id,
      user_id: aliceUserId,
      title: 'Other Milestone',
      status: 'pending',
      order_index: 0,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Mismatched project and milestone',
        project_id: aliceProjectId,
        project_milestone_id: msOther.id,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  // 12. Project deletion preserves task
  it('12. deletes project and preserves tasks with project_id and project_milestone_id set to null', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Persistent task',
        project_id: aliceProjectId,
        project_milestone_id: aliceMilestone1Id,
      },
    });
    const taskId = createRes.json().data.id;

    // Delete Alice's project
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${aliceProjectId}`,
    });
    expect(delRes.statusCode).toBe(200);

    // Verify task survives
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks/${taskId}`,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().data.id).toBe(taskId);
    expect(getRes.json().data.project_id).toBeNull();
    expect(getRes.json().data.project_milestone_id).toBeNull();
  });

  // 13. Milestone deletion preserves task
  it('13. deletes milestone and preserves tasks with project_milestone_id set to null (project_id retained)', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Milestone surviving task',
        project_id: aliceProjectId,
        project_milestone_id: aliceMilestone1Id,
      },
    });
    const taskId = createRes.json().data.id;

    // Delete Alice's milestone 1
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${aliceProjectId}/milestones/${aliceMilestone1Id}`,
    });
    expect(delRes.statusCode).toBe(200);

    // Verify task survives and project_id is retained
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks/${taskId}`,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().data.id).toBe(taskId);
    expect(getRes.json().data.project_id).toBe(aliceProjectId);
    expect(getRes.json().data.project_milestone_id).toBeNull();
  });

  // 14. Today includes project tasks
  it('14. includes project tasks in Today plan with project and milestone metadata', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Execute today project task',
        project_id: aliceProjectId,
        project_milestone_id: aliceMilestone1Id,
        status: 'inbox',
        due_at: `${todayStr}T18:00:00Z`,
      },
    });

    const todayRes = await app.inject({
      method: 'GET',
      url: `/api/v1/today?date=${todayStr}`,
    });

    expect(todayRes.statusCode).toBe(200);
    const body = todayRes.json();
    expect(body.success).toBe(true);

    const taskInToday = body.data.dueToday.find((t: TaskRow) => t.title === 'Execute today project task');
    expect(taskInToday).toBeDefined();
    expect(taskInToday.project_id).toBe(aliceProjectId);
    expect(taskInToday.project_title).toBe('Avenza Core Platform');
    expect(taskInToday.project_milestone_title).toBe('Milestone Alpha');
  });

  // 15. Focus accepts project tasks
  it('15. allows starting a focus session on a project task and enriches session context', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Deep work on project module',
        project_id: aliceProjectId,
        project_milestone_id: aliceMilestone1Id,
      },
    });
    const taskId = createRes.json().data.id;

    const focusRes = await app.inject({
      method: 'POST',
      url: '/api/v1/focus-sessions',
      payload: {
        taskId,
        plannedMinutes: 45,
        sessionType: 'deep_work',
      },
    });

    expect(focusRes.statusCode).toBe(201);
    const body = focusRes.json();
    expect(body.success).toBe(true);
    expect(body.data.task_id).toBe(taskId);
    expect(body.data.task.project_title).toBe('Avenza Core Platform');
    expect(body.data.task.project_milestone_title).toBe('Milestone Alpha');
  });

  // 16. Task completion does not auto-complete milestone
  it('16. completing a task does NOT automatically complete its project milestone', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Finish milestone task',
        project_id: aliceProjectId,
        project_milestone_id: aliceMilestone1Id,
      },
    });
    const taskId = createRes.json().data.id;

    // Complete the task
    const completeRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      payload: { status: 'completed' },
    });
    expect(completeRes.statusCode).toBe(200);

    // Verify milestone is still pending
    const ms = await projectsRepo.findMilestoneById(aliceMilestone1Id, aliceProjectId, aliceUserId);
    expect(ms).not.toBeNull();
    expect(ms?.status).toBe('pending');
    expect(ms?.completed_at).toBeNull();
  });

  // 17. Task completion does not auto-complete project
  it('17. completing a task does NOT automatically complete the project', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Finish main project task',
        project_id: aliceProjectId,
      },
    });
    const taskId = createRes.json().data.id;

    await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      payload: { status: 'completed' },
    });

    const proj = await projectsRepo.findProjectById(aliceProjectId, aliceUserId);
    expect(proj).not.toBeNull();
    expect(proj?.status).toBe('in_progress');
  });

  // 18. Milestone completion does not auto-complete tasks
  it('18. completing a milestone does NOT automatically complete its tasks', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Pending subtask',
        project_id: aliceProjectId,
        project_milestone_id: aliceMilestone1Id,
        status: 'in_progress',
      },
    });
    const taskId = createRes.json().data.id;

    // Complete the milestone explicitly
    const patchMsRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${aliceProjectId}/milestones/${aliceMilestone1Id}`,
      payload: { status: 'completed' },
    });
    expect(patchMsRes.statusCode).toBe(200);

    // Verify task status is still in_progress
    const task = await tasksRepo.findTaskById(taskId, aliceUserId);
    expect(task).not.toBeNull();
    expect(task?.status).toBe('in_progress');
    expect(task?.completed_at).toBeNull();
  });

  // 19. Progress regression tests (Case 1, Case 2, Case 3)
  it('19. verifies deterministic metric calculation cases 1, 2, and 3', async () => {
    // Case 1: Milestones exist -> progress is strictly based on completed milestones
    // Alice's project has 2 milestones (both pending -> 0% progress)
    let detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${aliceProjectId}`,
    });
    expect(detailRes.json().data.metrics.progressPercentage).toBe(0);

    // Add 10 completed tasks to aliceProjectId
    for (let i = 0; i < 5; i++) {
      await tasksRepo.createTask({
        user_id: aliceUserId,
        title: `Task ${i}`,
        status: 'completed',
        project_id: aliceProjectId,
      });
    }

    // Milestones still pending, so progress must still be 0%
    detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${aliceProjectId}`,
    });
    expect(detailRes.json().data.metrics.progressPercentage).toBe(0);

    // Complete 1 of 2 milestones -> progress becomes 50%
    await projectsRepo.updateMilestone(aliceMilestone1Id, aliceProjectId, aliceUserId, {
      status: 'completed',
    });
    detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${aliceProjectId}`,
    });
    expect(detailRes.json().data.metrics.progressPercentage).toBe(50);

    // Case 2: Project has NO milestones -> progress is based on completed tasks
    const taskOnlyProj = await projectsRepo.createProject({
      user_id: aliceUserId,
      title: 'Task-Only Project',
      slug: 'task-only-project',
      status: 'in_progress',
      priority: 'medium',
      project_type: 'software',
    });

    await tasksRepo.createTask({
      user_id: aliceUserId,
      title: 'T1',
      status: 'completed',
      project_id: taskOnlyProj.id,
    });
    await tasksRepo.createTask({
      user_id: aliceUserId,
      title: 'T2',
      status: 'in_progress',
      project_id: taskOnlyProj.id,
    });

    const taskOnlyRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${taskOnlyProj.id}`,
    });
    // 1 completed / 2 total = 50%
    expect(taskOnlyRes.json().data.metrics.progressPercentage).toBe(50);

    // Case 3: Project has neither milestones nor tasks
    const emptyProj = await projectsRepo.createProject({
      user_id: aliceUserId,
      title: 'Empty Project',
      slug: 'empty-project',
      status: 'planning',
      priority: 'low',
      project_type: 'custom',
    });
    const emptyRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${emptyProj.id}`,
    });
    expect(emptyRes.json().data.metrics.progressPercentage).toBe(0);

    // Completed empty project -> 100%
    await projectsRepo.updateProject(emptyProj.id, aliceUserId, { status: 'completed' });
    const emptyCompletedRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${emptyProj.id}`,
    });
    expect(emptyCompletedRes.json().data.metrics.progressPercentage).toBe(100);
  });

  // 20. Project Task Queries (filtering & grouping)
  it('20. queries tasks by project and milestone via dedicated endpoints and query parameters', async () => {
    // Create tasks for milestone 1 and milestone 2
    await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Task M1',
        project_id: aliceProjectId,
        project_milestone_id: aliceMilestone1Id,
        status: 'inbox',
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Task M2',
        project_id: aliceProjectId,
        project_milestone_id: aliceMilestone2Id,
        status: 'in_progress',
      },
    });

    // GET /api/v1/projects/:id/tasks
    const projTasksRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${aliceProjectId}/tasks`,
    });
    expect(projTasksRes.statusCode).toBe(200);
    expect(projTasksRes.json().data.length).toBeGreaterThanOrEqual(2);

    // Filter by milestone
    const m1TasksRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${aliceProjectId}/milestones/${aliceMilestone1Id}/tasks`,
    });
    expect(m1TasksRes.statusCode).toBe(200);
    expect(m1TasksRes.json().data.every((t: TaskRow) => t.project_milestone_id === aliceMilestone1Id)).toBe(true);

    // Filter via GET /api/v1/tasks?project_id=...&project_milestone_id=...
    const globalTasksFilterRes = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks?project_id=${aliceProjectId}&project_milestone_id=${aliceMilestone2Id}`,
    });
    expect(globalTasksFilterRes.statusCode).toBe(200);
    expect(globalTasksFilterRes.json().data.length).toBe(1);
    expect(globalTasksFilterRes.json().data[0].title).toBe('Task M2');
  });
});
