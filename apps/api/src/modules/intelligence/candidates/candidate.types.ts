import type { NextActionType } from '@avenza/shared';
import type { TaskContextItem } from '../context/context.types';

export interface CandidateAction {
  type: NextActionType;
  taskId: string;
  task: TaskContextItem;
  goalTitle?: string | null;
  milestoneTitle?: string | null;
}
