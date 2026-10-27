import {
  type ApplyScheduleInput,
  type ApplyScheduleResponseDto,
  isMinuteAligned,
  type ProposeScheduleInput,
  type ScheduleProposalResponseDto,
  type TaskPriority,
  type TaskType,
} from '@avenza/shared';
import type { IPreferencesRepository } from '../preferences/preferences.repository';
import { defaultPreferencesRepository } from '../preferences/preferences.repository';
import type { ITasksRepository } from '../tasks/tasks.types';
import { defaultTasksRepository } from '../tasks/tasks.repository';
import type { IIntegrationsRepository } from '../integrations/integrations.repository';
import { IntegrationsRepositoryImpl } from '../integrations/integrations.repository.impl';
import {
  type CandidateTaskForPlanning,
  type ExistingBusyInterval,
  generateScheduleProposal,
  parseLocalDateWithOffset,
} from './planner.engine';
import {
  type IPlannerRepository,
  defaultPlannerRepository,
} from './planner.repository';
import { getTodayBoundaries } from '../today/today.date-utils';

export class PlannerService {
  constructor(
    private readonly tasksRepo: ITasksRepository = defaultTasksRepository,
    private readonly preferencesRepo: IPreferencesRepository = defaultPreferencesRepository,
    private readonly integrationsRepo: IIntegrationsRepository = new IntegrationsRepositoryImpl(),
    private readonly plannerRepo: IPlannerRepository = defaultPlannerRepository
  ) {}

  /**
   * Generates a deterministic schedule proposal.
   * Strictly READ-ONLY: performs no database writes and does not change task statuses.
   */
  async proposeSchedule(
    userId: string,
    input: ProposeScheduleInput
  ): Promise<ScheduleProposalResponseDto> {
    // 1. Fetch user preferences
    const preferences = await this.preferencesRepo.ensurePreferences(userId);
    const timezone = preferences.timezone || 'UTC';

    if (!preferences.preferred_study_start || !preferences.preferred_study_end) {
      throw new Error(
        'Study window preferences (preferred_study_start and preferred_study_end) must be configured in user preferences before generating a schedule plan.'
      );
    }

    const studyStart = preferences.preferred_study_start.slice(0, 5);
    const studyEnd = preferences.preferred_study_end.slice(0, 5);

    if (studyStart >= studyEnd) {
      throw new Error(
        'Invalid study window: preferred_study_start must be strictly before preferred_study_end.'
      );
    }

    const dailyTargetMinutes = preferences.daily_target_minutes || 120;
    const maxDailyStudyMinutes = preferences.max_daily_study_minutes || null;

    // 2. Fetch tasks and dependencies
    const tasksResult = await this.tasksRepo.findTasks({
      userId,
      pageSize: 200,
    });

    const taskIds = tasksResult.data.map((t) => t.id);
    const summaries = await this.tasksRepo.getDependencySummariesForTasks(taskIds, userId);

    // Compute target date boundaries to identify existing commitments
    const boundaries = getTodayBoundaries(input.date, timezone);
    const dayStartMs = new Date(boundaries.startOfToday).getTime();
    const dayEndMs = new Date(boundaries.endOfToday).getTime();

    const existingCommitments: ExistingBusyInterval[] = [];
    const candidateTasks: CandidateTaskForPlanning[] = [];

    for (const t of tasksResult.data) {
      // Check if task is already scheduled on target date
      if (t.scheduled_start && t.scheduled_end) {
        const startMs = new Date(t.scheduled_start).getTime();
        const endMs = new Date(t.scheduled_end).getTime();

        // If it overlaps the target day
        if (startMs < dayEndMs && endMs > dayStartMs && t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'skipped') {
          existingCommitments.push({
            id: `task-sched-${t.id}`,
            title: t.title,
            source: 'task_scheduled',
            start: new Date(t.scheduled_start),
            end: new Date(t.scheduled_end),
            isAllDay: false,
            isBusy: true,
          });
          continue;
        }
      }

      // If not already scheduled on this day, evaluate as planning candidate
      const summary = summaries.get(t.id);
      const isBlocked = summary ? summary.uncompletedPrerequisites > 0 : false;

      candidateTasks.push({
        id: t.id,
        title: t.title,
        priority: t.priority as TaskPriority,
        task_type: t.task_type as TaskType,
        status: t.status,
        goal_id: t.goal_id,
        milestone_id: t.milestone_id,
        project_id: t.project_id,
        estimated_minutes: t.estimated_minutes,
        due_at: t.due_at,
        scheduled_start: t.scheduled_start,
        scheduled_end: t.scheduled_end,
        updated_at: t.updated_at,
        is_blocked: isBlocked,
        blocked_by: summary?.blockedBy,
      });
    }

    // 3. Fetch external Google Calendar events if connected
    let isExternalCalendarAvailable = false;
    try {
      const gcalConn = await this.integrationsRepo.getConnection(userId, 'google_calendar');
      if (gcalConn && gcalConn.status !== 'DISCONNECTED') {
        isExternalCalendarAvailable = true;
        const events = await this.integrationsRepo.listCalendarEvents(userId);

        for (const ev of events) {
          if (ev.status === 'confirmed' && ev.is_busy) {
            existingCommitments.push({
              id: `gcal-${ev.id}`,
              title: ev.title,
              source: 'google_calendar',
              start: new Date(ev.start_time),
              end: new Date(ev.end_time),
              isAllDay: ev.is_all_day,
              isBusy: true,
            });
          }
        }
      }
    } catch {
      isExternalCalendarAvailable = false;
    }

    // 4. Generate pure schedule proposal
    return generateScheduleProposal({
      targetDate: input.date,
      timezone,
      studyWindow: {
        start: studyStart,
        end: studyEnd,
      },
      dailyTargetMinutes,
      maxDailyStudyMinutes,
      candidateTasks,
      existingCommitments,
      isExternalCalendarAvailable,
    });
  }

