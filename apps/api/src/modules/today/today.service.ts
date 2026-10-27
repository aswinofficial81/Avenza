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

import type { IProjectsRepository } from '../projects/projects.repository';
import { defaultProjectsRepository } from '../projects/projects.repository';

import {
  getTodayBoundaries,
  isValidTimezone,
  isBeforeIso,
  isWithinIntervalIso,
} from './today.date-utils';

import {
  calculateProductivityStreak,
  type ProductivityStreakSession,
} from './productivity-streak';

import type { ITodayService } from './today.types';

export class TodayService implements ITodayService {
  constructor(
    private readonly tasksRepository: ITasksRepository = defaultTasksRepository,
    private readonly goalsRepository: IGoalsRepository = defaultGoalsRepository,
    private readonly profileRepository: IProfileRepository = defaultProfileRepository,
    private readonly preferencesRepository: IPreferencesRepository = defaultPreferencesRepository,
    private readonly focusRepository: IFocusRepository = defaultFocusRepository,
    private readonly projectsRepository: IProjectsRepository = defaultProjectsRepository
  ) { }

  /**
   * Calculates a user's productivity streak using their complete task
   * and focus-session history.
   *
   * A calendar day qualifies when the user completes at least one task
   * or records at least 15 minutes of completed focus sessions.
   */
  private async getProductivityStreak(
    userId: string,
    timezone: string,
    targetDate: string
  ) {
    const completedTaskTimestamps: Array<string | null> = [];

    // Load all completed tasks using pagination so older activity isn't
    // silently excluded by the API's page-size limit.
    for (let page = 1; ; page++) {
      const result = await this.tasksRepository.findTasks({
        userId,
        status: 'completed',
        page,
        pageSize: 100,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });

      completedTaskTimestamps.push(
        ...result.data.map((task) => task.completed_at)
      );

      if (
        result.data.length === 0 ||
        page >= result.pagination.totalPages
      ) {
        break;
      }
    }

    const completedFocusSessions: ProductivityStreakSession[] = [];

    // Load completed focus sessions from all available history pages.
    for (let page = 1; ; page++) {
      const result = await this.focusRepository.findSessions({
        userId,
        status: 'completed',
        page,
        limit: 100,
      });

      completedFocusSessions.push(
        ...result.data.map((session) => ({
          ended_at: session.ended_at,
          actual_minutes: session.actual_minutes,
        }))
      );

      if (
        result.data.length === 0 ||
        page >= result.pagination.totalPages
      ) {
        break;
      }
    }

    return calculateProductivityStreak({
      targetDate,
      timezone,
      completedTaskTimestamps,
      completedFocusSessions,
    });
  }

