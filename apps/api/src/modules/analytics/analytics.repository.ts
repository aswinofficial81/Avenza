import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnalyticsDsaSummary,
  AnalyticsExecutionSummary,
  AnalyticsFocusSummary,
  AnalyticsGrowthSummary,
  Database,
  DsaProblemDifficulty,
  TaskPriority,
  TaskType,
} from '@avenza/shared';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import type {
  AnalyticsDayBucket,
  IAnalyticsRepository,
} from './analytics.types';

const TASK_TYPES_LIST: TaskType[] = [
  'study',
  'practice',
  'revision',
  'assignment',
  'exam_preparation',
  'dsa',
  'project',
  'career',
  'administrative',
  'personal',
  'custom',
];

const OPEN_TASK_STATUSES = ['inbox', 'planned', 'scheduled', 'in_progress', 'deferred'] as const;
const ANALYTICS_PAGE_SIZE = 500;
const DSA_PROBLEM_ID_BATCH_SIZE = 200;

type AnalyticsPageResponse<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/**
 * Consume a stable, ordered Supabase query in bounded pages. Supabase/PostgREST
 * can cap a response at 1,000 rows; fetching rows without range pagination can
 * therefore silently undercount historical analytics for active users.
 */
async function forEachSupabasePage<T>(
  fetchPage: (from: number, to: number) => PromiseLike<AnalyticsPageResponse<T>>,
  visitRows: (rows: T[]) => void | Promise<void>,
  errorContext: string
): Promise<void> {
  for (let from = 0; ; from += ANALYTICS_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + ANALYTICS_PAGE_SIZE - 1);
    if (error) {
      throw new Error(`${errorContext}: ${error.message}`);
    }

    const rows = data ?? [];
    await visitRows(rows);
    if (rows.length < ANALYTICS_PAGE_SIZE) {
      return;
    }
  }
}

function findDayBucketIndex(
  timestampMs: number,
  bounds: Array<{ startMs: number; endMs: number }>
): number {
  let low = 0;
  let high = bounds.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const bound = bounds[mid];
    if (!bound) return -1;
    if (timestampMs < bound.startMs) high = mid - 1;
    else if (timestampMs >= bound.endMs) low = mid + 1;
    else return mid;
  }
  return -1;
}

