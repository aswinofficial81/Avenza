import type {
  TodayQueryInput,
  TodayResponse,
  TodaySummary,
  TodayTaskItem,
  TaskStatus,
  TaskPriority,
  TaskType,
} from '@avenza/shared';
import type { ITasksRepository } from '../tasks/tasks.types';
import { defaultTasksRepository } from '../tasks/tasks.repository';
import type { IGoalsRepository } from '../goals/goals.types';
import { defaultGoalsRepository } from '../goals/goals.repository';
import type { IProfileRepository } from '../identity/profile.repository';
import { defaultProfileRepository } from '../identity/profile.repository';
import type { IPreferencesRepository } from '../preferences/preferences.repository';
import { defaultPreferencesRepository } from '../preferences/preferences.repository';
import type { IFocusRepository } from '../focus/focus.types';
import { defaultFocusRepository } from '../focus/focus.repository';
import {
  getTodayBoundaries,
  isValidTimezone,
  isBeforeIso,
  isWithinIntervalIso,
} from './today.date-utils';
import type { ITodayService } from './today.types';

export class TodayService implements ITodayService {
  constructor(
    private readonly tasksRepository: ITasksRepository = defaultTasksRepository,
    private readonly goalsRepository: IGoalsRepository = defaultGoalsRepository,
    private readonly profileRepository: IProfileRepository = defaultProfileRepository,
    private readonly preferencesRepository: IPreferencesRepository = defaultPreferencesRepository,
    private readonly focusRepository: IFocusRepository = defaultFocusRepository
  ) {}