  /**
   * Applies an approved schedule proposal atomically via PostgreSQL RPC.
   * Locks affected tasks, validates ownership, dependencies, and limits, and rolls back on failure.
   */
  async applySchedule(
    userId: string,
    input: ApplyScheduleInput
  ): Promise<ApplyScheduleResponseDto> {
    if (!input.blocks || input.blocks.length === 0) {
      throw new Error('At least one block must be provided to apply');
    }

    // 1. Validate study window and daily capacity against persisted user preferences
    const preferences = await this.preferencesRepo.ensurePreferences(userId);
    const timezone = preferences.timezone || 'UTC';

    if (!preferences.preferred_study_start || !preferences.preferred_study_end) {
      throw new Error(
        'Study window preferences (preferred_study_start and preferred_study_end) must be configured in user preferences before applying a schedule plan.'
      );
    }

    const studyStart = preferences.preferred_study_start.slice(0, 5);
    const studyEnd = preferences.preferred_study_end.slice(0, 5);

    if (studyStart >= studyEnd) {
      throw new Error(
        'Invalid study window: preferred_study_start must be strictly before preferred_study_end.'
      );
    }

    const windowStart = parseLocalDateWithOffset(input.targetDate, studyStart, timezone);
    const windowEnd = parseLocalDateWithOffset(input.targetDate, studyEnd, timezone);

    let totalAppliedMinutes = 0;

    for (const b of input.blocks) {
      if (!isMinuteAligned(b.scheduledStart) || !isMinuteAligned(b.scheduledEnd)) {
        throw new Error(
          `Schedule block timestamps for task ${b.taskId} must be aligned to whole-minute boundaries (zero seconds and fractional seconds).`
        );
      }

      const blockStart = new Date(b.scheduledStart);
      const blockEnd = new Date(b.scheduledEnd);

      if (blockStart.getTime() >= blockEnd.getTime()) {
        throw new Error(`Invalid block: scheduledStart must be strictly before scheduledEnd for task ${b.taskId}`);
      }

      if (blockStart.getTime() < windowStart.getTime() || blockEnd.getTime() > windowEnd.getTime()) {
        throw new Error(
          `Schedule block for task ${b.taskId} (${b.scheduledStart} - ${b.scheduledEnd}) is outside the user's configured study window (${studyStart} - ${studyEnd} ${timezone}).`
        );
      }

      const durationMs = blockEnd.getTime() - blockStart.getTime();
      if (durationMs % 60000 !== 0) {
        throw new Error(
          `Schedule block for task ${b.taskId} duration must be an exact number of minutes.`
        );
      }
      const durationMins = durationMs / 60000;

      // Verify duration integrity against persisted task estimate (or canonical 30m default)
      const task = await this.tasksRepo.findTaskById(b.taskId, userId);
      if (task) {
        const expectedDuration = (task.estimated_minutes && task.estimated_minutes > 0) ? task.estimated_minutes : 30;
        if (durationMins !== expectedDuration) {
          throw new Error(
            `Invalid block duration for task ${b.taskId}: scheduled duration (${durationMins}m) does not match task estimate (${expectedDuration}m).`
          );
        }
      }

      totalAppliedMinutes += durationMins;
    }

    if (
      preferences.max_daily_study_minutes !== null &&
      preferences.max_daily_study_minutes !== undefined &&
      totalAppliedMinutes > preferences.max_daily_study_minutes
    ) {
      throw new Error(
        `Total applied schedule duration (${totalAppliedMinutes}m) exceeds configured maximum daily study minutes (${preferences.max_daily_study_minutes}m).`
      );
    }

    const payload = input.blocks.map((b) => ({
      task_id: b.taskId,
      scheduled_start: b.scheduledStart,
      scheduled_end: b.scheduledEnd,
      expected_updated_at: b.expectedUpdatedAt,
    }));

    const result = await this.plannerRepo.applySchedule(userId, payload);

    return {
      success: true,
      appliedCount: result.applied_count,
      taskIds: result.task_ids,
      appliedAt: new Date().toISOString(),
    };
  }
}

export const defaultPlannerService = new PlannerService();