export class SupabaseAnalyticsRepository implements IAnalyticsRepository {
  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) { }

  async getExecutionSummary(
    userId: string,
    startUtc: string,
    endUtc: string,
    asOf: string
  ): Promise<AnalyticsExecutionSummary> {
    // 1. Completed tasks within [startUtc, endUtc). Consume pages so the
    // configured PostgREST max_rows cannot truncate counts or breakdowns.
    let completedTaskCount = 0;

    const completedByPriority: Record<TaskPriority, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const completedByType: Record<TaskType, number> = {} as Record<TaskType, number>;
    for (const type of TASK_TYPES_LIST) {
      completedByType[type] = 0;
    }

    await forEachSupabasePage(
      (from, to) =>
        this.client
          .from('tasks')
          .select('id, priority, task_type, completed_at')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .gte('completed_at', startUtc)
          .lt('completed_at', endUtc)
          .order('id', { ascending: true })
          .range(from, to),
      (rows) => {
        completedTaskCount += rows.length;
        for (const row of rows) {
          if (row.priority && row.priority in completedByPriority) {
            completedByPriority[row.priority as TaskPriority]++;
          }
          if (row.task_type && row.task_type in completedByType) {
            completedByType[row.task_type as TaskType]++;
          }
        }
      },
      'Failed to query completed tasks for analytics'
    );

    // 2. Open tasks due within [startUtc, endUtc) (denominator term O)
    const { count: openDueCount, error: openErr } = await this.client
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', OPEN_TASK_STATUSES)
      .not('due_at', 'is', null)
      .gte('due_at', startUtc)
      .lt('due_at', endUtc);

    if (openErr) {
      throw new Error(`Failed to query open tasks due in period: ${openErr.message}`);
    }

    const openTasksDueInPeriodCount = openDueCount ?? 0;

    // 3. Completion rate calculation
    const denominator = completedTaskCount + openTasksDueInPeriodCount;
    const zeroDemand = denominator === 0;
    const completionRate = zeroDemand
      ? null
      : Math.round((completedTaskCount / denominator) * 1000) / 10;

    // 4. Current overdue backlog (snapshot as of asOf)
    const { count: overdueCount, error: overdueErr } = await this.client
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', OPEN_TASK_STATUSES)
      .not('due_at', 'is', null)
      .lt('due_at', asOf);

    if (overdueErr) {
      throw new Error(`Failed to query overdue tasks backlog: ${overdueErr.message}`);
    }

    return {
      completedTaskCount,
      openTasksDueInPeriodCount,
      completionRate,
      zeroDemand,
      currentOverdueCount: overdueCount ?? 0,
      completedByPriority,
      completedByType,
    };
  }

  async getFocusSummary(
    userId: string,
    startUtc: string,
    endUtc: string,
    dayBuckets: AnalyticsDayBucket[]
  ): Promise<AnalyticsFocusSummary> {
    // 1. Completed sessions in period. Process bounded pages, aggregating
    // directly into counters/buckets rather than retaining every history row.
    let completedSessionCount = 0;
    let recordedFocusMinutes = 0;
    const dailyDistribution = dayBuckets.map((bucket) => ({
      date: bucket.date,
      focusMinutes: 0,
      completedSessionCount: 0,
    }));
    const bucketBounds = dayBuckets.map((bucket) => ({
      startMs: new Date(bucket.startUtc).getTime(),
      endMs: new Date(bucket.endUtc).getTime(),
    }));

    await forEachSupabasePage(
      (from, to) =>
        this.client
          .from('focus_sessions')
          .select('id, actual_minutes, ended_at')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .gte('ended_at', startUtc)
          .lt('ended_at', endUtc)
          .order('ended_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      (rows) => {
        completedSessionCount += rows.length;
        for (const session of rows) {
          recordedFocusMinutes += session.actual_minutes || 0;
          if (!session.ended_at) continue;
          const bucketIndex = findDayBucketIndex(
            new Date(session.ended_at).getTime(),
            bucketBounds
          );
          if (bucketIndex >= 0) {
            const bucket = dailyDistribution[bucketIndex];
            if (bucket) {
              bucket.focusMinutes += session.actual_minutes || 0;
              bucket.completedSessionCount++;
            }
          }
        }
      },
      'Failed to query completed focus sessions'
    );

    const averageSessionMinutes =
      completedSessionCount > 0
        ? Math.round((recordedFocusMinutes / completedSessionCount) * 10) / 10
        : null;

    // 2. Cancelled sessions in period
    const { count: cancelledCount, error: cancelErr } = await this.client
      .from('focus_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'cancelled')
      .gte('ended_at', startUtc)
      .lt('ended_at', endUtc);

    if (cancelErr) {
      throw new Error(`Failed to query cancelled focus sessions: ${cancelErr.message}`);
    }

    return {
      recordedFocusMinutes,
      completedSessionCount,
      cancelledSessionCount: cancelledCount ?? 0,
      averageSessionMinutes,
      dailyDistribution,
    };
  }

  async getDsaSummary(
    userId: string,
    startUtc: string,
    endUtc: string,
    asOf: string
  ): Promise<AnalyticsDsaSummary> {
    // 1. Attempts in period. A bounded page size avoids silently truncating
    // high-volume users at Supabase/PostgREST's configured row limit.
    let totalAttempts = 0;
    const uniqueSolvedProblemIdsSet = new Set<string>();

    await forEachSupabasePage(
      (from, to) =>
        this.client
          .from('dsa_attempts')
          .select('id, problem_id, status, occurred_at')
          .eq('user_id', userId)
          .gte('occurred_at', startUtc)
          .lt('occurred_at', endUtc)
          .order('occurred_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      (rows) => {
        totalAttempts += rows.length;
        for (const attempt of rows) {
          if (attempt.status === 'solved') {
            uniqueSolvedProblemIdsSet.add(attempt.problem_id);
          }
        }
      },
      'Failed to query DSA attempts'
    );

    const uniqueSolvedProblemIds = Array.from(uniqueSolvedProblemIdsSet);
    const uniqueProblemsSolved = uniqueSolvedProblemIds.length;

    // 3. Solved by difficulty
    const solvedByDifficulty: Record<DsaProblemDifficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    // Keep the IN filter bounded to avoid oversized PostgREST URLs and ensure
    // no row cap can truncate a large set of unique solved problems.
    for (let i = 0; i < uniqueSolvedProblemIds.length; i += DSA_PROBLEM_ID_BATCH_SIZE) {
      const ids = uniqueSolvedProblemIds.slice(i, i + DSA_PROBLEM_ID_BATCH_SIZE);
      const { data: problems, error: probErr } = await this.client
        .from('dsa_problems')
        .select('id, difficulty')
        .eq('user_id', userId)
        .in('id', ids)
        .order('id', { ascending: true });

      if (probErr) {
        throw new Error(`Failed to query problem difficulties: ${probErr.message}`);
      }

      for (const problem of problems ?? []) {
        if (problem.difficulty in solvedByDifficulty) {
          solvedByDifficulty[problem.difficulty as DsaProblemDifficulty]++;
        }
      }
    }

    // 4. Current revision due backlog
    const { count: revCount, error: revErr } = await this.client
      .from('dsa_problems')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active')
      .not('next_review_at', 'is', null)
      .lte('next_review_at', asOf);

    if (revErr) {
      throw new Error(`Failed to query revision due backlog: ${revErr.message}`);
    }

    return {
      totalAttempts,
      uniqueProblemsSolved,
      solvedByDifficulty,
      currentRevisionDueCount: revCount ?? 0,
    };
  }

  async getGrowthSummary(
    userId: string,
    startUtc: string,
    endUtc: string
  ): Promise<AnalyticsGrowthSummary> {
    // 1. Evidence recorded during the period. `recorded_at` is the server-side
    // logging timestamp; `occurred_at` may intentionally be backdated by the user.
    const { count: evCount, error: evErr } = await this.client
      .from('evidence')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('recorded_at', startUtc)
      .lt('recorded_at', endUtc);

    if (evErr) {
      throw new Error(`Failed to query evidence count: ${evErr.message}`);
    }

    // 2. Completed goal milestones in period (scoped through user-owned goals).
    // Page goal IDs too: the goal list itself can exceed the PostgREST row cap.
    const goalIds: string[] = [];
    await forEachSupabasePage(
      (from, to) =>
        this.client
          .from('goals')
          .select('id')
          .eq('user_id', userId)
          .order('id', { ascending: true })
          .range(from, to),
      (rows) => {
        for (const goal of rows) goalIds.push(goal.id);
      },
      'Failed to query user goals'
    );

    let completedGoalMilestonesCount = 0;
    for (let i = 0; i < goalIds.length; i += DSA_PROBLEM_ID_BATCH_SIZE) {
      const ids = goalIds.slice(i, i + DSA_PROBLEM_ID_BATCH_SIZE);
      const { count: milestoneCount, error: milestoneErr } = await this.client
        .from('goal_milestones')
        .select('*', { count: 'exact', head: true })
        .in('goal_id', ids)
        .eq('status', 'completed')
        .gte('completed_at', startUtc)
        .lt('completed_at', endUtc);

      if (milestoneErr) {
        throw new Error(`Failed to query goal milestones: ${milestoneErr.message}`);
      }
      completedGoalMilestonesCount += milestoneCount ?? 0;
    }

    // 3. Completed project milestones in period
    const { count: pmCount, error: pmErr } = await this.client
      .from('project_milestones')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', startUtc)
      .lt('completed_at', endUtc);

    if (pmErr) {
      throw new Error(`Failed to query project milestones: ${pmErr.message}`);
    }

    // 4. Current active goals count
    const { count: activeGoalsCount, error: agErr } = await this.client
      .from('goals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (agErr) {
      throw new Error(`Failed to query active goals count: ${agErr.message}`);
    }

    return {
      newEvidenceCount: evCount ?? 0,
      completedGoalMilestonesCount,
      completedProjectMilestonesCount: pmCount ?? 0,
      currentActiveGoalsCount: activeGoalsCount ?? 0,
    };
  }
}

