import type {
  GoalRow,
  GoalDto,
  GoalDetailDto,
  MilestoneDto,
  GoalDerivedMetrics,
  CreateGoalInput,
  UpdateGoalInput,
  CreateMilestoneInput,
  UpdateMilestoneInput,
  PaginatedList,
} from '@avenza/shared';
import type { GoalFindOptions, IGoalsRepository } from './goals.types';
import { defaultGoalsRepository } from './goals.repository';

export function calculateGoalMetrics(
  goal: GoalRow,
  milestones: Array<{ status: string; target_date: string | null }>
): GoalDerivedMetrics {
  const total = milestones.length;
  const completed = milestones.filter((m) => m.status === 'completed').length;
  const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // 1. Completed goals are always on track
  if (goal.status === 'completed') {
    return {
      milestoneCount: total,
      completedMilestoneCount: completed,
      progressPercentage: 100,
      healthStatus: 'on_track',
      healthReason: 'Goal has been completed.',
    };
  }

  // 2. Draft, Paused, or Archived goals have unknown health
  if (goal.status === 'draft' || goal.status === 'paused' || goal.status === 'archived') {
    return {
      milestoneCount: total,
      completedMilestoneCount: completed,
      progressPercentage,
      healthStatus: 'unknown',
      healthReason: `Goal is currently in ${goal.status} status.`,
    };
  }

  // 3. Missing target date
  if (!goal.target_date) {
    return {
      milestoneCount: total,
      completedMilestoneCount: completed,
      progressPercentage,
      healthStatus: 'unknown',
      healthReason: 'No target date set for timeline calculation.',
    };
  }

  const now = Date.now();
  const targetTime = new Date(goal.target_date).getTime();

  // 4. Goal target date passed and not completed
  if (now > targetTime && progressPercentage < 100) {
    return {
      milestoneCount: total,
      completedMilestoneCount: completed,
      progressPercentage,
      healthStatus: 'at_risk',
      healthReason: 'Target date has passed and goal is not yet completed.',
    };
  }

  // 5. Overdue milestones
  const hasOverdueMilestone = milestones.some(
    (m) =>
      m.status !== 'completed' &&
      m.status !== 'skipped' &&
      m.target_date &&
      new Date(m.target_date).getTime() < now
  );

  if (hasOverdueMilestone) {
    return {
      milestoneCount: total,
      completedMilestoneCount: completed,
      progressPercentage,
      healthStatus: 'at_risk',
      healthReason: 'One or more scheduled milestones are overdue.',
    };
  }

  // 6. Expected timeline pacing check (if start_date is set and started)
  if (goal.start_date) {
    const startTime = new Date(goal.start_date).getTime();
    if (now >= startTime && targetTime > startTime) {
      const elapsed = now - startTime;
      const totalDuration = targetTime - startTime;
      const expectedProgress = (elapsed / totalDuration) * 100;

      // If progress is behind schedule by more than 20%
      if (progressPercentage < expectedProgress - 20) {
        return {
          milestoneCount: total,
          completedMilestoneCount: completed,
          progressPercentage,
          healthStatus: 'at_risk',
          healthReason: `Actual progress (${progressPercentage}%) is behind scheduled pacing (${Math.round(expectedProgress)}%).`,
        };
      }
    }
  }

  // 7. Otherwise on track
  return {
    milestoneCount: total,
    completedMilestoneCount: completed,
    progressPercentage,
    healthStatus: 'on_track',
    healthReason: 'Goal progress is on schedule.',
  };
}

export class GoalsService {
  constructor(private readonly repository: IGoalsRepository = defaultGoalsRepository) {}

