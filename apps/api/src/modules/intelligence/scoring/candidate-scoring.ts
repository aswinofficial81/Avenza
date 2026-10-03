import type {
  NextActionConfidence,
  NextActionReason,
  ScoreBreakdown,
  TaskPriority,
} from '@avenza/shared';
import type { CandidateAction } from '../candidates/candidate.types';
import type { IntelligenceContext } from '../context/context.types';
import type { ScoredCandidate } from './scoring.types';

export class CandidateScorer {
  /**
   * Scores all candidate actions deterministically based on context and signals.
   * Pure function: does NOT call Date.now() internally; relies on context.currentTimeIso.
   */
  scoreCandidates(
    candidates: CandidateAction[],
    context: IntelligenceContext
  ): ScoredCandidate[] {
    const scored = candidates.map((candidate) => this.scoreCandidate(candidate, context));

    // Sort according to deterministic tie-breaking hierarchy
    return scored.sort((a, b) => this.compareCandidates(a, b, context));
  }

  scoreCandidate(candidate: CandidateAction, context: IntelligenceContext): ScoredCandidate {
    const { task } = candidate;

    // 1. Explicit Priority Signal (10 - 40)
    let prioritySignal = 20; // default medium
    switch (task.priority) {
      case 'critical':
        prioritySignal = 40;
        break;
      case 'high':
        prioritySignal = 30;
        break;
      case 'medium':
        prioritySignal = 20;
        break;
      case 'low':
        prioritySignal = 10;
        break;
    }

    // 2. Urgency Signal (0 - 25)
    let urgencySignal = 0;
    let isOverdue = false;
    let isDueToday = false;
    let isDeadlineSoon = false;

    if (task.due_at) {
      const dueTimestamp = new Date(task.due_at).getTime();
      const currentTimestamp = new Date(context.currentTimeIso).getTime();
      const diffHours = (dueTimestamp - currentTimestamp) / (1000 * 60 * 60);
      const dueDateStr = task.due_at.slice(0, 10);

      if (dueTimestamp < currentTimestamp && dueDateStr < context.currentDate) {
        isOverdue = true;
        urgencySignal = 25;
      } else if (dueDateStr === context.currentDate) {
        isDueToday = true;
        urgencySignal = 20;
      } else if (diffHours > 0 && diffHours <= 48) {
        isDeadlineSoon = true;
        urgencySignal = 12;
      } else if (diffHours > 48) {
        urgencySignal = 4;
      }
    }

    // 3. Goal Relevance Signal (0 - 15)
    let goalSignal = 0;
    const isGoalActive = Boolean(task.goal_id && context.activeGoals.some((g) => g.id === task.goal_id));
    if (isGoalActive) {
      goalSignal += 10;
    }
    if (task.milestone_id) {
      goalSignal += 5;
    }

    // 4. Dependency Unblock Signal (0 - 15)
    const dependencySignal = Math.min(task.unblocks_count * 5, 15);

    // 5. Schedule Signal (0 - 15)
    let scheduleSignal = 0;
    const isScheduledToday = Boolean(task.scheduled_date && task.scheduled_date === context.currentDate);
    if (isScheduledToday) {
      scheduleSignal = 15;
    }

    // 6. Continuation Signal (0 - 10)
    let continuationSignal = 0;
    const hasActiveSession = context.activeFocusSessionTaskId === task.id;
    const hasRecentSession = context.recentFocusSessions.some((s) => s.task_id === task.id);

    if (hasActiveSession) {
      continuationSignal = 10;
    } else if (task.status === 'in_progress' && hasRecentSession) {
      continuationSignal = 8;
    } else if (task.status === 'in_progress') {
      continuationSignal = 5;
    }

    // 7. Staleness Signal (0 - 5)
    let stalenessSignal = 0;
    let isStale = false;
    const createdTimestamp = new Date(task.created_at).getTime();
    const currentTimestamp = new Date(context.currentTimeIso).getTime();
    const daysSinceCreation = (currentTimestamp - createdTimestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation >= 14) {
      isStale = true;
      stalenessSignal = 5;
    }

    // Total Score (bounded 0 - 100)
    const rawTotal =
      prioritySignal +
      urgencySignal +
      goalSignal +
      dependencySignal +
      scheduleSignal +
      continuationSignal +
      stalenessSignal;
    const totalScore = Math.min(Math.round(rawTotal), 100);

    const scoreBreakdown: ScoreBreakdown = {
      prioritySignal,
      urgencySignal,
      goalSignal,
      dependencySignal,
      scheduleSignal,
      continuationSignal,
      stalenessSignal,
      totalScore,
    };

    // Determine Reason Code and Deterministic Explanation
    const primaryReason = this.determineReason({
      taskTitle: task.title,
      priority: task.priority,
      isOverdue,
      isDueToday,
      isDeadlineSoon,
      isScheduledToday,
      isStale,
      unblocksCount: task.unblocks_count,
      isContinuation: continuationSignal > 0,
      goalTitle: candidate.goalTitle,
    });

    // Determine Confidence
    const confidence = this.determineConfidence({
      totalScore,
      priority: task.priority,
      isOverdue,
      isDueToday,
      isDeadlineSoon,
      unblocksCount: task.unblocks_count,
      hasActiveSession,
      hasGoal: Boolean(task.goal_id),
    });

    return {
      candidate,
      scoreBreakdown,
      primaryReason,
      confidence,
    };
  }

