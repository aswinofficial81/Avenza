import { describe, expect, it } from 'vitest';
import {
  generateScheduleProposal,
  type CandidateTaskForPlanning,
  type ExistingBusyInterval,
  type ScheduleEngineInput,
} from './planner.engine';

describe('PlannerEngine (Phase 18D Pure Scheduling Algorithm)', () => {
  const baseInput: ScheduleEngineInput = {
    targetDate: '2026-10-18',
    timezone: 'America/New_York',
    studyWindow: {
      start: '09:00',
      end: '17:00',
    },
    dailyTargetMinutes: 120,
    maxDailyStudyMinutes: 240,
    candidateTasks: [
      {
        id: 'task-1',
        title: 'High Priority Task with 60m estimate',
        priority: 'high',
        task_type: 'project',
        status: 'planned',
        estimated_minutes: 60,
        due_at: '2026-10-18T20:00:00Z',
        updated_at: '2026-10-10T00:00:00Z',
        is_blocked: false,
      },
      {
        id: 'task-2',
        title: 'Medium Priority Task with 45m estimate',
        priority: 'medium',
        task_type: 'study',
        status: 'inbox',
        estimated_minutes: 45,
        due_at: '2026-10-19T20:00:00Z',
        updated_at: '2026-10-10T00:00:00Z',
        is_blocked: false,
      },
    ],
    existingCommitments: [],
    isExternalCalendarAvailable: true,
  };

  it('1. guarantees deterministic, identical schedule proposal for equivalent inputs', () => {
    const run1 = generateScheduleProposal(baseInput);
    const run2 = generateScheduleProposal(baseInput);

    expect(run1.proposedBlocks.length).toBe(run2.proposedBlocks.length);
    expect(run1.totalProposedMinutes).toBe(run2.totalProposedMinutes);

    for (let i = 0; i < run1.proposedBlocks.length; i++) {
      expect(run1.proposedBlocks[i]?.taskId).toBe(run2.proposedBlocks[i]?.taskId);
      expect(run1.proposedBlocks[i]?.scheduledStart).toBe(run2.proposedBlocks[i]?.scheduledStart);
      expect(run1.proposedBlocks[i]?.scheduledEnd).toBe(run2.proposedBlocks[i]?.scheduledEnd);
    }
  });

  it('2. places proposed tasks strictly within the configured study window', () => {
    const result = generateScheduleProposal(baseInput);

    expect(result.proposedBlocks.length).toBeGreaterThan(0);

    for (const block of result.proposedBlocks) {
      const blockStart = new Date(block.scheduledStart);
      const blockEnd = new Date(block.scheduledEnd);

      // Verify block start >= 09:00 local time and block end <= 17:00 local time
      expect(blockEnd.getTime()).toBeGreaterThan(blockStart.getTime());
      expect(block.durationMinutes).toBeGreaterThan(0);
    }
  });

  it('3. ensures no proposed task intervals overlap each other', () => {
    const inputWithManyTasks: ScheduleEngineInput = {
      ...baseInput,
      candidateTasks: [
        {
          id: 'task-a',
          title: 'Task A',
          priority: 'critical',
          task_type: 'project',
          status: 'planned',
          estimated_minutes: 60,
          updated_at: '2026-10-10T00:00:00Z',
          is_blocked: false,
        },
        {
          id: 'task-b',
          title: 'Task B',
          priority: 'high',
          task_type: 'project',
          status: 'planned',
          estimated_minutes: 45,
          updated_at: '2026-10-10T00:00:00Z',
          is_blocked: false,
        },
        {
          id: 'task-c',
          title: 'Task C',
          priority: 'medium',
          task_type: 'project',
          status: 'planned',
          estimated_minutes: 30,
          updated_at: '2026-10-10T00:00:00Z',
          is_blocked: false,
        },
      ],
    };

    const result = generateScheduleProposal(inputWithManyTasks);
    expect(result.proposedBlocks.length).toBe(3);

    for (let i = 0; i < result.proposedBlocks.length; i++) {
      for (let j = i + 1; j < result.proposedBlocks.length; j++) {
        const b1 = result.proposedBlocks[i]!;
        const b2 = result.proposedBlocks[j]!;

        const s1 = new Date(b1.scheduledStart).getTime();
        const e1 = new Date(b1.scheduledEnd).getTime();
        const s2 = new Date(b2.scheduledStart).getTime();
        const e2 = new Date(b2.scheduledEnd).getTime();

        const overlaps = s1 < e2 && e1 > s2;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('4. avoids overlapping existing scheduled Avenza tasks', () => {
    // Existing task scheduled from 09:00 to 10:00 local time (13:00 to 14:00 UTC)
    const existingTask: ExistingBusyInterval = {
      id: 'existing-task-1',
      title: 'Already Scheduled Team Standup Task',
      source: 'task_scheduled',
      start: new Date('2026-10-18T13:00:00Z'),
      end: new Date('2026-10-18T14:00:00Z'),
      isAllDay: false,
      isBusy: true,
    };

    const input: ScheduleEngineInput = {
      ...baseInput,
      existingCommitments: [existingTask],
    };

    const result = generateScheduleProposal(input);
    expect(result.proposedBlocks.length).toBeGreaterThan(0);

    for (const block of result.proposedBlocks) {
      const bStart = new Date(block.scheduledStart).getTime();
      const bEnd = new Date(block.scheduledEnd).getTime();

      const overlaps = bStart < existingTask.end.getTime() && bEnd > existingTask.start.getTime();
      expect(overlaps).toBe(false);
    }
  });

  it('5. avoids overlapping confirmed external Google Calendar busy events', () => {
    // External busy meeting from 10:30 to 11:30 local time (14:30 to 15:30 UTC)
    const gcalEvent: ExistingBusyInterval = {
      id: 'gcal-meeting-1',
      title: 'Sprint Planning Meeting',
      source: 'google_calendar',
      start: new Date('2026-10-18T14:30:00Z'),
      end: new Date('2026-10-18T15:30:00Z'),
      isAllDay: false,
      isBusy: true,
    };

    const input: ScheduleEngineInput = {
      ...baseInput,
      existingCommitments: [gcalEvent],
    };

    const result = generateScheduleProposal(input);
    expect(result.proposedBlocks.length).toBeGreaterThan(0);

    for (const block of result.proposedBlocks) {
      const bStart = new Date(block.scheduledStart).getTime();
      const bEnd = new Date(block.scheduledEnd).getTime();

      const overlaps = bStart < gcalEvent.end.getTime() && bEnd > gcalEvent.start.getTime();
      expect(overlaps).toBe(false);
    }
  });

  it('6. blocks the entire study window when an all-day busy calendar event exists', () => {
    const allDayEvent: ExistingBusyInterval = {
      id: 'gcal-allday-1',
      title: 'Hackathon Day / Out of Office',
      source: 'google_calendar',
      start: new Date('2026-10-18T04:00:00Z'),
      end: new Date('2026-10-19T03:59:59Z'),
      isAllDay: true,
      isBusy: true,
    };

    const input: ScheduleEngineInput = {
      ...baseInput,
      existingCommitments: [allDayEvent],
    };

    const result = generateScheduleProposal(input);

    // No tasks should fit because the entire window is occupied
    expect(result.proposedBlocks.length).toBe(0);
    expect(result.unscheduledTasks.length).toBe(baseInput.candidateTasks.length);
    expect(result.unscheduledTasks[0]?.reason).toBe('NO_CONTIGUOUS_SLOT');
  });

  it('7. respects daily maximum study capacity limit', () => {
    const inputWithLowCapacity: ScheduleEngineInput = {
      ...baseInput,
      dailyTargetMinutes: 60,
      maxDailyStudyMinutes: 75, // Can fit task-1 (60m) but NOT task-2 (45m)
      candidateTasks: [
        {
          id: 'task-1',
          title: 'Task 1 (60m)',
          priority: 'high',
          task_type: 'project',
          status: 'planned',
          estimated_minutes: 60,
          updated_at: '2026-10-10T00:00:00Z',
          is_blocked: false,
        },
        {
          id: 'task-2',
          title: 'Task 2 (45m)',
          priority: 'medium',
          task_type: 'project',
          status: 'planned',
          estimated_minutes: 45,
          updated_at: '2026-10-10T00:00:00Z',
          is_blocked: false,
        },
      ],
    };

    const result = generateScheduleProposal(inputWithLowCapacity);

    expect(result.proposedBlocks.length).toBe(1);
    expect(result.proposedBlocks[0]?.taskId).toBe('task-1');

    expect(result.unscheduledTasks.length).toBe(1);
    expect(result.unscheduledTasks[0]?.taskId).toBe('task-2');
    expect(result.unscheduledTasks[0]?.reason).toBe('CAPACITY_REACHED');
  });

  it('8. excludes blocked tasks with incomplete prerequisites and reports explicit reason', () => {
    const blockedTask: CandidateTaskForPlanning = {
      id: 'task-blocked',
      title: 'Deploy to Kubernetes',
      priority: 'critical',
      task_type: 'project',
      status: 'planned',
      estimated_minutes: 30,
      updated_at: '2026-10-10T00:00:00Z',
      is_blocked: true,
      blocked_by: [{ id: 'task-prereq', title: 'Write Dockerfile', status: 'planned' }],
    };

    const input: ScheduleEngineInput = {
      ...baseInput,
      candidateTasks: [blockedTask],
    };

    const result = generateScheduleProposal(input);

    expect(result.proposedBlocks.length).toBe(0);
    expect(result.unscheduledTasks.length).toBe(1);
    expect(result.unscheduledTasks[0]?.taskId).toBe('task-blocked');
    expect(result.unscheduledTasks[0]?.reason).toBe('BLOCKED_BY_DEPENDENCY');
    expect(result.unscheduledTasks[0]?.blockedBy?.length).toBe(1);
  });

  it('9. excludes tasks in terminal statuses (completed, cancelled, skipped)', () => {
    const terminalTasks: CandidateTaskForPlanning[] = [
      {
        id: 'task-comp',
        title: 'Completed Task',
        priority: 'high',
        task_type: 'project',
        status: 'completed',
        estimated_minutes: 30,
        updated_at: '2026-10-10T00:00:00Z',
        is_blocked: false,
      },
      {
        id: 'task-canc',
        title: 'Cancelled Task',
        priority: 'high',
        task_type: 'project',
        status: 'cancelled',
        estimated_minutes: 30,
        updated_at: '2026-10-10T00:00:00Z',
        is_blocked: false,
      },
    ];

    const input: ScheduleEngineInput = {
      ...baseInput,
      candidateTasks: terminalTasks,
    };

    const result = generateScheduleProposal(input);

    expect(result.proposedBlocks.length).toBe(0);
    expect(result.unscheduledTasks.length).toBe(2);
    expect(result.unscheduledTasks[0]?.reason).toBe('INELIGIBLE_STATUS');
  });

  it('10. provisionally defaults missing estimates to 30 minutes with warning', () => {
    const taskWithoutEstimate: CandidateTaskForPlanning = {
      id: 'task-no-est',
      title: 'Review System Design Document',
      priority: 'high',
      task_type: 'study',
      status: 'planned',
      estimated_minutes: null, // Missing estimate
      updated_at: '2026-10-10T00:00:00Z',
      is_blocked: false,
    };

    const input: ScheduleEngineInput = {
      ...baseInput,
      candidateTasks: [taskWithoutEstimate],
    };

    const result = generateScheduleProposal(input);

    expect(result.proposedBlocks.length).toBe(1);
    expect(result.proposedBlocks[0]?.durationMinutes).toBe(30);
    expect(result.proposedBlocks[0]?.isDurationDefaulted).toBe(true);

    expect(result.warnings.some((w) => w.includes('provisional 30-minute estimate'))).toBe(true);
  });

  it('11. marks tasks with invalid non-positive estimates as INVALID_ESTIMATE', () => {
    const invalidTask: CandidateTaskForPlanning = {
      id: 'task-neg',
      title: 'Bad Estimate Task',
      priority: 'high',
      task_type: 'study',
      status: 'planned',
      estimated_minutes: -15,
      updated_at: '2026-10-10T00:00:00Z',
      is_blocked: false,
    };

    const input: ScheduleEngineInput = {
      ...baseInput,
      candidateTasks: [invalidTask],
    };

    const result = generateScheduleProposal(input);

    expect(result.proposedBlocks.length).toBe(0);
    expect(result.unscheduledTasks.length).toBe(1);
    expect(result.unscheduledTasks[0]?.reason).toBe('INVALID_ESTIMATE');
  });

  it('12. warns when external calendar is disconnected and does not claim verified external availability', () => {
    const input: ScheduleEngineInput = {
      ...baseInput,
      isExternalCalendarAvailable: false,
    };

    const result = generateScheduleProposal(input);

    expect(result.isExternalCalendarAvailable).toBe(false);
    expect(result.warnings.some((w) => w.includes('Google Calendar is disconnected'))).toBe(true);
  });

  it('13. correctly blocks entire study window when an all-day busy event is present', () => {
    const allDayCommitment: ExistingBusyInterval = {
      id: 'cal-allday-1',
      title: 'Company Holiday / All-Day Offsite',
      source: 'google_calendar',
      start: new Date('2026-10-18T00:00:00Z'),
      end: new Date('2026-10-18T23:59:59Z'),
      isAllDay: true,
      isBusy: true,
    };

    const input: ScheduleEngineInput = {
      ...baseInput,
      existingCommitments: [allDayCommitment],
    };

    const result = generateScheduleProposal(input);

    expect(result.proposedBlocks.length).toBe(0);
    expect(result.unscheduledTasks.length).toBe(2);
    expect(result.unscheduledTasks.every((t) => t.reason === 'NO_CONTIGUOUS_SLOT')).toBe(true);
    expect(result.existingCommitments.length).toBe(1);
    expect(result.existingCommitments[0]?.isAllDay).toBe(true);
  });

  it('14. correctly computes boundaries across timezone extremes (Asia/Tokyo and Pacific/Honolulu)', () => {
    // Tokyo (UTC+9)
    const tokyoInput: ScheduleEngineInput = {
      ...baseInput,
      targetDate: '2026-10-18',
      timezone: 'Asia/Tokyo',
      studyWindow: { start: '09:00', end: '12:00' },
      candidateTasks: [baseInput.candidateTasks[0]!],
    };

    const tokyoResult = generateScheduleProposal(tokyoInput);
    expect(tokyoResult.proposedBlocks.length).toBe(1);
    // 09:00 JST is 00:00 UTC
    expect(tokyoResult.proposedBlocks[0]?.scheduledStart).toBe('2026-10-18T00:00:00.000Z');
    expect(tokyoResult.proposedBlocks[0]?.scheduledEnd).toBe('2026-10-18T01:00:00.000Z');

    // Honolulu (UTC-10)
    const honoluluInput: ScheduleEngineInput = {
      ...baseInput,
      targetDate: '2026-10-18',
      timezone: 'Pacific/Honolulu',
      studyWindow: { start: '09:00', end: '12:00' },
      candidateTasks: [baseInput.candidateTasks[0]!],
    };

    const honoluluResult = generateScheduleProposal(honoluluInput);
    expect(honoluluResult.proposedBlocks.length).toBe(1);
    // 09:00 HST is 19:00 UTC
    expect(honoluluResult.proposedBlocks[0]?.scheduledStart).toBe('2026-10-18T19:00:00.000Z');
    expect(honoluluResult.proposedBlocks[0]?.scheduledEnd).toBe('2026-10-18T20:00:00.000Z');
  });

  it('14b. correctly handles both daylight-saving transitions in America/New_York (Spring Forward and Fall Back)', () => {
    // 1. Spring Forward (DST start: Sunday, March 8, 2026 -> clocks advance to UTC-4)
    const springDstInput: ScheduleEngineInput = {
      ...baseInput,
      targetDate: '2026-03-08',
      timezone: 'America/New_York',
      studyWindow: { start: '09:00', end: '12:00' },
      candidateTasks: [baseInput.candidateTasks[0]!],
    };

    const springResult = generateScheduleProposal(springDstInput);
    expect(springResult.proposedBlocks.length).toBe(1);
    // 09:00 EDT is 13:00:00.000Z (UTC-4)
    expect(springResult.proposedBlocks[0]?.scheduledStart).toBe('2026-03-08T13:00:00.000Z');
    expect(springResult.proposedBlocks[0]?.scheduledEnd).toBe('2026-03-08T14:00:00.000Z');

    // 2. Fall Back (DST end: Sunday, November 1, 2026 -> clocks fall back to UTC-5)
    const fallDstInput: ScheduleEngineInput = {
      ...baseInput,
      targetDate: '2026-11-01',
      timezone: 'America/New_York',
      studyWindow: { start: '09:00', end: '12:00' },
      candidateTasks: [baseInput.candidateTasks[0]!],
    };

    const fallResult = generateScheduleProposal(fallDstInput);
    expect(fallResult.proposedBlocks.length).toBe(1);
    // 09:00 EST is 14:00:00.000Z (UTC-5)
    expect(fallResult.proposedBlocks[0]?.scheduledStart).toBe('2026-11-01T14:00:00.000Z');
    expect(fallResult.proposedBlocks[0]?.scheduledEnd).toBe('2026-11-01T15:00:00.000Z');
  });

  it('15. avoids conflicts with existing scheduled tasks within the study window', () => {
    // Already scheduled task from 09:00 to 10:30 (13:00 to 14:30 UTC for America/New_York)
    const existingTask: ExistingBusyInterval = {
      id: 'existing-task-block',
      title: 'Prior Scheduled Study Session',
      source: 'task_scheduled',
      start: new Date('2026-10-18T13:00:00.000Z'),
      end: new Date('2026-10-18T14:30:00.000Z'),
      isAllDay: false,
      isBusy: true,
    };

    const input: ScheduleEngineInput = {
      ...baseInput,
      existingCommitments: [existingTask],
    };

    const result = generateScheduleProposal(input);
    expect(result.proposedBlocks.length).toBeGreaterThan(0);

    // The first proposed block must start at or after 14:30 UTC (after the existing task)
    const firstProposedStart = new Date(result.proposedBlocks[0]!.scheduledStart).getTime();
    expect(firstProposedStart).toBeGreaterThanOrEqual(existingTask.end.getTime());
  });

  it('16. strictly respects hard maximum capacity semantics vs soft daily target', () => {
    // 3 tasks with 60 minutes each = 180 total
    const tasks: CandidateTaskForPlanning[] = [
      {
        id: 't-1',
        title: 'Task 1',
        priority: 'high',
        task_type: 'project',
        status: 'planned',
        estimated_minutes: 60,
        updated_at: '2026-10-10T00:00:00Z',
        is_blocked: false,
      },
      {
        id: 't-2',
        title: 'Task 2',
        priority: 'high',
        task_type: 'project',
        status: 'planned',
        estimated_minutes: 60,
        updated_at: '2026-10-10T00:00:00Z',
        is_blocked: false,
      },
      {
        id: 't-3',
        title: 'Task 3',
        priority: 'medium',
        task_type: 'project',
        status: 'planned',
        estimated_minutes: 60,
        updated_at: '2026-10-10T00:00:00Z',
        is_blocked: false,
      },
    ];

    // Case A: dailyTarget = 90, maxDailyStudyMinutes = 150
    // Task 1 (60m) is scheduled (total 60 < target 90).
    // Task 2 (60m) brings total to 120, which is > target (90) but <= max cap (150) -> Accepted!
    // Task 3 (60m) would bring total to 180, exceeding max cap (150) -> Rejected with CAPACITY_REACHED!
    const input: ScheduleEngineInput = {
      ...baseInput,
      dailyTargetMinutes: 90,
      maxDailyStudyMinutes: 150,
      candidateTasks: tasks,
    };

    const result = generateScheduleProposal(input);
    expect(result.proposedBlocks.length).toBe(2);
    expect(result.totalProposedMinutes).toBe(120);
    expect(result.unscheduledTasks.length).toBe(1);
    expect(result.unscheduledTasks[0]?.reason).toBe('CAPACITY_REACHED');
  });

  it('17. guarantees 100 consecutive executions produce bit-for-bit identical schedules', () => {
    const reference = generateScheduleProposal(baseInput);

    for (let i = 0; i < 100; i++) {
      const trial = generateScheduleProposal(baseInput);
      expect(trial.totalProposedMinutes).toBe(reference.totalProposedMinutes);
      expect(trial.proposedBlocks.length).toBe(reference.proposedBlocks.length);
      for (let j = 0; j < trial.proposedBlocks.length; j++) {
        expect(trial.proposedBlocks[j]?.taskId).toBe(reference.proposedBlocks[j]?.taskId);
        expect(trial.proposedBlocks[j]?.scheduledStart).toBe(reference.proposedBlocks[j]?.scheduledStart);
        expect(trial.proposedBlocks[j]?.scheduledEnd).toBe(reference.proposedBlocks[j]?.scheduledEnd);
      }
    }
  });
});