  async getToday(
    userId: string,
    query?: TodayQueryInput
  ): Promise<TodayResponse> {
    // 1. Resolve user preferences and timezone.
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

    const boundaries = getTodayBoundaries(
      query?.date,
      effectiveTimezone
    );

    const {
      localDate,
      timeZone,
      startOfToday,
      endOfToday,
      endOfUpcoming,
    } = boundaries;

    // 2. Fetch user tasks for today's execution surface.
    const paginated = await this.tasksRepository.findTasks({
      userId,
      pageSize: 300,
      sortBy: 'created_at',
      sortOrder: 'desc',
    });

    const tasks = paginated.data;
    const taskIds = tasks.map((task) => task.id);

    // 3. Batch-fetch dependency summaries.
    const dependencySummaries =
      await this.tasksRepository.getDependencySummariesForTasks(
        taskIds,
        userId
      );

    // 4. Fetch goal and milestone titles for task context.
    const goalTitlesMap = new Map<string, string>();
    const milestoneTitlesMap = new Map<string, string>();

    const distinctGoalIds = Array.from(
      new Set(
        tasks
          .map((task) => task.goal_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (distinctGoalIds.length > 0) {
      const userGoals = await this.goalsRepository.findGoals({
        userId,
        pageSize: 100,
      });

      for (const goal of userGoals.data) {
        goalTitlesMap.set(goal.id, goal.title);
      }

      await Promise.all(
        distinctGoalIds.map(async (goalId) => {
          const milestones =
            await this.goalsRepository.findMilestonesByGoalId(
              goalId,
              userId
            );

          for (const milestone of milestones) {
            milestoneTitlesMap.set(milestone.id, milestone.title);
          }
        })
      );
    }

    // 5. Fetch project and project-milestone titles.
    const projectTitlesMap = new Map<string, string>();
    const projectMilestoneTitlesMap = new Map<string, string>();

    const distinctProjectIds = Array.from(
      new Set(
        tasks
          .map((task) => task.project_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (distinctProjectIds.length > 0) {
      await Promise.all(
        distinctProjectIds.map(async (projectId) => {
          const project =
            await this.projectsRepository.findProjectById(
              projectId,
              userId
            );

          if (project) {
            projectTitlesMap.set(project.id, project.title);
          }

          const milestones =
            await this.projectsRepository.findMilestonesByProjectId(
              projectId,
              userId
            );

          for (const milestone of milestones) {
            projectMilestoneTitlesMap.set(
              milestone.id,
              milestone.title
            );
          }
        })
      );
    }

    // 6. Enrich task rows with dependency, goal and project context.
    const enrichedTasks: TodayTaskItem[] = tasks.map((task) => {
      const dependencySummary =
        dependencySummaries.get(task.id) || {
          totalPrerequisites: 0,
          uncompletedPrerequisites: 0,
          blockedBy: [],
        };

      const isBlocked =
        dependencySummary.uncompletedPrerequisites > 0;

      const metrics = {
        is_blocked: isBlocked,
        blocking_task_count:
          dependencySummary.uncompletedPrerequisites,
        blocked_by: dependencySummary.blockedBy,
      };

      return {
        ...task,
        status: task.status as TaskStatus,
        priority: task.priority as TaskPriority,
        task_type: task.task_type as TaskType,
        goal_title: task.goal_id
          ? goalTitlesMap.get(task.goal_id) || null
          : null,
        milestone_title: task.milestone_id
          ? milestoneTitlesMap.get(task.milestone_id) || null
          : null,
        project_title: task.project_id
          ? projectTitlesMap.get(task.project_id) || null
          : null,
        project_milestone_title: task.project_milestone_id
          ? projectMilestoneTitlesMap.get(
            task.project_milestone_id
          ) || null
          : null,
        is_blocked: isBlocked,
        blocking_task_count:
          dependencySummary.uncompletedPrerequisites,
        blocked_by: dependencySummary.blockedBy,
        metrics,
      };
    });

    // 7. Partition tasks into today's sections.
    const overdue: TodayTaskItem[] = [];
    const dueToday: TodayTaskItem[] = [];
    const scheduledToday: TodayTaskItem[] = [];
    const upcoming: TodayTaskItem[] = [];
    const completedToday: TodayTaskItem[] = [];

    for (const task of enrichedTasks) {
      // Completed tasks appear in Completed Today only if their
      // completion timestamp falls within today's local boundaries.
      if (task.status === 'completed') {
        if (
          task.completed_at &&
          isWithinIntervalIso(
            task.completed_at,
            startOfToday,
            endOfToday
          )
        ) {
          completedToday.push(task);
        }

        continue;
      }

      // Inactive tasks don't appear in active execution sections.
      if (
        task.status === 'cancelled' ||
        task.status === 'skipped' ||
        task.status === 'deferred'
      ) {
        continue;
      }

      // Precedence 1: overdue tasks.
      if (
        task.due_at &&
        isBeforeIso(task.due_at, startOfToday)
      ) {
        overdue.push(task);
        continue;
      }

      // Precedence 2: tasks due today.
      if (
        task.due_at &&
        isWithinIntervalIso(
          task.due_at,
          startOfToday,
          endOfToday
        )
      ) {
        dueToday.push(task);
        continue;
      }

      // Precedence 3: tasks scheduled today.
      if (
        task.scheduled_start &&
        isWithinIntervalIso(
          task.scheduled_start,
          startOfToday,
          endOfToday
        )
      ) {
        scheduledToday.push(task);
        continue;
      }

      // Precedence 4: tasks due or scheduled in the next seven days.
      const isDueUpcoming =
        task.due_at &&
        new Date(task.due_at).getTime() >
        new Date(endOfToday).getTime() &&
        new Date(task.due_at).getTime() <=
        new Date(endOfUpcoming).getTime();

      const isScheduledUpcoming =
        task.scheduled_start &&
        new Date(task.scheduled_start).getTime() >
        new Date(endOfToday).getTime() &&
        new Date(task.scheduled_start).getTime() <=
        new Date(endOfUpcoming).getTime();

      if (isDueUpcoming || isScheduledUpcoming) {
        upcoming.push(task);
      }
    }

    // 8. Sort task sections deterministically.
    const priorityWeight: Record<TaskPriority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    overdue.sort((a, b) => {
      const aDue = a.due_at
        ? new Date(a.due_at).getTime()
        : 0;
      const bDue = b.due_at
        ? new Date(b.due_at).getTime()
        : 0;

      if (aDue !== bDue) {
        return aDue - bDue;
      }

      return priorityWeight[b.priority] -
        priorityWeight[a.priority];
    });

    dueToday.sort((a, b) => {
      const priorityDifference =
        priorityWeight[b.priority] -
        priorityWeight[a.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const aDue = a.due_at
        ? new Date(a.due_at).getTime()
        : 0;
      const bDue = b.due_at
        ? new Date(b.due_at).getTime()
        : 0;

      return aDue - bDue;
    });

    scheduledToday.sort((a, b) => {
      const aStart = a.scheduled_start
        ? new Date(a.scheduled_start).getTime()
        : 0;
      const bStart = b.scheduled_start
        ? new Date(b.scheduled_start).getTime()
        : 0;

      if (aStart !== bStart) {
        return aStart - bStart;
      }

      return priorityWeight[b.priority] -
        priorityWeight[a.priority];
    });

    upcoming.sort((a, b) => {
      const aTime = a.due_at || a.scheduled_start || '';
      const bTime = b.due_at || b.scheduled_start || '';

      return aTime.localeCompare(bTime);
    });

    completedToday.sort((a, b) => {
      const aTime = a.completed_at
        ? new Date(a.completed_at).getTime()
        : 0;
      const bTime = b.completed_at
        ? new Date(b.completed_at).getTime()
        : 0;

      return bTime - aTime;
    });

    // 9. Deterministic Next Up task selection.
    const overdueSet = new Set(
      overdue.map((task) => task.id)
    );
    const dueTodaySet = new Set(
      dueToday.map((task) => task.id)
    );
    const scheduledTodaySet = new Set(
      scheduledToday.map((task) => task.id)
    );

    const nextCandidates = enrichedTasks.filter((task) => {
      if (
        task.status === 'completed' ||
        task.status === 'cancelled' ||
        task.status === 'skipped' ||
        task.status === 'deferred'
      ) {
        return false;
      }

      return !task.is_blocked;
    });

    let nextTask: TodayTaskItem | null = null;

    if (nextCandidates.length > 0) {
      nextCandidates.sort((a, b) => {
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

        if (aTier !== bTier) {
          return aTier - bTier;
        }

        const priorityDifference =
          priorityWeight[b.priority] -
          priorityWeight[a.priority];

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        if (a.due_at && b.due_at) {
          const dueDifference =
            new Date(a.due_at).getTime() -
            new Date(b.due_at).getTime();

          if (dueDifference !== 0) {
            return dueDifference;
          }
        } else if (a.due_at && !b.due_at) {
          return -1;
        } else if (!a.due_at && b.due_at) {
          return 1;
        }

        if (
          a.scheduled_start &&
          b.scheduled_start
        ) {
          const scheduleDifference =
            new Date(a.scheduled_start).getTime() -
            new Date(b.scheduled_start).getTime();

          if (scheduleDifference !== 0) {
            return scheduleDifference;
          }
        } else if (a.scheduled_start && !b.scheduled_start) {
          return -1;
        } else if (!a.scheduled_start && b.scheduled_start) {
          return 1;
        }

        return (
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
        );
      });

      nextTask = nextCandidates[0] ?? null;
    }

    // 10. Calculate meaningful work and daily progress.
    const completedFocusSessions =
      await this.focusRepository.findCompletedSessionsBetween(
        userId,
        startOfToday,
        endOfToday
      );

    let focusMinutes = 0;
    const tasksWithFocusToday = new Set<string>();

    for (const session of completedFocusSessions) {
      if (
        session.actual_minutes &&
        session.actual_minutes > 0
      ) {
        focusMinutes += session.actual_minutes;
      }

      if (session.task_id) {
        tasksWithFocusToday.add(session.task_id);
      }
    }

    let fallbackTaskActualMinutes = 0;
    let estimatedMinutesWithoutActual = 0;

    for (const completed of completedToday) {
      // Avoid double-counting task time already recorded in focus sessions.
      if (tasksWithFocusToday.has(completed.id)) {
        continue;
      }

      if (
        completed.actual_minutes !== null &&
        completed.actual_minutes !== undefined
      ) {
        if (completed.actual_minutes > 0) {
          fallbackTaskActualMinutes +=
            completed.actual_minutes;
        }
      } else if (
        completed.estimated_minutes !== null &&
        completed.estimated_minutes !== undefined &&
        completed.estimated_minutes > 0
      ) {
        estimatedMinutesWithoutActual +=
          completed.estimated_minutes;
      }
    }

    const meaningfulMinutes =
      focusMinutes + fallbackTaskActualMinutes;

    const dailyMinimum =
      preferences?.daily_minimum_minutes ?? 30;
    const dailyTarget =
      preferences?.daily_target_minutes ?? 120;
    const maxDailyStudy =
      preferences?.max_daily_study_minutes ?? null;

    const minimumProgress =
      dailyMinimum <= 0
        ? 100
        : Math.min(
          100,
          Math.round(
            (meaningfulMinutes / dailyMinimum) * 100
          )
        );

    const targetProgress =
      dailyTarget <= 0
        ? 100
        : Math.min(
          100,
          Math.round(
            (meaningfulMinutes / dailyTarget) * 100
          )
        );

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

    // 11. Calculate the productivity streak for the user's local date.
    const productivityStreak =
      await this.getProductivityStreak(
        userId,
        timeZone,
        localDate
      );

    return {
      date: localDate,
      timezone: timeZone,
      summary,
      productivityStreak,
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