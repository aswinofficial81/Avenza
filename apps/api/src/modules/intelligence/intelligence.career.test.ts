import { describe, it, expect } from 'vitest';
import { CandidateScorer } from './scoring/candidate-scoring';
import { CandidateGenerator } from './candidates/candidate-generator';
import type { CandidateAction } from './candidates/candidate.types';
import type { IntelligenceContext, TaskContextItem } from './context/context.types';

function createMockContext(overrides?: Partial<IntelligenceContext>): IntelligenceContext {
  return {
    userId: 'user-alpha-123',
    currentDate: '2026-10-15',
    currentTimeIso: '2026-10-15T10:00:00.000Z',
    timezone: 'UTC',
    activeGoals: [],
    activeMilestones: [],
    activeProjects: [],
    openTasks: [],
    recentCompletedTasks: [],
    recentFocusSessions: [],
    recentEvidence: [],
    activeFocusSessionTaskId: null,
    ...overrides,
  };
}

function createMockTask(overrides?: Partial<TaskContextItem>): TaskContextItem {
  return {
    id: 'task-test-1',
    goal_id: null,
    milestone_id: null,
    application_id: null,
    project_id: null,
    project_milestone_id: null,
    title: 'Review System Design Notes',
    description: null,
    priority: 'medium',
    task_type: 'career',
    status: 'planned',
    due_at: null,
    scheduled_date: null,
    estimated_minutes: 45,
    actual_minutes: 0,
    is_blocked: false,
    unblocks_count: 0,
    created_at: '2026-10-10T00:00:00.000Z',
    updated_at: '2026-10-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('Phase 16F — Career Intelligence & Next Best Action Integration', () => {
  const scorer = new CandidateScorer();
  const generator = new CandidateGenerator();

  describe('1. Assessment Deadline Urgency Contract', () => {
    it('T1: awards +0 urgency for an assessment deadline strictly in the past (expired submission window)', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
        currentDate: '2026-10-15',
      });

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-past-deadline',
        task: createMockTask({ id: 'task-past-deadline', application_id: 'app-1' }),
        careerStage: 'assessment',
        careerAssessmentDeadline: '2026-10-15T08:00:00.000Z', // 2 hours in the past
        companyName: 'Acme Corp',
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(0);
      expect(result.primaryReason.code).not.toBe('career_assessment_due');
    });

    it('T2: awards +20 urgency for an assessment deadline occurring exactly now', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
        currentDate: '2026-10-15',
      });

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-now-deadline',
        task: createMockTask({ id: 'task-now-deadline', application_id: 'app-1' }),
        careerStage: 'assessment',
        careerAssessmentDeadline: '2026-10-15T10:00:00.000Z', // Exactly now
        companyName: 'Acme Corp',
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(20);
      expect(result.primaryReason.code).toBe('career_assessment_due');
      expect(result.primaryReason.explanation).toContain('Acme Corp');
    });

    it('T3: awards +20 urgency for an assessment deadline occurring later today', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
        currentDate: '2026-10-15',
      });

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-today-deadline',
        task: createMockTask({ id: 'task-today-deadline', application_id: 'app-1' }),
        careerStage: 'assessment',
        careerAssessmentDeadline: '2026-10-15T18:00:00.000Z', // 8 hours later today
        companyName: 'Stripe',
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(20);
      expect(result.primaryReason.code).toBe('career_assessment_due');
    });

    it('T4: awards +15 urgency for an assessment deadline future within 48 hours', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
        currentDate: '2026-10-15',
      });

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-near-deadline',
        task: createMockTask({ id: 'task-near-deadline', application_id: 'app-1' }),
        careerStage: 'assessment',
        careerAssessmentDeadline: '2026-10-16T22:00:00.000Z', // 36 hours ahead
        companyName: 'Google',
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(15);
      expect(result.primaryReason.code).toBe('career_assessment_due');
    });

    it('T5: awards +8 urgency for an assessment deadline within 7 days (48h to 168h)', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
        currentDate: '2026-10-15',
      });

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-week-deadline',
        task: createMockTask({ id: 'task-week-deadline', application_id: 'app-1' }),
        careerStage: 'assessment',
        careerAssessmentDeadline: '2026-10-19T10:00:00.000Z', // 96 hours (4 days) ahead
        companyName: 'Meta',
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(8);
      expect(result.primaryReason.code).toBe('career_assessment_due');
    });

    it('T6: awards +0 urgency for distant assessment deadline beyond 7 days (> 168h)', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
        currentDate: '2026-10-15',
      });

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-distant-deadline',
        task: createMockTask({ id: 'task-distant-deadline', application_id: 'app-1' }),
        careerStage: 'assessment',
        careerAssessmentDeadline: '2026-10-25T10:00:00.000Z', // 10 days ahead
        companyName: 'Apple',
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(0);
    });

    it('T7: awards +0 urgency when assessment deadline is null or invalid', () => {
      const context = createMockContext();

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-null-deadline',
        task: createMockTask({ id: 'task-null-deadline', application_id: 'app-1' }),
        careerStage: 'assessment',
        careerAssessmentDeadline: null,
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(0);
    });
  });

  describe('2. Interview Urgency Window & Upper Bound', () => {
    it('T8: awards +20 urgency for interview scheduled within 24 hours', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
        currentDate: '2026-10-15',
      });

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-int-24',
        task: createMockTask({ id: 'task-int-24', application_id: 'app-int' }),
        careerInterviewScheduledAt: '2026-10-15T22:00:00.000Z', // 12 hours ahead
        careerInterviewRoundType: 'technical',
        companyName: 'Anthropic',
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(20);
      expect(result.primaryReason.code).toBe('career_interview_imminent');
      expect(result.primaryReason.explanation).toContain('technical interview for Anthropic');
    });

    it('T9: awards +15 urgency for interview scheduled between 24h and 72h', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
      });

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-int-48',
        task: createMockTask({ id: 'task-int-48', application_id: 'app-int' }),
        careerInterviewScheduledAt: '2026-10-17T10:00:00.000Z', // 48 hours ahead
        careerInterviewRoundType: 'behavioral',
        companyName: 'Databricks',
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(15);
      expect(result.primaryReason.code).toBe('career_interview_imminent');
    });

    it('T10: awards +8 urgency for interview scheduled between 72h and 168h (7 days)', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
      });

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-int-96',
        task: createMockTask({ id: 'task-int-96', application_id: 'app-int' }),
        careerInterviewScheduledAt: '2026-10-19T10:00:00.000Z', // 96 hours (4 days) ahead
        careerInterviewRoundType: 'system_design',
        companyName: 'OpenAI',
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(8);
      expect(result.primaryReason.code).toBe('career_interview_imminent');
    });

    it('T11: awards +0 urgency for distant interview beyond 168 hours (7 days upper bound)', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
      });

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-int-distant',
        task: createMockTask({ id: 'task-int-distant', application_id: 'app-int' }),
        careerInterviewScheduledAt: '2026-10-25T10:00:00.000Z', // 240 hours (10 days) ahead
        careerInterviewRoundType: 'final',
        companyName: 'Microsoft',
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(0);
    });

    it('T12: awards +0 urgency for interview scheduled in the past', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
      });

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-int-past',
        task: createMockTask({ id: 'task-int-past', application_id: 'app-int' }),
        careerInterviewScheduledAt: '2026-10-14T10:00:00.000Z', // Past interview
        careerInterviewRoundType: 'technical',
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(0);
    });
  });

  describe('3. Application Follow-Up (Fixed 336-Hour Threshold)', () => {
    it('T13: triggers follow-up bonus (+12) when activity elapsed hours >= 336.0 (14 full days)', () => {
      const context = createMockContext();

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-follow-up',
        task: createMockTask({ id: 'task-follow-up', application_id: 'app-stale' }),
        isCareerFollowUpDue: true,
        companyName: 'Figma',
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(12);
      expect(result.primaryReason.code).toBe('career_follow_up_due');
      expect(result.primaryReason.explanation).toContain('Figma');
    });

    it('T14: does NOT trigger follow-up bonus when under 336 hours', () => {
      const context = createMockContext();

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-fresh',
        task: createMockTask({ id: 'task-fresh', application_id: 'app-fresh' }),
        isCareerFollowUpDue: false,
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(0);
      expect(result.primaryReason.code).not.toBe('career_follow_up_due');
    });
  });

  describe('4. Required-Skill Gap & Featured Project Rules', () => {
    it('T15: awards +10 for task linked to unacquired required skill', () => {
      const context = createMockContext();

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-skill-gap',
        task: createMockTask({ id: 'task-skill-gap' }),
        hasRequiredSkillGap: true,
        requiredSkillName: 'Kubernetes',
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(10);
      expect(result.primaryReason.code).toBe('career_required_skill_gap');
      expect(result.primaryReason.explanation).toContain('Kubernetes');
    });

    it('T16: awards +8 for featured project preparation task', () => {
      const context = createMockContext();

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-project-prep',
        task: createMockTask({ id: 'task-project-prep', project_id: 'prj-featured' }),
        isFeaturedProjectPrep: true,
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(8);
      expect(result.primaryReason.code).toBe('career_project_prep');
    });

    it('T17: strictly caps careerSignal at +25 when multiple bonuses combine', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
      });

      // Interview (20) + Assessment (15) + Follow-up (12) + Skill Gap (10) + Project (8) = 65
      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-mega-career',
        task: createMockTask({ id: 'task-mega-career', application_id: 'app-1', project_id: 'prj-1' }),
        careerInterviewScheduledAt: '2026-10-15T20:00:00.000Z', // +20
        careerStage: 'assessment',
        careerAssessmentDeadline: '2026-10-16T10:00:00.000Z', // +15
        isCareerFollowUpDue: true, // +12
        hasRequiredSkillGap: true, // +10
        isFeaturedProjectPrep: true, // +8
      };

      const result = scorer.scoreCandidate(candidate, context);
      expect(result.scoreBreakdown.careerSignal).toBe(25); // CAPPED
      expect(result.scoreBreakdown.totalScore).toBeLessThanOrEqual(100);
    });
  });

  describe('5. Invariants & Candidate Generation Rules', () => {
    it('T18: strictly excludes blocked tasks from candidate generation even with imminent interview', () => {
      const blockedTask = createMockTask({
        id: 'task-blocked',
        application_id: 'app-imminent',
        is_blocked: true,
      });

      const context = createMockContext({
        openTasks: [blockedTask],
        career: {
          activeApplications: [
            {
              id: 'app-imminent',
              company_name: 'Netflix',
              role_title: 'Software Engineer',
              stage: 'interview',
              deadline: null,
              last_meaningful_activity_at: '2026-10-15T00:00:00.000Z',
              is_follow_up_eligible: false,
              featured_project_ids: [],
            },
          ],
          upcomingInterviews: [
            {
              id: 'int-1',
              application_id: 'app-imminent',
              round_number: 1,
              round_type: 'technical',
              scheduled_at: '2026-10-15T12:00:00.000Z', // In 2 hours
              status: 'scheduled',
            },
          ],
          requiredSkillGaps: [],
          taskSkillsMap: {},
          featuredProjectIds: [],
        },
      });

      const candidates = generator.generateCandidates(context);
      expect(candidates).toHaveLength(0); // Blocked task invariant preserved
    });

    it('T19: excludes terminal applications from career context and follow-up eligibility', () => {
      const openTask = createMockTask({
        id: 'task-terminal',
        application_id: 'app-rejected',
        priority: 'medium',
      });

      // Rejected stage application (terminal)
      const context = createMockContext({
        openTasks: [openTask],
        career: {
          activeApplications: [], // ContextBuilder excludes terminal applications
          upcomingInterviews: [],
          requiredSkillGaps: [],
          taskSkillsMap: {},
          featuredProjectIds: [],
        },
      });

      const candidates = generator.generateCandidates(context);
      expect(candidates).toHaveLength(1);

      const scored = scorer.scoreCandidate(candidates[0]!, context);
      expect(scored.scoreBreakdown.careerSignal).toBe(0);
    });

    it('T20: does NOT award skill bonus from text matching in title or description without task_skills record', () => {
      const openTask = createMockTask({
        id: 'task-text-match',
        title: 'Learn Kubernetes deployment patterns',
        description: 'Comprehensive study of Kubernetes pods and services',
      });

      const context = createMockContext({
        openTasks: [openTask],
        career: {
          activeApplications: [],
          upcomingInterviews: [],
          requiredSkillGaps: [
            { skill_id: 'skill-k8s', skill_name: 'Kubernetes', importance: 'required' },
          ],
          taskSkillsMap: {}, // No structured task_skills record
          featuredProjectIds: [],
        },
      });

      const candidates = generator.generateCandidates(context);
      expect(candidates[0]).toBeDefined();
      const scored = scorer.scoreCandidate(candidates[0]!, context);
      expect(scored.scoreBreakdown.careerSignal).toBe(0); // Zero free-text inference
    });
  });

  describe('6. Regression Compatibility & Non-Career Invariance', () => {
    it('T21: user with zero career data produces bit-for-bit identical scores to non-career baseline', () => {
      const task1 = createMockTask({ id: 't1', priority: 'high', unblocks_count: 2 });
      const task2 = createMockTask({ id: 't2', priority: 'critical' });

      const contextNoCareer = createMockContext({
        openTasks: [task1, task2],
      });

      const scored1 = scorer.scoreCandidate({ type: 'focus_task', taskId: 't1', task: task1 }, contextNoCareer);
      const scored2 = scorer.scoreCandidate({ type: 'focus_task', taskId: 't2', task: task2 }, contextNoCareer);

      expect(scored1.scoreBreakdown.careerSignal).toBe(0);
      expect(scored2.scoreBreakdown.careerSignal).toBe(0);

      // Verify exact calculation: high (30) + 2 unblocks (10) = 40
      expect(scored1.scoreBreakdown.totalScore).toBe(40);
      // Critical (40)
      expect(scored2.scoreBreakdown.totalScore).toBe(40);
    });

    it('T22: critical overdue non-career task retains superior priority over ordinary career task', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
        currentDate: '2026-10-15',
      });

      // Non-career task: Critical priority (40) + Overdue (25) = 65 points
      const criticalNonCareer = createMockTask({
        id: 'task-crit',
        priority: 'critical',
        due_at: '2026-10-10T00:00:00.000Z', // Overdue
      });

      // Career task: Medium priority (20) + Interview within 24h (20) = 40 points
      const interviewTask = createMockTask({
        id: 'task-int',
        priority: 'medium',
        application_id: 'app-int',
      });

      const scoredCrit = scorer.scoreCandidate(
        { type: 'focus_task', taskId: 'task-crit', task: criticalNonCareer },
        context
      );
      const scoredInt = scorer.scoreCandidate(
        {
          type: 'focus_task',
          taskId: 'task-int',
          task: interviewTask,
          careerInterviewScheduledAt: '2026-10-15T20:00:00.000Z',
          careerInterviewRoundType: 'technical',
        },
        context
      );

      expect(scoredCrit.scoreBreakdown.totalScore).toBe(65);
      expect(scoredInt.scoreBreakdown.totalScore).toBe(40);

      const sorted = scorer.scoreCandidates(
        [
          {
            type: 'focus_task',
            taskId: 'task-int',
            task: interviewTask,
            careerInterviewScheduledAt: '2026-10-15T20:00:00.000Z',
          },
          { type: 'focus_task', taskId: 'task-crit', task: criticalNonCareer },
        ],
        context
      );

      expect(sorted[0]!.candidate.taskId).toBe('task-crit'); // Critical non-career task remains top
    });

    it('T23: deterministic evaluation across 100 repeated runs yields identical results', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
        currentDate: '2026-10-15',
      });

      const candidate: CandidateAction = {
        type: 'focus_task',
        taskId: 'task-eval',
        task: createMockTask({ id: 'task-eval', application_id: 'app-1' }),
        careerInterviewScheduledAt: '2026-10-16T10:00:00.000Z',
        companyName: 'Vercel',
      };

      const baseline = scorer.scoreCandidate(candidate, context);
      for (let i = 0; i < 100; i++) {
        const next = scorer.scoreCandidate(candidate, context);
        expect(next.scoreBreakdown).toEqual(baseline.scoreBreakdown);
        expect(next.primaryReason).toEqual(baseline.primaryReason);
        expect(next.confidence).toEqual(baseline.confidence);
      }
    });

    it('T24: reason precedence: overdue > critical > interview imminent > due today > assessment due', () => {
      const context = createMockContext({
        currentTimeIso: '2026-10-15T10:00:00.000Z',
        currentDate: '2026-10-15',
      });

      // Task with both interview imminent AND due today: interview takes precedence over due today
      const interviewAndDueToday = scorer.scoreCandidate(
        {
          type: 'focus_task',
          taskId: 't-int-due',
          task: createMockTask({ id: 't-int-due', due_at: '2026-10-15T18:00:00.000Z' }),
          careerInterviewScheduledAt: '2026-10-15T22:00:00.000Z',
        },
        context
      );
      expect(interviewAndDueToday.primaryReason.code).toBe('career_interview_imminent');

      // Task with both overdue AND interview imminent: overdue takes precedence over interview
      const overdueAndInterview = scorer.scoreCandidate(
        {
          type: 'focus_task',
          taskId: 't-od-int',
          task: createMockTask({ id: 't-od-int', due_at: '2026-10-10T10:00:00.000Z' }),
          careerInterviewScheduledAt: '2026-10-15T22:00:00.000Z',
        },
        context
      );
      expect(overdueAndInterview.primaryReason.code).toBe('overdue');
    });

    it('T25: reason precedence: high priority > follow-up due > project milestone next', () => {
      const context = createMockContext();

      // High priority AND follow-up due: high priority takes precedence
      const highPriorityAndFollowUp = scorer.scoreCandidate(
        {
          type: 'focus_task',
          taskId: 't-hp-fu',
          task: createMockTask({ id: 't-hp-fu', priority: 'high' }),
          isCareerFollowUpDue: true,
        },
        context
      );
      expect(highPriorityAndFollowUp.primaryReason.code).toBe('high_priority');

      // Follow-up due AND project milestone next: follow-up takes precedence
      const followUpAndMilestone = scorer.scoreCandidate(
        {
          type: 'focus_task',
          taskId: 't-fu-ms',
          task: createMockTask({ id: 't-fu-ms', priority: 'medium' }),
          isCareerFollowUpDue: true,
          isNextPendingMilestone: true,
          projectTitle: 'Compiler Project',
        },
        context
      );
      expect(followUpAndMilestone.primaryReason.code).toBe('career_follow_up_due');
    });
  });
});
