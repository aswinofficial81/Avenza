import type {
  NextActionQueryInput,
  NextActionResponseData,
} from '@avenza/shared';
import { IntelligenceContextBuilder } from './context/context-builder';
import { CandidateGenerator } from './candidates/candidate-generator';
import { CandidateScorer } from './scoring/candidate-scoring';

export class IntelligenceService {
  constructor(
    private readonly contextBuilder: IntelligenceContextBuilder = new IntelligenceContextBuilder(),
    private readonly candidateGenerator: CandidateGenerator = new CandidateGenerator(),
    private readonly candidateScorer: CandidateScorer = new CandidateScorer()
  ) {}

  async getNextAction(
    userId: string,
    query?: NextActionQueryInput
  ): Promise<NextActionResponseData> {
    // 1. Gather relevant bounded user context
    const context = await this.contextBuilder.buildContext(userId, query);

    // 2. Generate eligible candidate actions
    const candidates = this.candidateGenerator.generateCandidates(context);

    // 3. Handle calm no-action state when no actionable tasks exist
    if (candidates.length === 0) {
      return {
        action: null,
        reason: {
          code: 'no_actionable_tasks',
          label: 'Nothing urgent',
          explanation: 'There are no actionable tasks available right now.',
        },
        confidence: 'high',
        generatedAt: new Date().toISOString(),
        scoreBreakdown: null,
      };
    }

    // 4. Deterministically score and sort candidates
    const scoredCandidates = this.candidateScorer.scoreCandidates(candidates, context);
    const topScored = scoredCandidates[0];

    if (!topScored) {
      return {
        action: null,
        reason: {
          code: 'no_actionable_tasks',
          label: 'Nothing urgent',
          explanation: 'There are no actionable tasks available right now.',
        },
        confidence: 'high',
        generatedAt: new Date().toISOString(),
        scoreBreakdown: null,
      };
    }

    return {
      action: {
        type: topScored.candidate.type,
        taskId: topScored.candidate.taskId,
        title: topScored.candidate.task.title,
        score: topScored.scoreBreakdown.totalScore,
        goalId: topScored.candidate.task.goal_id,
        goalTitle: topScored.candidate.goalTitle,
        milestoneId: topScored.candidate.task.milestone_id,
        milestoneTitle: topScored.candidate.milestoneTitle,
        priority: topScored.candidate.task.priority,
        taskType: topScored.candidate.task.task_type,
        status: topScored.candidate.task.status,
        dueAt: topScored.candidate.task.due_at,
        scheduledDate: topScored.candidate.task.scheduled_date,
        estimatedMinutes: topScored.candidate.task.estimated_minutes,
        projectId: topScored.candidate.projectId ?? null,
        projectTitle: topScored.candidate.projectTitle ?? null,
        projectHealth: topScored.candidate.projectHealth ?? null,
        projectProgress: topScored.candidate.projectProgress ?? null,
        projectMilestoneId: topScored.candidate.projectMilestoneId ?? null,
        projectMilestoneTitle: topScored.candidate.projectMilestoneTitle ?? null,
        projectMilestoneTargetDate: topScored.candidate.projectMilestoneTargetDate ?? null,
        applicationId: topScored.candidate.applicationId ?? null,
        companyName: topScored.candidate.companyName ?? null,
        careerRoundType: topScored.candidate.careerInterviewRoundType ?? null,
        careerSkillName: topScored.candidate.requiredSkillName ?? null,
      },
      reason: topScored.primaryReason,
      confidence: topScored.confidence,
      generatedAt: new Date().toISOString(),
      scoreBreakdown: topScored.scoreBreakdown,
    };
  }
}
