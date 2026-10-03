import type { ITasksRepository } from '../../tasks/tasks.types';
import { defaultTasksRepository } from '../../tasks/tasks.repository';
import type { IGoalsRepository } from '../../goals/goals.types';
import { defaultGoalsRepository } from '../../goals/goals.repository';
import type { IFocusRepository } from '../../focus/focus.types';
import { defaultFocusRepository } from '../../focus/focus.repository';
import type { IEvidenceRepository } from '../../evidence/evidence.types';
import { SupabaseEvidenceRepository } from '../../evidence/evidence.repository';
import type { IPreferencesRepository } from '../../preferences/preferences.repository';
import { defaultPreferencesRepository } from '../../preferences/preferences.repository';
import type { IProfileRepository } from '../../identity/profile.repository';
import { defaultProfileRepository } from '../../identity/profile.repository';
import {
  getTodayBoundaries,
  isValidTimezone,
} from '../../today/today.date-utils';
import type {
  EvidenceSummary,
  GoalStatus,
  MilestoneStatus,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '@avenza/shared';
import type {
  EvidenceContextItem,
  FocusContextItem,
  GoalContextItem,
  IntelligenceContext,
  MilestoneContextItem,
  TaskContextItem,
} from './context.types';

export interface ContextBuilderOptions {
  date?: string;
  timezone?: string;
  currentTime?: string;
}

export class IntelligenceContextBuilder {
  constructor(
    private readonly tasksRepository: ITasksRepository = defaultTasksRepository,
    private readonly goalsRepository: IGoalsRepository = defaultGoalsRepository,
    private readonly focusRepository: IFocusRepository = defaultFocusRepository,
    private readonly evidenceRepository: IEvidenceRepository = new SupabaseEvidenceRepository(),
    private readonly preferencesRepository: IPreferencesRepository = defaultPreferencesRepository,
    private readonly profileRepository: IProfileRepository = defaultProfileRepository
  ) {}

  async buildContext(
    userId: string,
    options?: ContextBuilderOptions
  ): Promise<IntelligenceContext> {
    // 1. Resolve effective timezone
    const [preferences, profile] = await Promise.all([
      this.preferencesRepository.findByUserId(userId).catch(() => null),
      this.profileRepository.findById(userId).catch(() => null),
    ]);

    let effectiveTimezone = 'UTC';
    if (options?.timezone && isValidTimezone(options.timezone)) {
      effectiveTimezone = options.timezone;
    } else if (preferences?.timezone && isValidTimezone(preferences.timezone)) {
      effectiveTimezone = preferences.timezone;
    } else if (profile?.timezone && isValidTimezone(profile.timezone)) {
      effectiveTimezone = profile.timezone;
    }

    const boundaries = getTodayBoundaries(options?.date, effectiveTimezone);
    const currentDate = boundaries.localDate;
    const currentTimeIso = options?.currentTime || (options?.date ? boundaries.startOfToday : new Date().toISOString());

    // 2. Fetch Active Goals & Milestones (bounded)
    const [goalsResult, tasksResult, allUserDeps, activeFocusSession, recentSessionsResult, recentEvidenceResult] =
      await Promise.all([
        this.goalsRepository.findGoals({ userId, status: 'active', pageSize: 50 }).catch(() => ({ data: [] })),
        this.tasksRepository.findTasks({
          userId,
          pageSize: 200,
          sortBy: 'created_at',
          sortOrder: 'desc',
        }),
        this.tasksRepository.getAllUserDependencies(userId).catch(() => []),
        this.focusRepository.findActiveSessionByUserId(userId).catch(() => null),
        this.focusRepository.findSessions({ userId, limit: 10, status: 'completed' }).catch(() => ({ data: [] })),
        this.evidenceRepository.findEvidence({ userId, limit: 10 }).catch(() => ({ data: [], summary: {} as unknown as EvidenceSummary })),
      ]);

    // Active goals mapping
    const activeGoals: GoalContextItem[] = goalsResult.data.map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status as GoalStatus,
      priority: typeof g.priority === 'number' ? g.priority : 1,
    }));

    // Fetch milestones for active goals
    const activeMilestones: MilestoneContextItem[] = [];
    if (activeGoals.length > 0) {
      const milestonePromises = activeGoals.map((g) =>
        this.goalsRepository.findMilestonesByGoalId(g.id, userId).catch(() => [])
      );
      const milestoneArrays = await Promise.all(milestonePromises);
      for (const mArray of milestoneArrays) {
        for (const m of mArray) {
          activeMilestones.push({
            id: m.id,
            goalId: m.goal_id,
            title: m.title,
            status: m.status as MilestoneStatus,
            target_date: m.target_date,
          });
        }
      }
    }

    // 3. Process Tasks
    const allTasks = tasksResult.data;
    const openTasksRaw = allTasks.filter(
      (t) => t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'skipped'
    );
    const openTaskIds = openTasksRaw.map((t) => t.id);

    // Dependencies batch summaries
    const depSummaries = await this.tasksRepository.getDependencySummariesForTasks(openTaskIds, userId);

    // Unblocks count map: how many open tasks depend on task X?
    const unblocksCountMap = new Map<string, number>();
    const openTaskIdSet = new Set(openTaskIds);

    for (const dep of allUserDeps) {
      // dep.task_id depends on dep.depends_on_task_id
      // If dep.task_id is an open task, then completing dep.depends_on_task_id unblocks work!
      if (openTaskIdSet.has(dep.task_id)) {
        const currentCount = unblocksCountMap.get(dep.depends_on_task_id) || 0;
        unblocksCountMap.set(dep.depends_on_task_id, currentCount + 1);
      }
    }

    const openTasks: TaskContextItem[] = openTasksRaw.map((t) => {
      const summary = depSummaries.get(t.id);
      const isBlocked = (summary ? summary.uncompletedPrerequisites > 0 : false) || t.status === 'blocked';
      const unblocksCount = unblocksCountMap.get(t.id) || 0;

      return {
        id: t.id,
        goal_id: t.goal_id,
        milestone_id: t.milestone_id,
        title: t.title,
        description: t.description,
        priority: t.priority as TaskPriority,
        task_type: t.task_type as TaskType,
        status: t.status as TaskStatus,
        due_at: t.due_at,
        scheduled_date: t.scheduled_start ? t.scheduled_start.slice(0, 10) : null,
        estimated_minutes: t.estimated_minutes,
        actual_minutes: t.actual_minutes || 0,
        is_blocked: isBlocked,
        unblocks_count: unblocksCount,
        created_at: t.created_at,
        updated_at: t.updated_at,
      };
    });

    const recentCompletedTasks: TaskContextItem[] = allTasks
      .filter((t) => t.status === 'completed')
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        goal_id: t.goal_id,
        milestone_id: t.milestone_id,
        title: t.title,
        description: t.description,
        priority: t.priority as TaskPriority,
        task_type: t.task_type as TaskType,
        status: t.status as TaskStatus,
        due_at: t.due_at,
        scheduled_date: t.scheduled_start ? t.scheduled_start.slice(0, 10) : null,
        estimated_minutes: t.estimated_minutes,
        actual_minutes: t.actual_minutes || 0,
        is_blocked: false,
        unblocks_count: 0,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));

    // 4. Process Focus Sessions
    const recentFocusSessions: FocusContextItem[] = recentSessionsResult.data.map((s) => ({
      id: s.id,
      task_id: s.task_id,
      session_type: s.session_type,
      status: s.status,
      started_at: s.started_at,
      ended_at: s.ended_at,
      actual_minutes: s.actual_minutes,
    }));

    const activeFocusSessionTaskId =
      activeFocusSession && activeFocusSession.status === 'active' ? activeFocusSession.task_id : null;

    // 5. Process Evidence
    const evidenceIds = recentEvidenceResult.data.map((e) => e.id);
    let evidenceLinks: Array<{ evidence_id: string; entity_type: string; entity_id: string }> = [];
    if (evidenceIds.length > 0) {
      evidenceLinks = await this.evidenceRepository.findLinksForEvidenceIds(evidenceIds).catch(() => []);
    }

    const evidenceTaskMap = new Map<string, string[]>();
    for (const link of evidenceLinks) {
      if (link.entity_type === 'task') {
        const list = evidenceTaskMap.get(link.evidence_id) || [];
        list.push(link.entity_id);
        evidenceTaskMap.set(link.evidence_id, list);
      }
    }

    const recentEvidence: EvidenceContextItem[] = recentEvidenceResult.data.map((e) => ({
      id: e.id,
      evidence_type: e.evidence_type,
      title: e.title,
      verification_status: e.verification_status,
      occurred_at: e.occurred_at,
      linked_task_ids: evidenceTaskMap.get(e.id) || [],
    }));

    return {
      userId,
      currentDate,
      currentTimeIso,
      timezone: effectiveTimezone,
      activeGoals,
      activeMilestones,
      openTasks,
      recentCompletedTasks,
      recentFocusSessions,
      recentEvidence,
      activeFocusSessionTaskId,
    };
  }
}