  async listGoals(options: GoalFindOptions): Promise<PaginatedList<GoalDto>> {
    const rawResult = await this.repository.findGoals(options);
    const goalIds = rawResult.data.map((g) => g.id);

    // Fetch batch summaries to avoid N+1 query overhead
    const summaries = await this.repository.getMilestoneSummariesForGoals(goalIds);

    const goalsWithMetrics: GoalDto[] = rawResult.data.map((goal) => {
      const summary = summaries.get(goal.id) || { total: 0, completed: 0, overdueCount: 0 };
      const progressPercentage =
        summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

      // Calculate health using summary signals
      let healthStatus = 'unknown' as GoalDerivedMetrics['healthStatus'];
      let healthReason: string | undefined;

      if (goal.status === 'completed') {
        healthStatus = 'on_track';
        healthReason = 'Goal has been completed.';
      } else if (goal.status === 'draft' || goal.status === 'paused' || goal.status === 'archived') {
        healthStatus = 'unknown';
        healthReason = `Goal is in ${goal.status} status.`;
      } else if (!goal.target_date) {
        healthStatus = 'unknown';
        healthReason = 'No target date set.';
      } else {
        const now = Date.now();
        const targetTime = new Date(goal.target_date).getTime();

        if (now > targetTime && progressPercentage < 100) {
          healthStatus = 'at_risk';
          healthReason = 'Target date has passed.';
        } else if (summary.overdueCount > 0) {
          healthStatus = 'at_risk';
          healthReason = 'Has overdue milestones.';
        } else if (goal.start_date) {
          const startTime = new Date(goal.start_date).getTime();
          if (now >= startTime && targetTime > startTime) {
            const expected = ((now - startTime) / (targetTime - startTime)) * 100;
            if (progressPercentage < expected - 20) {
              healthStatus = 'at_risk';
              healthReason = `Actual progress is behind scheduled pacing.`;
            } else {
              healthStatus = 'on_track';
              healthReason = 'Progress is on schedule.';
            }
          } else {
            healthStatus = 'on_track';
            healthReason = 'Progress is on schedule.';
          }
        } else {
          healthStatus = 'on_track';
          healthReason = 'Progress is on schedule.';
        }
      }

      return {
        ...goal,
        goal_type: goal.goal_type as GoalDto['goal_type'],
        status: goal.status as GoalDto['status'],
        priority: goal.priority as GoalDto['priority'],
        metrics: {
          milestoneCount: summary.total,
          completedMilestoneCount: summary.completed,
          progressPercentage: goal.status === 'completed' ? 100 : progressPercentage,
          healthStatus,
          healthReason,
        },
      };
    });

    // If health filter is specified, filter the in-memory batch results
    let filteredData = goalsWithMetrics;
    if (options.health) {
      filteredData = filteredData.filter((g) => g.metrics.healthStatus === options.health);
    }

    return {
      data: filteredData,
      pagination: {
        ...rawResult.pagination,
        total: options.health ? filteredData.length : rawResult.pagination.total,
      },
    };
  }

  async getGoalById(id: string, userId: string): Promise<GoalDetailDto | null> {
    const goal = await this.repository.findGoalById(id, userId);
    if (!goal) return null;

    const milestones = await this.repository.findMilestonesByGoalId(id, userId);
    const metrics = calculateGoalMetrics(
      goal,
      milestones.map((m) => ({ status: m.status, target_date: m.target_date }))
    );

    const milestoneDtos: MilestoneDto[] = milestones.map((m) => ({
      ...m,
      status: m.status as MilestoneDto['status'],
      priority: m.priority as MilestoneDto['priority'],
    }));

    return {
      ...goal,
      goal_type: goal.goal_type as GoalDetailDto['goal_type'],
      status: goal.status as GoalDetailDto['status'],
      priority: goal.priority as GoalDetailDto['priority'],
      metrics,
      milestones: milestoneDtos,
    };
  }

  async createGoal(input: CreateGoalInput, userId: string): Promise<GoalDto> {
    const created = await this.repository.createGoal({
      user_id: userId,
      title: input.title.trim(),
      description: input.description ?? null,
      goal_type: input.goal_type,
      priority: input.priority,
      status: input.status,
      start_date: input.start_date ?? null,
      target_date: input.target_date ?? null,
      desired_outcome: input.desired_outcome ?? null,
      completion_criteria: input.completion_criteria ?? null,
      notes: input.notes ?? null,
      completed_at: input.status === 'completed' ? new Date().toISOString() : null,
    });

    const metrics = calculateGoalMetrics(created, []);

    return {
      ...created,
      goal_type: created.goal_type as GoalDto['goal_type'],
      status: created.status as GoalDto['status'],
      priority: created.priority as GoalDto['priority'],
      metrics,
    };
  }