// ==============================================================================
// In-Memory Repository for Fast, Isolated Unit Testing
// ==============================================================================

export class InMemoryAnalyticsRepository implements IAnalyticsRepository {
  public tasks: Array<{
    id: string;
    user_id: string;
    status: string;
    priority: TaskPriority;
    task_type: TaskType;
    due_at: string | null;
    completed_at: string | null;
  }> = [];

  public focusSessions: Array<{
    id: string;
    user_id: string;
    status: string;
    actual_minutes: number | null;
    started_at: string;
    ended_at: string | null;
  }> = [];

  public dsaAttempts: Array<{
    id: string;
    user_id: string;
    problem_id: string;
    status: string;
    occurred_at: string;
  }> = [];

  public dsaProblems: Array<{
    id: string;
    user_id: string;
    difficulty: DsaProblemDifficulty;
    status: string;
    next_review_at: string | null;
  }> = [];

  public evidence: Array<{
    id: string;
    user_id: string;
    recorded_at: string;
  }> = [];

  public goals: Array<{
    id: string;
    user_id: string;
    status: string;
  }> = [];

  public goalMilestones: Array<{
    id: string;
    goal_id: string;
    status: string;
    completed_at: string | null;
  }> = [];

  public projectMilestones: Array<{
    id: string;
    user_id: string;
    status: string;
    completed_at: string | null;
  }> = [];