  private determineReason(params: {
    taskTitle: string;
    priority: TaskPriority;
    isOverdue: boolean;
    isDueToday: boolean;
    isDeadlineSoon: boolean;
    isScheduledToday: boolean;
    isStale: boolean;
    unblocksCount: number;
    isContinuation: boolean;
    goalTitle?: string | null;
  }): NextActionReason {
    const {
      taskTitle,
      priority,
      isOverdue,
      isDueToday,
      isDeadlineSoon,
      isScheduledToday,
      isStale,
      unblocksCount,
      isContinuation,
      goalTitle,
    } = params;

    if (isOverdue) {
      return {
        code: 'overdue',
        label: 'Overdue',
        explanation: `"${taskTitle}" is overdue and requires immediate attention.`,
      };
    }

    if (priority === 'critical') {
      return {
        code: 'critical_priority',
        label: 'Critical priority',
        explanation: `"${taskTitle}" is marked as critical priority.`,
      };
    }

    if (isDueToday) {
      return {
        code: 'due_today',
        label: 'Due today',
        explanation: `"${taskTitle}" is due today and is currently actionable.`,
      };
    }

    if (unblocksCount >= 2) {
      return {
        code: 'dependency_unblock',
        label: 'Unblocks other work',
        explanation: `Completing "${taskTitle}" will unblock ${unblocksCount} other active tasks.`,
      };
    }

    if (isContinuation) {
      return {
        code: 'in_progress_continuation',
        label: 'Continue momentum',
        explanation: `You have ongoing work or a recent focus session on "${taskTitle}".`,
      };
    }

    if (priority === 'high') {
      return {
        code: 'high_priority',
        label: 'High priority',
        explanation: `"${taskTitle}" is marked as high priority.`,
      };
    }

    if (isScheduledToday) {
      return {
        code: 'scheduled_now',
        label: 'Scheduled today',
        explanation: `"${taskTitle}" is scheduled for execution today.`,
      };
    }

    if (isDeadlineSoon) {
      return {
        code: 'deadline_soon',
        label: 'Approaching deadline',
        explanation: `"${taskTitle}" has an upcoming deadline within 48 hours.`,
      };
    }

    if (unblocksCount === 1) {
      return {
        code: 'dependency_unblock',
        label: 'Unblocks next task',
        explanation: `Completing "${taskTitle}" will unblock an active prerequisite task.`,
      };
    }

    if (isStale) {
      return {
        code: 'stale_task',
        label: 'Needs attention',
        explanation: `"${taskTitle}" has been open for over two weeks without progress.`,
      };
    }

    if (goalTitle) {
      return {
        code: 'goal_priority',
        label: 'Active goal work',
        explanation: `"${taskTitle}" advances your active goal "${goalTitle}".`,
      };
    }

    return {
      code: 'user_priority',
      label: 'Actionable work',
      explanation: `"${taskTitle}" is ready for execution.`,
    };
  }