  async updateGoal(id: string, userId: string, input: UpdateGoalInput): Promise<GoalDetailDto | null> {
    const existing = await this.repository.findGoalById(id, userId);
    if (!existing) return null;

    // Handle lifecycle status transitions
    let completedAt = input.completed_at;
    if (input.status === 'completed' && !existing.completed_at && !completedAt) {
      completedAt = new Date().toISOString();
    } else if (input.status && input.status !== 'completed' && existing.status === 'completed') {
      completedAt = null;
    }

    const updated = await this.repository.updateGoal(id, userId, {
      ...input,
      ...(completedAt !== undefined ? { completed_at: completedAt } : {}),
    });

    if (!updated) return null;

    const milestones = await this.repository.findMilestonesByGoalId(id, userId);
    const metrics = calculateGoalMetrics(
      updated,
      milestones.map((m) => ({ status: m.status, target_date: m.target_date }))
    );

    const milestoneDtos: MilestoneDto[] = milestones.map((m) => ({
      ...m,
      status: m.status as MilestoneDto['status'],
      priority: m.priority as MilestoneDto['priority'],
    }));

    return {
      ...updated,
      goal_type: updated.goal_type as GoalDetailDto['goal_type'],
      status: updated.status as GoalDetailDto['status'],
      priority: updated.priority as GoalDetailDto['priority'],
      metrics,
      milestones: milestoneDtos,
    };
  }

  async deleteGoal(id: string, userId: string): Promise<boolean> {
    return this.repository.deleteGoal(id, userId);
  }

  async listMilestones(goalId: string, userId: string): Promise<MilestoneDto[] | null> {
    const goal = await this.repository.findGoalById(goalId, userId);
    if (!goal) return null;

    const milestones = await this.repository.findMilestonesByGoalId(goalId, userId);
    return milestones.map((m) => ({
      ...m,
      status: m.status as MilestoneDto['status'],
      priority: m.priority as MilestoneDto['priority'],
    }));
  }

  async createMilestone(
    goalId: string,
    userId: string,
    input: CreateMilestoneInput
  ): Promise<MilestoneDto | null> {
    const goal = await this.repository.findGoalById(goalId, userId);
    if (!goal) return null;

    const created = await this.repository.createMilestone(
      {
        goal_id: goalId,
        title: input.title.trim(),
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        order_index: input.order_index,
        start_date: input.start_date ?? null,
        target_date: input.target_date ?? null,
        completed_at: input.status === 'completed' ? new Date().toISOString() : null,
      },
      userId
    );

    return {
      ...created,
      status: created.status as MilestoneDto['status'],
      priority: created.priority as MilestoneDto['priority'],
    };
  }

  async updateMilestone(
    milestoneId: string,
    goalId: string,
    userId: string,
    input: UpdateMilestoneInput
  ): Promise<MilestoneDto | null> {
    const existing = await this.repository.findMilestoneById(milestoneId, goalId, userId);
    if (!existing) return null;

    let completedAt = input.completed_at;
    if (input.status === 'completed' && !existing.completed_at && !completedAt) {
      completedAt = new Date().toISOString();
    } else if (input.status && input.status !== 'completed' && existing.status === 'completed') {
      completedAt = null;
    }

    const updated = await this.repository.updateMilestone(milestoneId, goalId, userId, {
      ...input,
      ...(completedAt !== undefined ? { completed_at: completedAt } : {}),
    });

    if (!updated) return null;

    return {
      ...updated,
      status: updated.status as MilestoneDto['status'],
      priority: updated.priority as MilestoneDto['priority'],
    };
  }

  async deleteMilestone(milestoneId: string, goalId: string, userId: string): Promise<boolean> {
    return this.repository.deleteMilestone(milestoneId, goalId, userId);
  }
}

export const defaultGoalsService = new GoalsService();
