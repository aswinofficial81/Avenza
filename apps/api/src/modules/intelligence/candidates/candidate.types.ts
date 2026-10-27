import type { NextActionType } from '@avenza/shared';
import type { TaskContextItem } from '../context/context.types';

export interface CandidateAction {
  type: NextActionType;
  taskId: string;
  task: TaskContextItem;
  goalTitle?: string | null;
  milestoneTitle?: string | null;
  projectId?: string | null;
  projectTitle?: string | null;
  projectHealth?: 'completed' | 'at_risk' | 'on_track' | 'unknown' | null;
  projectProgress?: number | null;
  projectTargetDate?: string | null;
  projectMilestoneId?: string | null;
  projectMilestoneTitle?: string | null;
  projectMilestoneTargetDate?: string | null;
  isNextPendingMilestone?: boolean;
  applicationId?: string | null;
  companyName?: string | null;
  careerStage?: string | null;
  careerInterviewScheduledAt?: string | null;
  careerInterviewRoundType?: string | null;
  careerAssessmentDeadline?: string | null;
  isCareerFollowUpDue?: boolean;
  hasRequiredSkillGap?: boolean;
  requiredSkillName?: string | null;
  isFeaturedProjectPrep?: boolean;
}
