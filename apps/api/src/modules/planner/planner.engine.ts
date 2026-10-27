import crypto from 'node:crypto';
import type {
  ProposedTaskBlockDto,
  ScheduleProposalResponseDto,
  TaskPriority,
  TaskType,
  UnscheduledReason,
  UnscheduledTaskDto,
  ExistingCommitmentDto,
} from '@avenza/shared';
import { getUtcInstantForLocalTime, isValidTimezone } from '../today/today.date-utils';

export interface CandidateTaskForPlanning {
  id: string;
  title: string;
  priority: TaskPriority;
  task_type: TaskType;
  status: string;
  goal_id?: string | null;
  goal_title?: string | null;
  milestone_id?: string | null;
  milestone_title?: string | null;
  project_id?: string | null;
  project_title?: string | null;
  estimated_minutes?: number | null;
  due_at?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  updated_at: string;
  is_blocked: boolean;
  blocked_by?: Array<{ id: string; title: string; status: string }>;
  candidate_score?: number;
  candidate_reason?: string;
}

export interface ExistingBusyInterval {
  id: string;
  title: string;
  source: 'task_scheduled' | 'google_calendar';
  start: Date;
  end: Date;
  isAllDay: boolean;
  isBusy: boolean;
}

export interface ScheduleEngineInput {
  targetDate: string; // YYYY-MM-DD
  timezone?: string | null;
  studyWindow: {
    start: string; // HH:mm or HH:mm:ss
    end: string;   // HH:mm or HH:mm:ss
  };
  dailyTargetMinutes: number;
  maxDailyStudyMinutes: number | null;
  candidateTasks: CandidateTaskForPlanning[];
  existingCommitments: ExistingBusyInterval[];
  isExternalCalendarAvailable: boolean;
}

interface TimeInterval {
  start: Date;
  end: Date;
}

function parseTimeParts(timeStr: string): { hour: number; minute: number } {
  const parts = timeStr.split(':');
  const hour = parseInt(parts[0] || '0', 10);
  const minute = parseInt(parts[1] || '0', 10);
  return { hour, minute };
}

export function parseLocalDateWithOffset(
  dateStr: string,
  timeStr: string,
  timezone: string
): Date {
  const dateParts = dateStr.split('-');
  const year = parseInt(dateParts[0] || '2026', 10);
  const month = parseInt(dateParts[1] || '1', 10);
  const day = parseInt(dateParts[2] || '1', 10);
  const timeParts = parseTimeParts(timeStr);
  return getUtcInstantForLocalTime(
    year,
    month,
    day,
    timeParts.hour,
    timeParts.minute,
    0,
    0,
    isValidTimezone(timezone) ? timezone : 'UTC'
  );
}

function priorityToNumber(p: TaskPriority): number {
  switch (p) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 2;
  }
}

/**
 * Deterministic Adaptive Planner Scheduling Engine.
 * Pure function: equivalent inputs produce identical outputs without database or external side effects.
 */