  async getExecutionSummary(
    userId: string,
    startUtc: string,
    endUtc: string,
    asOf: string
  ): Promise<AnalyticsExecutionSummary> {
    const startMs = new Date(startUtc).getTime();
    const endMs = new Date(endUtc).getTime();
    const asOfMs = new Date(asOf).getTime();

    const userTasks = this.tasks.filter((t) => t.user_id === userId);

    // Completed in period
    const completedTasks = userTasks.filter((t) => {
      if (t.status !== 'completed' || !t.completed_at) return false;
      const cMs = new Date(t.completed_at).getTime();
      return cMs >= startMs && cMs < endMs;
    });

    const completedTaskCount = completedTasks.length;

    const completedByPriority: Record<TaskPriority, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    const completedByType: Record<TaskType, number> = {} as Record<TaskType, number>;
    for (const type of TASK_TYPES_LIST) {
      completedByType[type] = 0;
    }

    for (const t of completedTasks) {
      if (t.priority in completedByPriority) completedByPriority[t.priority]++;
      if (t.task_type in completedByType) completedByType[t.task_type]++;
    }

    // Open tasks due in period
    const openTasks = userTasks.filter((t) => {
      if (!OPEN_TASK_STATUSES.includes(t.status as (typeof OPEN_TASK_STATUSES)[number])) {
        return false;
      }
      if (!t.due_at) return false;
      const dMs = new Date(t.due_at).getTime();
      return dMs >= startMs && dMs < endMs;
    });

    const openTasksDueInPeriodCount = openTasks.length;
    const denominator = completedTaskCount + openTasksDueInPeriodCount;
    const zeroDemand = denominator === 0;
    const completionRate = zeroDemand
      ? null
      : Math.round((completedTaskCount / denominator) * 1000) / 10;

    // Overdue backlog
    const overdueTasks = userTasks.filter((t) => {
      if (!OPEN_TASK_STATUSES.includes(t.status as (typeof OPEN_TASK_STATUSES)[number])) {
        return false;
      }
      if (!t.due_at) return false;
      const dMs = new Date(t.due_at).getTime();
      return dMs < asOfMs;
    });

    return {
      completedTaskCount,
      openTasksDueInPeriodCount,
      completionRate,
      zeroDemand,
      currentOverdueCount: overdueTasks.length,
      completedByPriority,
      completedByType,
    };
  }

