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

    // 1. Explicit Priority Signal (10 - 40 base) + Next Pending Milestone (+15)
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

    // RULE B: Next Pending Milestone (+15 priority alignment)
    // Completed projects do not receive active milestone urgency/alignment bonuses
    const isNextMilestone = Boolean(
      candidate.isNextPendingMilestone && candidate.projectHealth !== 'completed'
    );
    if (isNextMilestone) {
      prioritySignal += 15;
    }

    // 2. Urgency Signal (0 - 25 base) + At-Risk Project (+10)
    let urgencySignal = 0;
    let isOverdue = false;
    let isDueToday = false;
    let isDeadlineSoon = false;

    // RULE A: At-Risk Project (+10 urgency points)
    // Completed projects do not receive active urgency bonuses
    const isProjectAtRisk = candidate.projectHealth === 'at_risk';
    if (isProjectAtRisk) {
      urgencySignal += 10;
    }

    // RULE C: Deadline / Urgency logic
    // Prevent double-counting: evaluate effective deadline ONCE
    const effectiveDueDate =
      task.due_at ||
      (candidate.projectHealth !== 'completed'
        ? candidate.projectMilestoneTargetDate || candidate.projectTargetDate
        : null);

    if (effectiveDueDate) {
      const dueTimestamp = new Date(effectiveDueDate).getTime();
      const currentTimestamp = new Date(context.currentTimeIso).getTime();
      const diffHours = (dueTimestamp - currentTimestamp) / (1000 * 60 * 60);
      const dueDateStr = effectiveDueDate.slice(0, 10);

      if (dueTimestamp < currentTimestamp && dueDateStr < context.currentDate) {
        isOverdue = true;
        urgencySignal += 25;
      } else if (dueDateStr === context.currentDate) {
        isDueToday = true;
        urgencySignal += 20;
      } else if (diffHours > 0 && diffHours <= 48) {
        isDeadlineSoon = true;
        urgencySignal += 12;
      } else if (diffHours > 48) {
        urgencySignal += 4;
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

    // 8. Career Signals (Independently bounded 0 - 25)
    let interviewUrgency = 0;
    let isInterviewImminent = false; // <= 72h
    let isInterviewThisWeek = false; // 72h - 168h
    if (candidate.careerInterviewScheduledAt) {
      const interviewTimestamp = new Date(candidate.careerInterviewScheduledAt).getTime();
      const currentTimestamp = new Date(context.currentTimeIso).getTime();
      const diffHours = (interviewTimestamp - currentTimestamp) / (1000 * 60 * 60);

      if (diffHours > 0) {
        if (diffHours <= 24) {
          interviewUrgency = 20;
          isInterviewImminent = true;
        } else if (diffHours <= 72) {
          interviewUrgency = 15;
          isInterviewImminent = true;
        } else if (diffHours <= 168) {
          interviewUrgency = 8;
          isInterviewThisWeek = true;
        }
        // diffHours > 168: upper bound exceeded -> 0 pts
      }
    }

    // Assessment Urgency
    let assessmentUrgency = 0;
    let isAssessmentUrgent = false;
    let isAssessmentThisWeek = false;
    if (candidate.careerStage === 'assessment' && candidate.careerAssessmentDeadline) {
      const deadlineTimestamp = new Date(candidate.careerAssessmentDeadline).getTime();
      const currentTimestamp = new Date(context.currentTimeIso).getTime();
      const diffHours = (deadlineTimestamp - currentTimestamp) / (1000 * 60 * 60);
      const deadlineDateStr = candidate.careerAssessmentDeadline.slice(0, 10);

      // Rule 1: A deadline strictly in the past receives +0 assessment urgency
      if (deadlineTimestamp < currentTimestamp) {
        assessmentUrgency = 0;
      } else if (deadlineTimestamp === currentTimestamp || deadlineDateStr === context.currentDate) {
        // Rule 2: A deadline occurring today (or exactly now) retains proposed same-day urgency (+20)
        assessmentUrgency = 20;
        isAssessmentUrgent = true;
      } else if (diffHours > 0 && diffHours <= 48) {
        // Rule 3: Valid future deadline within 48 hours (+15)
        assessmentUrgency = 15;
        isAssessmentUrgent = true;
      } else if (diffHours > 48 && diffHours <= 168) {
        // Valid future deadline within 7 days (+8)
        assessmentUrgency = 8;
        isAssessmentThisWeek = true;
      }
      // diffHours > 168: +0
    }

    // Application Follow-up Urgency (+12)
    let followUpUrgency = 0;
    const isFollowUpDue = Boolean(candidate.isCareerFollowUpDue);
    if (isFollowUpDue) {
      followUpUrgency = 12;
    }

    // Required-Skill Gap Signal (+10)
    let requiredSkillGap = 0;
    const hasRequiredSkillGap = Boolean(candidate.hasRequiredSkillGap);
    if (hasRequiredSkillGap) {
      requiredSkillGap = 10;
    }

    // Featured Project Prep Signal (+8)
    let featuredProjectPrep = 0;
    const isFeaturedProjectPrep = Boolean(candidate.isFeaturedProjectPrep);
    if (isFeaturedProjectPrep) {
      featuredProjectPrep = 8;
    }

    // Career Signal: Capped at +25
    const careerSignal = Math.min(
      interviewUrgency + assessmentUrgency + followUpUrgency + requiredSkillGap + featuredProjectPrep,
      25
    );

    // Explicit additive project signal
    const projectSignal = (isProjectAtRisk ? 10 : 0) + (isNextMilestone ? 15 : 0);

    // Total Score (bounded 0 - 100)
    const rawTotal =
      prioritySignal +
      urgencySignal +
      goalSignal +
      dependencySignal +
      scheduleSignal +
      continuationSignal +
      stalenessSignal +
      careerSignal;
    const totalScore = Math.min(Math.round(rawTotal), 100);

    const scoreBreakdown: ScoreBreakdown = {
      prioritySignal,
      urgencySignal,
      goalSignal,
      dependencySignal,
      scheduleSignal,
      continuationSignal,
      stalenessSignal,
      projectSignal,
      careerSignal,
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
      isProjectAtRisk,
      isNextMilestone,
      projectTitle: candidate.projectTitle,
      isInterviewImminent,
      isInterviewThisWeek,
      isAssessmentUrgent,
      isAssessmentThisWeek,
      isFollowUpDue,
      hasRequiredSkillGap,
      requiredSkillName: candidate.requiredSkillName,
      isFeaturedProjectPrep,
      companyName: candidate.companyName,
      careerRoundType: candidate.careerInterviewRoundType,
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
      isProjectAtRisk,
      isNextMilestone,
      isInterviewImminent,
      isAssessmentUrgent,
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
    isProjectAtRisk?: boolean;
    isNextMilestone?: boolean;
    projectTitle?: string | null;
    isInterviewImminent?: boolean;
    isInterviewThisWeek?: boolean;
    isAssessmentUrgent?: boolean;
    isAssessmentThisWeek?: boolean;
    isFollowUpDue?: boolean;
    hasRequiredSkillGap?: boolean;
    requiredSkillName?: string | null;
    isFeaturedProjectPrep?: boolean;
    companyName?: string | null;
    careerRoundType?: string | null;
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
      isProjectAtRisk,
      isNextMilestone,
      projectTitle,
      isInterviewImminent,
      isInterviewThisWeek,
      isAssessmentUrgent,
      isAssessmentThisWeek,
      isFollowUpDue,
      hasRequiredSkillGap,
      requiredSkillName,
      isFeaturedProjectPrep,
      companyName,
      careerRoundType,
    } = params;

    // 1. Overdue
    if (isOverdue) {
      return {
        code: 'overdue',
        label: 'Overdue',
        explanation: `"${taskTitle}" is overdue and requires immediate attention.`,
      };
    }

    // 2. Critical priority
    if (priority === 'critical') {
      return {
        code: 'critical_priority',
        label: 'Critical priority',
        explanation: `"${taskTitle}" is marked as critical priority.`,
      };
    }

    // 3. Imminent Interview (<= 72h)
    if (isInterviewImminent) {
      const roundLabel = careerRoundType ? `${careerRoundType} interview` : 'Interview';
      const companyLabel = companyName ? ` for ${companyName}` : '';
      return {
        code: 'career_interview_imminent',
        label: 'Interview preparation',
        explanation: `${roundLabel}${companyLabel} is scheduled soon. Prioritize preparation.`,
      };
    }

    // 4. Due today
    if (isDueToday) {
      return {
        code: 'due_today',
        label: 'Due today',
        explanation: `"${taskTitle}" is due today and is currently actionable.`,
      };
    }

    // 5. Urgent Assessment (<= 48h or today)
    if (isAssessmentUrgent) {
      const companyLabel = companyName ? ` for ${companyName}` : '';
      return {
        code: 'career_assessment_due',
        label: 'Assessment deadline',
        explanation: `Assessment deadline${companyLabel} is approaching. Complete and submit on time.`,
      };
    }

    // 6. Major dependency unblock (>= 2)
    if (unblocksCount >= 2) {
      return {
        code: 'dependency_unblock',
        label: 'Unblocks other work',
        explanation: `Completing "${taskTitle}" will unblock ${unblocksCount} other active tasks.`,
      };
    }

    // 7. Continuation
    if (isContinuation) {
      return {
        code: 'in_progress_continuation',
        label: 'Continue momentum',
        explanation: `You have ongoing work or a recent focus session on "${taskTitle}".`,
      };
    }

    // 8. Project at risk
    if (isProjectAtRisk && isNextMilestone && projectTitle) {
      return {
        code: 'project_at_risk',
        label: 'Project at risk',
        explanation: `Your ${projectTitle} project is at risk and this task belongs to its next milestone.`,
      };
    }

    if (isProjectAtRisk && projectTitle) {
      return {
        code: 'project_at_risk',
        label: 'Project at risk',
        explanation: `Your ${projectTitle} project is at risk and requires focused progress.`,
      };
    }

    // 9. High priority
    if (priority === 'high') {
      return {
        code: 'high_priority',
        label: 'High priority',
        explanation: `"${taskTitle}" is marked as high priority.`,
      };
    }

    // 10. Application follow-up due (>= 336h in applied/screening)
    if (isFollowUpDue) {
      const companyLabel = companyName ? ` on your ${companyName} application` : ' on your job application';
      return {
        code: 'career_follow_up_due',
        label: 'Application follow-up',
        explanation: `14 days without activity${companyLabel}. Send a polite follow-up.`,
      };
    }

    // 11. Next project milestone
    if (isNextMilestone && projectTitle) {
      return {
        code: 'project_milestone_next',
        label: 'Next milestone',
        explanation: `"${taskTitle}" advances the next milestone for your project "${projectTitle}".`,
      };
    }

    // 12. Scheduled today
    if (isScheduledToday) {
      return {
        code: 'scheduled_now',
        label: 'Scheduled today',
        explanation: `"${taskTitle}" is scheduled for execution today.`,
      };
    }

    // 13. Interview this week (72h - 168h)
    if (isInterviewThisWeek) {
      const roundLabel = careerRoundType ? `${careerRoundType} interview` : 'Interview';
      const companyLabel = companyName ? ` for ${companyName}` : '';
      return {
        code: 'career_interview_imminent',
        label: 'Upcoming interview',
        explanation: `${roundLabel}${companyLabel} is scheduled this week. Advance preparation.`,
      };
    }

    // 14. Deadline soon (<= 48h)
    if (isDeadlineSoon) {
      return {
        code: 'deadline_soon',
        label: 'Approaching deadline',
        explanation: `"${taskTitle}" has an upcoming deadline within 48 hours.`,
      };
    }

    // 15. Assessment this week (48h - 168h)
    if (isAssessmentThisWeek) {
      const companyLabel = companyName ? ` for ${companyName}` : '';
      return {
        code: 'career_assessment_due',
        label: 'Assessment preparation',
        explanation: `Assessment deadline${companyLabel} is scheduled this week.`,
      };
    }

    // 16. Required skill gap
    if (hasRequiredSkillGap) {
      const skillLabel = requiredSkillName ? `"${requiredSkillName}"` : 'a required skill';
      return {
        code: 'career_required_skill_gap',
        label: 'Required skill gap',
        explanation: `Closes ${skillLabel} required by your active career target or opportunity.`,
      };
    }

    // 17. Featured project prep
    if (isFeaturedProjectPrep) {
      return {
        code: 'career_project_prep',
        label: 'Featured project prep',
        explanation: `Prepares a featured project attached to an active career application.`,
      };
    }

    // 18. Dependency unblock (1)
    if (unblocksCount === 1) {
      return {
        code: 'dependency_unblock',
        label: 'Unblocks next task',
        explanation: `Completing "${taskTitle}" will unblock an active prerequisite task.`,
      };
    }

    // 19. Stale task
    if (isStale) {
      return {
        code: 'stale_task',
        label: 'Needs attention',
        explanation: `"${taskTitle}" has been open for over two weeks without progress.`,
      };
    }

    // 20. Goal priority
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
    isProjectAtRisk?: boolean;
    isNextMilestone?: boolean;
    isInterviewImminent?: boolean;
    isAssessmentUrgent?: boolean;
  }): NextActionConfidence {
    const {
      totalScore,
      priority,
      isOverdue,
      isDueToday,
      isDeadlineSoon,
      unblocksCount,
      hasActiveSession,
      hasGoal,
      isProjectAtRisk,
      isNextMilestone,
      isInterviewImminent,
      isAssessmentUrgent,
    } = params;

    // High confidence: Clear, unyielding signals
    if (
      hasActiveSession ||
      priority === 'critical' ||
      (priority === 'high' && (isDueToday || isOverdue || unblocksCount >= 1)) ||
      (isDueToday && priority !== 'low') ||
      (isProjectAtRisk && isNextMilestone) ||
      isInterviewImminent ||
      isAssessmentUrgent ||
      totalScore >= 65
    ) {
      return 'high';
    }

    // Medium confidence: Solid signals with multiple competing factors
    if (
      priority === 'high' ||
      isProjectAtRisk ||
      isNextMilestone ||
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
   * 6. Project attached (has project > no project)
   * 7. Scheduled date (has scheduled date today > none)
   * 8. Due date (earlier first)
   * 9. Created at (older first)
   * 10. Stable task ID (localeCompare)
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
      const effectiveDue =
        task.due_at ||
        (c.candidate.projectHealth !== 'completed'
          ? c.candidate.projectMilestoneTargetDate || c.candidate.projectTargetDate
          : null);
      if (!effectiveDue) return 0;
      if (effectiveDue.slice(0, 10) < context.currentDate) return 3; // overdue
      if (effectiveDue.slice(0, 10) === context.currentDate) return 2; // due today
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

    // 6. Project attached
    const prjA = a.candidate.projectId ? 1 : 0;
    const prjB = b.candidate.projectId ? 1 : 0;
    if (prjB !== prjA) {
      return prjB - prjA;
    }

    // 7. Scheduled date
    const sA = a.candidate.task.scheduled_date === context.currentDate ? 1 : 0;
    const sB = b.candidate.task.scheduled_date === context.currentDate ? 1 : 0;
    if (sB !== sA) {
      return sB - sA;
    }

    // 8. Due date (earlier first)
    const dueA =
      a.candidate.task.due_at ||
      (a.candidate.projectHealth !== 'completed'
        ? a.candidate.projectMilestoneTargetDate || a.candidate.projectTargetDate
        : null);
    const dueB =
      b.candidate.task.due_at ||
      (b.candidate.projectHealth !== 'completed'
        ? b.candidate.projectMilestoneTargetDate || b.candidate.projectTargetDate
        : null);

    if (dueA && dueB) {
      const cmp = dueA.localeCompare(dueB);
      if (cmp !== 0) return cmp;
    } else if (dueA && !dueB) {
      return -1;
    } else if (!dueA && dueB) {
      return 1;
    }

    // 9. Created at (older first)
    const createCmp = a.candidate.task.created_at.localeCompare(b.candidate.task.created_at);
    if (createCmp !== 0) {
      return createCmp;
    }

    // 10. Stable task ID
    return a.candidate.taskId.localeCompare(b.candidate.taskId);
  }
}