export function generateScheduleProposal(input: ScheduleEngineInput): ScheduleProposalResponseDto {
  const timezone =
    input.timezone && isValidTimezone(input.timezone) ? input.timezone : 'UTC';

  const dateParts = input.targetDate.split('-');
  const year = parseInt(dateParts[0] || '2026', 10);
  const month = parseInt(dateParts[1] || '1', 10);
  const day = parseInt(dateParts[2] || '1', 10);

  const startWindowParts = parseTimeParts(input.studyWindow.start);
  const endWindowParts = parseTimeParts(input.studyWindow.end);

  const windowStart = getUtcInstantForLocalTime(
    year,
    month,
    day,
    startWindowParts.hour,
    startWindowParts.minute,
    0,
    0,
    timezone
  );

  const windowEnd = getUtcInstantForLocalTime(
    year,
    month,
    day,
    endWindowParts.hour,
    endWindowParts.minute,
    0,
    0,
    timezone
  );

  const warnings: string[] = [];
  const proposedBlocks: ProposedTaskBlockDto[] = [];
  const unscheduledTasks: UnscheduledTaskDto[] = [];

  if (!input.isExternalCalendarAvailable) {
    warnings.push(
      'External Google Calendar is disconnected. Proposed schedule cannot verify conflicts against external calendar commitments.'
    );
  }

  // Study window validity check
  if (windowEnd.getTime() <= windowStart.getTime()) {
    warnings.push('Study window start time must be before end time.');
    return {
      proposalId: crypto.randomUUID(),
      targetDate: input.targetDate,
      timezone,
      studyWindow: {
        start: input.studyWindow.start,
        end: input.studyWindow.end,
      },
      dailyTargetMinutes: input.dailyTargetMinutes,
      maxDailyStudyMinutes: input.maxDailyStudyMinutes,
      totalProposedMinutes: 0,
      proposedBlocks: [],
      unscheduledTasks: input.candidateTasks.map((t) => ({
        taskId: t.id,
        title: t.title,
        priority: t.priority,
        estimatedMinutes: t.estimated_minutes,
        reason: 'NO_CONTIGUOUS_SLOT' as UnscheduledReason,
        reasonMessage: 'Study window is invalid or has 0 duration.',
      })),
      existingCommitments: [],
      isExternalCalendarAvailable: input.isExternalCalendarAvailable,
      warnings,
      generatedAt: new Date().toISOString(),
    };
  }

  // Day start and day end for all-day collision checking
  const dayStart = getUtcInstantForLocalTime(year, month, day, 0, 0, 0, 0, timezone);
  const dayEnd = getUtcInstantForLocalTime(year, month, day, 23, 59, 59, 999, timezone);

  // 1. Collect occupied intervals within the study window
  const rawOccupied: TimeInterval[] = [];
  const existingCommitmentDtos: ExistingCommitmentDto[] = [];

  for (const c of input.existingCommitments) {
    if (!c.isBusy) continue;

    if (c.isAllDay) {
      // If all-day event overlaps with target date
      if (c.start.getTime() <= dayEnd.getTime() && c.end.getTime() >= dayStart.getTime()) {
        rawOccupied.push({
          start: new Date(windowStart),
          end: new Date(windowEnd),
        });
        existingCommitmentDtos.push({
          id: c.id,
          title: c.title,
          source: c.source,
          start: c.start.toISOString(),
          end: c.end.toISOString(),
          isAllDay: true,
          isBusy: true,
        });
      }
    } else {
      // Timed busy event
      if (c.start.getTime() < windowEnd.getTime() && c.end.getTime() > windowStart.getTime()) {
        const clippedStart = c.start.getTime() < windowStart.getTime() ? windowStart : c.start;
        const clippedEnd = c.end.getTime() > windowEnd.getTime() ? windowEnd : c.end;

        rawOccupied.push({
          start: new Date(clippedStart),
          end: new Date(clippedEnd),
        });

        existingCommitmentDtos.push({
          id: c.id,
          title: c.title,
          source: c.source,
          start: c.start.toISOString(),
          end: c.end.toISOString(),
          isAllDay: false,
          isBusy: true,
        });
      }
    }
  }

  // 2. Sort and merge overlapping occupied intervals
  rawOccupied.sort((a, b) => a.start.getTime() - b.start.getTime());

  const mergedOccupied: TimeInterval[] = [];
  for (const interval of rawOccupied) {
    if (mergedOccupied.length === 0) {
      mergedOccupied.push({ start: new Date(interval.start), end: new Date(interval.end) });
    } else {
      const last = mergedOccupied[mergedOccupied.length - 1]!;
      if (interval.start.getTime() <= last.end.getTime()) {
        if (interval.end.getTime() > last.end.getTime()) {
          last.end = new Date(interval.end);
        }
      } else {
        mergedOccupied.push({ start: new Date(interval.start), end: new Date(interval.end) });
      }
    }
  }

  // 3. Compute available free intervals within study window
  const freeIntervals: TimeInterval[] = [];
  let currentCursor = new Date(windowStart);

  for (const occ of mergedOccupied) {
    if (occ.start.getTime() > currentCursor.getTime()) {
      freeIntervals.push({
        start: new Date(currentCursor),
        end: new Date(occ.start),
      });
    }
    if (occ.end.getTime() > currentCursor.getTime()) {
      currentCursor = new Date(occ.end);
    }
  }

  if (currentCursor.getTime() < windowEnd.getTime()) {
    freeIntervals.push({
      start: new Date(currentCursor),
      end: new Date(windowEnd),
    });
  }

  // 4. Candidate Validation and Classification
  const eligibleCandidates: Array<{
    task: CandidateTaskForPlanning;
    durationMinutes: number;
    isDurationDefaulted: boolean;
  }> = [];

  let hasDefaultedEstimates = false;

  for (const task of input.candidateTasks) {
    // A. Terminal and already completed states are ineligible
    if (
      task.status === 'completed' ||
      task.status === 'cancelled' ||
      task.status === 'skipped'
    ) {
      unscheduledTasks.push({
        taskId: task.id,
        title: task.title,
        priority: task.priority,
        estimatedMinutes: task.estimated_minutes,
        reason: 'INELIGIBLE_STATUS',
        reasonMessage: `Task is in terminal status '${task.status}' and cannot be scheduled.`,
      });
      continue;
    }

    // B. Blocked tasks with incomplete prerequisites cannot be scheduled
    if (task.is_blocked || (task.blocked_by && task.blocked_by.length > 0)) {
      unscheduledTasks.push({
        taskId: task.id,
        title: task.title,
        priority: task.priority,
        estimatedMinutes: task.estimated_minutes,
        reason: 'BLOCKED_BY_DEPENDENCY',
        reasonMessage: `Prerequisites incomplete (${task.blocked_by?.length || 1} blocking task(s)).`,
        blockedBy: task.blocked_by,
      });
      continue;
    }

    // C. Evaluate task duration
    let durationMinutes = 30;
    let isDurationDefaulted = false;

    if (task.estimated_minutes !== null && task.estimated_minutes !== undefined) {
      if (task.estimated_minutes <= 0) {
        unscheduledTasks.push({
          taskId: task.id,
          title: task.title,
          priority: task.priority,
          estimatedMinutes: task.estimated_minutes,
          reason: 'INVALID_ESTIMATE',
          reasonMessage: 'Task estimated duration must be greater than 0 minutes.',
        });
        continue;
      }
      durationMinutes = task.estimated_minutes;
    } else {
      // Default to 30 minutes provisionally
      durationMinutes = 30;
      isDurationDefaulted = true;
      hasDefaultedEstimates = true;
    }

    eligibleCandidates.push({
      task,
      durationMinutes,
      isDurationDefaulted,
    });
  }

  if (hasDefaultedEstimates) {
    warnings.push(
      'Some tasks were assigned a provisional 30-minute estimate. Review and adjust task estimates where appropriate.'
    );
  }

  // 5. Deterministic Ranking of Eligible Candidates
  eligibleCandidates.sort((a, b) => {
    // 1. Due date urgency score
    const getUrgencyScore = (t: CandidateTaskForPlanning): number => {
      if (!t.due_at) return 0;
      const dueTime = new Date(t.due_at).getTime();
      if (dueTime < dayStart.getTime()) return 40; // Overdue
      if (dueTime <= dayEnd.getTime()) return 30;  // Due on target date
      if (dueTime <= dayEnd.getTime() + 3 * 86400000) return 20; // Due within 3 days
      return 10;
    };

    const urgencyA = getUrgencyScore(a.task);
    const urgencyB = getUrgencyScore(b.task);
    if (urgencyA !== urgencyB) {
      return urgencyB - urgencyA;
    }

    // 2. Priority
    const priorityA = priorityToNumber(a.task.priority);
    const priorityB = priorityToNumber(b.task.priority);
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }

    // 3. Candidate Intelligence Score (if present)
    const scoreA = a.task.candidate_score ?? 0;
    const scoreB = b.task.candidate_score ?? 0;
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

    // 4. Stable tie-breaker 1: due date ascending (nulls last)
    if (a.task.due_at && b.task.due_at) {
      const diff = new Date(a.task.due_at).getTime() - new Date(b.task.due_at).getTime();
      if (diff !== 0) return diff;
    } else if (a.task.due_at && !b.task.due_at) {
      return -1;
    } else if (!a.task.due_at && b.task.due_at) {
      return 1;
    }

    // 5. Stable tie-breaker 2: task id lexicographically
    return a.task.id.localeCompare(b.task.id);
  });

  // 6. Placement into Free Intervals
  let totalProposedMinutes = 0;
  const effectiveTarget = input.dailyTargetMinutes;
  const maxCap = input.maxDailyStudyMinutes;
  const stoppingThreshold = maxCap !== null ? maxCap : effectiveTarget;

  for (const candidate of eligibleCandidates) {
    const { task, durationMinutes, isDurationDefaulted } = candidate;
    const taskDurationMs = durationMinutes * 60000;

    // Check capacity semantics:
    // If the planned work has already reached or exceeded the stopping threshold (maxCap if set, else dailyTarget), stop adding further tasks
    if (totalProposedMinutes >= stoppingThreshold) {
      unscheduledTasks.push({
        taskId: task.id,
        title: task.title,
        priority: task.priority,
        estimatedMinutes: task.estimated_minutes,
        reason: 'CAPACITY_REACHED',
        reasonMessage: maxCap !== null
          ? `Daily maximum study limit of ${maxCap} minutes reached.`
          : `Daily study target of ${effectiveTarget} minutes reached.`,
      });
      continue;
    }

    // If a hard max cap is configured, no task can cause the total planned time to exceed it
    if (maxCap !== null && totalProposedMinutes + durationMinutes > maxCap) {
      unscheduledTasks.push({
        taskId: task.id,
        title: task.title,
        priority: task.priority,
        estimatedMinutes: task.estimated_minutes,
        reason: 'CAPACITY_REACHED',
        reasonMessage: `Scheduling would exceed the daily maximum study limit (${maxCap} minutes).`,
      });
      continue;
    }

    // Find earliest contiguous free interval that fits this task
    let placed = false;
    for (const interval of freeIntervals) {
      const availableMs = interval.end.getTime() - interval.start.getTime();
      if (availableMs >= taskDurationMs) {
        const blockStart = new Date(interval.start);
        const blockEnd = new Date(interval.start.getTime() + taskDurationMs);

        // Advance interval start
        interval.start = blockEnd;

        proposedBlocks.push({
          taskId: task.id,
          title: task.title,
          scheduledStart: blockStart.toISOString(),
          scheduledEnd: blockEnd.toISOString(),
          durationMinutes,
          isDurationDefaulted,
          priority: task.priority,
          taskType: task.task_type,
          goalTitle: task.goal_title ?? null,
          projectTitle: task.project_title ?? null,
          score: task.candidate_score ?? priorityToNumber(task.priority) * 20,
          primaryReason: task.candidate_reason ?? 'High priority candidate matching available study window',
          expectedUpdatedAt: task.updated_at,
        });

        totalProposedMinutes += durationMinutes;
        placed = true;
        break;
      }
    }

    if (!placed) {
      unscheduledTasks.push({
        taskId: task.id,
        title: task.title,
        priority: task.priority,
        estimatedMinutes: task.estimated_minutes,
        reason: 'NO_CONTIGUOUS_SLOT',
        reasonMessage: `No contiguous free time slot of ${durationMinutes} minutes available in the study window.`,
      });
    }
  }

  return {
    proposalId: crypto.randomUUID(),
    targetDate: input.targetDate,
    timezone,
    studyWindow: {
      start: input.studyWindow.start,
      end: input.studyWindow.end,
    },
    dailyTargetMinutes: input.dailyTargetMinutes,
    maxDailyStudyMinutes: input.maxDailyStudyMinutes,
    totalProposedMinutes,
    proposedBlocks,
    unscheduledTasks,
    existingCommitments: existingCommitmentDtos,
    isExternalCalendarAvailable: input.isExternalCalendarAvailable,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