  async getFocusSummary(
    userId: string,
    startUtc: string,
    endUtc: string,
    dayBuckets: AnalyticsDayBucket[]
  ): Promise<AnalyticsFocusSummary> {
    const startMs = new Date(startUtc).getTime();
    const endMs = new Date(endUtc).getTime();

    const userSessions = this.focusSessions.filter((s) => s.user_id === userId);

    const completedSessions = userSessions.filter((s) => {
      if (s.status !== 'completed' || !s.ended_at) return false;
      const eMs = new Date(s.ended_at).getTime();
      return eMs >= startMs && eMs < endMs;
    });

    const recordedFocusMinutes = completedSessions.reduce(
      (sum, s) => sum + (s.actual_minutes || 0),
      0
    );
    const completedSessionCount = completedSessions.length;
    const averageSessionMinutes =
      completedSessionCount > 0
        ? Math.round((recordedFocusMinutes / completedSessionCount) * 10) / 10
        : null;

    const cancelledSessions = userSessions.filter((s) => {
      if (s.status !== 'cancelled') return false;
      const t = s.ended_at || s.started_at;
      const tMs = new Date(t).getTime();
      return tMs >= startMs && tMs < endMs;
    });

    const dailyDistribution = dayBuckets.map((bucket) => {
      const bStartMs = new Date(bucket.startUtc).getTime();
      const bEndMs = new Date(bucket.endUtc).getTime();

      const daySessions = completedSessions.filter((s) => {
        const eMs = new Date(s.ended_at!).getTime();
        return eMs >= bStartMs && eMs < bEndMs;
      });

      const focusMinutes = daySessions.reduce((sum, s) => sum + (s.actual_minutes || 0), 0);
      return {
        date: bucket.date,
        focusMinutes,
        completedSessionCount: daySessions.length,
      };
    });

    return {
      recordedFocusMinutes,
      completedSessionCount,
      cancelledSessionCount: cancelledSessions.length,
      averageSessionMinutes,
      dailyDistribution,
    };
  }

  async getDsaSummary(
    userId: string,
    startUtc: string,
    endUtc: string,
    asOf: string
  ): Promise<AnalyticsDsaSummary> {
    const startMs = new Date(startUtc).getTime();
    const endMs = new Date(endUtc).getTime();
    const asOfMs = new Date(asOf).getTime();

    const userAttempts = this.dsaAttempts.filter((a) => {
      if (a.user_id !== userId) return false;
      const oMs = new Date(a.occurred_at).getTime();
      return oMs >= startMs && oMs < endMs;
    });

    const solvedAttempts = userAttempts.filter((a) => a.status === 'solved');
    const uniqueSolvedIds = Array.from(new Set(solvedAttempts.map((a) => a.problem_id)));

    const solvedByDifficulty: Record<DsaProblemDifficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    const userProblems = this.dsaProblems.filter((p) => p.user_id === userId);
    for (const pid of uniqueSolvedIds) {
      const prob = userProblems.find((p) => p.id === pid);
      if (prob && prob.difficulty in solvedByDifficulty) {
        solvedByDifficulty[prob.difficulty]++;
      }
    }

    const revisionDue = userProblems.filter((p) => {
      if (p.status !== 'active' || !p.next_review_at) return false;
      const nMs = new Date(p.next_review_at).getTime();
      return nMs <= asOfMs;
    });

    return {
      totalAttempts: userAttempts.length,
      uniqueProblemsSolved: uniqueSolvedIds.length,
      solvedByDifficulty,
      currentRevisionDueCount: revisionDue.length,
    };
  }

  async getGrowthSummary(
    userId: string,
    startUtc: string,
    endUtc: string
  ): Promise<AnalyticsGrowthSummary> {
    const startMs = new Date(startUtc).getTime();
    const endMs = new Date(endUtc).getTime();

    const userEvidence = this.evidence.filter((e) => {
      if (e.user_id !== userId) return false;
      const rMs = new Date(e.recorded_at).getTime();
      return rMs >= startMs && rMs < endMs;
    });

    const userGoalIds = this.goals.filter((g) => g.user_id === userId).map((g) => g.id);

    const completedGoalMilestones = this.goalMilestones.filter((m) => {
      if (!userGoalIds.includes(m.goal_id) || m.status !== 'completed' || !m.completed_at) {
        return false;
      }
      const cMs = new Date(m.completed_at).getTime();
      return cMs >= startMs && cMs < endMs;
    });

    const completedProjectMilestones = this.projectMilestones.filter((pm) => {
      if (pm.user_id !== userId || pm.status !== 'completed' || !pm.completed_at) {
        return false;
      }
      const cMs = new Date(pm.completed_at).getTime();
      return cMs >= startMs && cMs < endMs;
    });

    const activeGoals = this.goals.filter((g) => g.user_id === userId && g.status === 'active');

    return {
      newEvidenceCount: userEvidence.length,
      completedGoalMilestonesCount: completedGoalMilestones.length,
      completedProjectMilestonesCount: completedProjectMilestones.length,
      currentActiveGoalsCount: activeGoals.length,
    };
  }
}
