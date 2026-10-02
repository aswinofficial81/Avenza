import type {
  GoalRow,
  GoalInsert,
  GoalUpdate,
  GoalMilestoneRow,
  GoalMilestoneInsert,
  GoalMilestoneUpdate,
  GoalQueryInput,
  PaginatedList,
} from '@avenza/shared';

export interface GoalFindOptions extends GoalQueryInput {
  userId: string;
}

export interface IGoalsRepository {
  // Goal operations
  findGoals(options: GoalFindOptions): Promise<PaginatedList<GoalRow>>;
  findGoalById(id: string, userId: string): Promise<GoalRow | null>;
  createGoal(data: GoalInsert): Promise<GoalRow>;
  updateGoal(id: string, userId: string, data: GoalUpdate): Promise<GoalRow | null>;
  deleteGoal(id: string, userId: string): Promise<boolean>;

  // Milestone operations
  findMilestonesByGoalId(goalId: string, userId: string): Promise<GoalMilestoneRow[]>;
  findMilestoneById(milestoneId: string, goalId: string, userId: string): Promise<GoalMilestoneRow | null>;
  createMilestone(data: GoalMilestoneInsert, userId: string): Promise<GoalMilestoneRow>;
  updateMilestone(milestoneId: string, goalId: string, userId: string, data: GoalMilestoneUpdate): Promise<GoalMilestoneRow | null>;
  deleteMilestone(milestoneId: string, goalId: string, userId: string): Promise<boolean>;

  // Batch milestone counts for goals listing
  getMilestoneSummariesForGoals(goalIds: string[]): Promise<Map<string, { total: number; completed: number; overdueCount: number }>>;
}