  async getToday(userId: string, query?: TodayQueryInput): Promise<TodayResponse> {
    // 1. Resolve User Preferences & Timezone
    const [preferences, profile] = await Promise.all([
      this.preferencesRepository.findByUserId(userId),
      this.profileRepository.findById(userId),
    ]);

    let effectiveTimezone = 'UTC';
    if (preferences?.timezone && isValidTimezone(preferences.timezone)) {
      effectiveTimezone = preferences.timezone;
    } else if (profile?.timezone && isValidTimezone(profile.timezone)) {
      effectiveTimezone = profile.timezone;
    } else if (query?.timezone && isValidTimezone(query.timezone)) {
      effectiveTimezone = query.timezone;
    }

    const boundaries = getTodayBoundaries(query?.date, effectiveTimezone);
    const { localDate, timeZone, startOfToday, endOfToday, endOfUpcoming } = boundaries;

    // 2. Fetch User Tasks (up to 300 to cover overdue, scheduled, and completed today)
    const paginated = await this.tasksRepository.findTasks({
      userId,
      pageSize: 300,
      sortBy: 'created_at',
      sortOrder: 'desc',
    });

    const tasks = paginated.data;
    const taskIds = tasks.map((t) => t.id);

    // 3. Batch fetch dependency summaries (blocked derivation)
    const dependencySummaries = await this.tasksRepository.getDependencySummariesForTasks(
      taskIds,
      userId
    );

    // 4. Batch fetch Goal & Milestone titles for context
    const goalTitlesMap = new Map<string, string>();
    const milestoneTitlesMap = new Map<string, string>();

    const distinctGoalIds = Array.from(
      new Set(tasks.map((t) => t.goal_id).filter((id): id is string => Boolean(id)))
    );

    if (distinctGoalIds.length > 0) {
      const userGoals = await this.goalsRepository.findGoals({ userId, pageSize: 100 });
      for (const g of userGoals.data) {
        goalTitlesMap.set(g.id, g.title);
      }

      // Fetch milestones for attached goals
      await Promise.all(
        distinctGoalIds.map(async (gId) => {
          const milestones = await this.goalsRepository.findMilestonesByGoalId(gId, userId);
          for (const m of milestones) {
            milestoneTitlesMap.set(m.id, m.title);
          }
        })
      );
    }

    // 5. Transform TaskRow -> TodayTaskItem with blocked status and titles
    const enrichedTasks: TodayTaskItem[] = tasks.map((task) => {
      const depSummary = dependencySummaries.get(task.id) || {
        totalPrerequisites: 0,
        uncompletedPrerequisites: 0,
        blockedBy: [],
      };

      const isBlocked = depSummary.uncompletedPrerequisites > 0;
      const metrics = {
        is_blocked: isBlocked,
        blocking_task_count: depSummary.uncompletedPrerequisites,
        blocked_by: depSummary.blockedBy,
      };

      return {
        ...task,
        status: task.status as TaskStatus,
        priority: task.priority as TaskPriority,
        task_type: task.task_type as TaskType,
        goal_title: task.goal_id ? goalTitlesMap.get(task.goal_id) || null : null,
        milestone_title: task.milestone_id
          ? milestoneTitlesMap.get(task.milestone_id) || null
          : null,
        is_blocked: isBlocked,
        blocking_task_count: depSummary.uncompletedPrerequisites,
        blocked_by: depSummary.blockedBy,
        metrics,
      };
    });

    // 6. Partition tasks into Today sections with strict deterministic precedence
    const overdue: TodayTaskItem[] = [];
    const dueToday: TodayTaskItem[] = [];
    const scheduledToday: TodayTaskItem[] = [];
    const upcoming: TodayTaskItem[] = [];
    const completedToday: TodayTaskItem[] = [];

    for (const task of enrichedTasks) {
      // Completed Today: status completed AND completed_at falls within user's local day
      if (task.status === 'completed') {
        if (task.completed_at && isWithinIntervalIso(task.completed_at, startOfToday, endOfToday)) {
          completedToday.push(task);
        }
        continue; // Completed tasks are excluded from active execution sections
      }

      // Inactive tasks excluded from today's active execution sections
      if (task.status === 'cancelled' || task.status === 'skipped' || task.status === 'deferred') {
        continue;
      }

      // Precedence 1: Overdue (due before startOfToday)
      if (task.due_at && isBeforeIso(task.due_at, startOfToday)) {
        overdue.push(task);
        continue;
      }

      // Precedence 2: Due Today (due within startOfToday and endOfToday)
      if (task.due_at && isWithinIntervalIso(task.due_at, startOfToday, endOfToday)) {
        dueToday.push(task);
        continue;
      }

      // Precedence 3: Scheduled Today (scheduled start within startOfToday and endOfToday)
      if (
        task.scheduled_start &&
        isWithinIntervalIso(task.scheduled_start, startOfToday, endOfToday)
      ) {
        scheduledToday.push(task);
        continue;
      }

      // Precedence 4: Upcoming (due or scheduled start within next 7 days: endOfToday to endOfUpcoming)
      const isDueUpcoming =
        task.due_at &&
        new Date(task.due_at).getTime() > new Date(endOfToday).getTime() &&
        new Date(task.due_at).getTime() <= new Date(endOfUpcoming).getTime();

      const isScheduledUpcoming =
        task.scheduled_start &&
        new Date(task.scheduled_start).getTime() > new Date(endOfToday).getTime() &&
        new Date(task.scheduled_start).getTime() <= new Date(endOfUpcoming).getTime();

      if (isDueUpcoming || isScheduledUpcoming) {
        upcoming.push(task);
        continue;
      }
    }

    // 7. Sort sections
    const priorityWeight: Record<TaskPriority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    overdue.sort((a, b) => {
      // Earliest due date first, then priority desc
      const aDue = a.due_at ? new Date(a.due_at).getTime() : 0;
      const bDue = b.due_at ? new Date(b.due_at).getTime() : 0;
      if (aDue !== bDue) return aDue - bDue;
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });

    dueToday.sort((a, b) => {
      // Highest priority first, then earliest due date
      const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (pDiff !== 0) return pDiff;
      const aDue = a.due_at ? new Date(a.due_at).getTime() : 0;
      const bDue = b.due_at ? new Date(b.due_at).getTime() : 0;
      return aDue - bDue;
    });

    scheduledToday.sort((a, b) => {
      // Earliest scheduled start first, then priority desc
      const aStart = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
      const bStart = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
      if (aStart !== bStart) return aStart - bStart;
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });

    upcoming.sort((a, b) => {
      const aTime = a.due_at || a.scheduled_start || '';
      const bTime = b.due_at || b.scheduled_start || '';
      return aTime.localeCompare(bTime);
    });

    completedToday.sort((a, b) => {
      // Most recently completed first
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return bTime - aTime;
    });

    // 8. Deterministic "Next Up" Task Selection
    // Candidates: unblocked tasks from overdue, dueToday, scheduledToday, or upcoming
    // Must NOT be blocked!
    const overdueSet = new Set(overdue.map((t) => t.id));
    const dueTodaySet = new Set(dueToday.map((t) => t.id));
    const scheduledTodaySet = new Set(scheduledToday.map((t) => t.id));

    const nextCandidates = enrichedTasks.filter((t) => {
      if (t.status === 'completed' || t.status === 'cancelled' || t.status === 'skipped') {
        return false;
      }
      if (t.status === 'deferred') return false;
      if (t.is_blocked) return false;
      return true;
    });

    let nextTask: TodayTaskItem | null = null;
    if (nextCandidates.length > 0) {
      nextCandidates.sort((a, b) => {
        // 1. Source bucket tier:
        // overdue = 1, dueToday = 2, scheduledToday = 3, other = 4
        const aTier = overdueSet.has(a.id)
          ? 1
          : dueTodaySet.has(a.id)
            ? 2
            : scheduledTodaySet.has(a.id)
              ? 3
              : 4;
        const bTier = overdueSet.has(b.id)
          ? 1
          : dueTodaySet.has(b.id)
            ? 2
            : scheduledTodaySet.has(b.id)
              ? 3
              : 4;
        if (aTier !== bTier) return aTier - bTier;

        // 2. Priority: critical > high > medium > low
        const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (pDiff !== 0) return pDiff;

        // 3. Earliest due_at (nulls last)
        if (a.due_at && b.due_at) {
          const dDiff = new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
          if (dDiff !== 0) return dDiff;
        } else if (a.due_at && !b.due_at) {
          return -1;
        } else if (!a.due_at && b.due_at) {
          return 1;
        }

        // 4. Earliest scheduled_start (nulls last)
        if (a.scheduled_start && b.scheduled_start) {
          const sDiff =
            new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime();
          if (sDiff !== 0) return sDiff;
        } else if (a.scheduled_start && !b.scheduled_start) {
          return -1;
        } else if (!a.scheduled_start && b.scheduled_start) {
          return 1;
        }

        // 5. Earliest created_at
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      nextTask = nextCandidates[0] ?? null;
    }

    // 9. Calculate Meaningful Work & Progress Summary
    // Phase 8: Focus Sessions take precedence over task.actual_minutes.
    // Query completed focus sessions in user's local day [startOfToday, endOfToday]
    const completedFocusSessions = await this.focusRepository.findCompletedSessionsBetween(
      userId,
      startOfToday,
      endOfToday
    );

    let focusMinutes = 0;
    const tasksWithFocusToday = new Set<string>();

    for (const session of completedFocusSessions) {
      if (session.actual_minutes && session.actual_minutes > 0) {
        focusMinutes += session.actual_minutes;
      }
      if (session.task_id) {
        tasksWithFocusToday.add(session.task_id);
      }
    }

    let fallbackTaskActualMinutes = 0;
    let estimatedMinutesWithoutActual = 0;

    for (const completed of completedToday) {
      // If task had completed focus session(s) today, its execution is already captured in focusMinutes.
      // Do NOT double count task.actual_minutes!
      if (tasksWithFocusToday.has(completed.id)) {
        continue;
      }

      if (completed.actual_minutes !== null && completed.actual_minutes !== undefined) {
        if (completed.actual_minutes > 0) {
          fallbackTaskActualMinutes += completed.actual_minutes;
        }
      } else if (
        completed.estimated_minutes !== null &&
        completed.estimated_minutes !== undefined &&
        completed.estimated_minutes > 0
      ) {
        estimatedMinutesWithoutActual += completed.estimated_minutes;
      }
    }

    const meaningfulMinutes = focusMinutes + fallbackTaskActualMinutes;

    const dailyMinimum = preferences?.daily_minimum_minutes ?? 30;
    const dailyTarget = preferences?.daily_target_minutes ?? 120;
    const maxDailyStudy = preferences?.max_daily_study_minutes ?? null;

    const minimumProgress =
      dailyMinimum <= 0
        ? 100
        : Math.min(100, Math.round((meaningfulMinutes / dailyMinimum) * 100));

    const targetProgress =
      dailyTarget <= 0 ? 100 : Math.min(100, Math.round((meaningfulMinutes / dailyTarget) * 100));

    const summary: TodaySummary = {
      completedTaskCount: completedToday.length,
      meaningfulMinutes,
      focusMinutes,
      fallbackTaskActualMinutes,
      estimatedMinutesWithoutActual,
      dailyMinimum,
      dailyTarget,
      maxDailyStudy,
      minimumProgress,
      targetProgress,
    };

    return {
      date: localDate,
      timezone: timeZone,
      summary,
      next: nextTask,
      overdue,
      dueToday,
      scheduledToday,
      upcoming,
      completedToday,
    };
  }
}

export const defaultTodayService = new TodayService();