  private determineConfidence(params: {
    totalScore: number;
    priority: TaskPriority;
    isOverdue: boolean;
    isDueToday: boolean;
    isDeadlineSoon: boolean;
    unblocksCount: number;
    hasActiveSession: boolean;
    hasGoal: boolean;
  }): NextActionConfidence {
    const { totalScore, priority, isOverdue, isDueToday, isDeadlineSoon, unblocksCount, hasActiveSession, hasGoal } =
      params;

    // High confidence: Clear, unyielding signals
    if (
      hasActiveSession ||
      priority === 'critical' ||
      (priority === 'high' && (isDueToday || isOverdue || unblocksCount >= 1)) ||
      (isDueToday && priority !== 'low') ||
      totalScore >= 65
    ) {
      return 'high';
    }

    // Medium confidence: Solid signals with multiple competing factors
    if (
      priority === 'high' ||
      (priority === 'medium' && (isDueToday || isDeadlineSoon || hasGoal)) ||
      totalScore >= 35
    ) {
      return 'medium';
    }

    // Low confidence: Sparse context
    return 'low';
  }

  /**
   * Deterministic tie-breaker comparator:
   * 1. Total score (descending)
   * 2. Explicit priority (critical > high > medium > low)
   * 3. Urgency rank (overdue > due_today > deadline_soon > other)
   * 4. Dependency unblock count (descending)
   * 5. Goal attached (has goal > no goal)
   * 6. Scheduled date (has scheduled date today > none)
   * 7. Due date (earlier first)
   * 8. Created at (older first)
   * 9. Stable task ID (localeCompare)
   */
  private compareCandidates(a: ScoredCandidate, b: ScoredCandidate, context: IntelligenceContext): number {
    // 1. Total score
    if (b.scoreBreakdown.totalScore !== a.scoreBreakdown.totalScore) {
      return b.scoreBreakdown.totalScore - a.scoreBreakdown.totalScore;
    }

    // 2. Explicit priority
    const priorityWeight: Record<TaskPriority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    const pA = priorityWeight[a.candidate.task.priority] || 0;
    const pB = priorityWeight[b.candidate.task.priority] || 0;
    if (pB !== pA) {
      return pB - pA;
    }

    // 3. Urgency rank
    const getUrgencyRank = (c: ScoredCandidate): number => {
      const task = c.candidate.task;
      if (!task.due_at) return 0;
      if (task.due_at.slice(0, 10) < context.currentDate) return 3; // overdue
      if (task.due_at.slice(0, 10) === context.currentDate) return 2; // due today
      return 1; // future
    };
    const uA = getUrgencyRank(a);
    const uB = getUrgencyRank(b);
    if (uB !== uA) {
      return uB - uA;
    }

    // 4. Dependency unblock count
    if (b.candidate.task.unblocks_count !== a.candidate.task.unblocks_count) {
      return b.candidate.task.unblocks_count - a.candidate.task.unblocks_count;
    }

    // 5. Goal attached
    const gA = a.candidate.task.goal_id ? 1 : 0;
    const gB = b.candidate.task.goal_id ? 1 : 0;
    if (gB !== gA) {
      return gB - gA;
    }

    // 6. Scheduled date
    const sA = a.candidate.task.scheduled_date === context.currentDate ? 1 : 0;
    const sB = b.candidate.task.scheduled_date === context.currentDate ? 1 : 0;
    if (sB !== sA) {
      return sB - sA;
    }

    // 7. Due date (earlier first)
    if (a.candidate.task.due_at && b.candidate.task.due_at) {
      const cmp = a.candidate.task.due_at.localeCompare(b.candidate.task.due_at);
      if (cmp !== 0) return cmp;
    } else if (a.candidate.task.due_at && !b.candidate.task.due_at) {
      return -1;
    } else if (!a.candidate.task.due_at && b.candidate.task.due_at) {
      return 1;
    }

    // 8. Created at (older first)
    const createCmp = a.candidate.task.created_at.localeCompare(b.candidate.task.created_at);
    if (createCmp !== 0) {
      return createCmp;
    }

    // 9. Stable task ID
    return a.candidate.taskId.localeCompare(b.candidate.taskId);
  }
}
