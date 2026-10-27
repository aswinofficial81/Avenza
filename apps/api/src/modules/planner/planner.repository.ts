import type { SupabaseClient } from '@supabase/supabase-js';
import { type Database, isMinuteAligned, type TaskStatus } from '@avenza/shared';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import type { ITasksRepository } from '../tasks/tasks.types';
import { defaultTasksRepository } from '../tasks/tasks.repository';

export interface ApplyScheduleBlockPayload {
  task_id: string;
  scheduled_start: string;
  scheduled_end: string;
  expected_updated_at?: string;
}

export interface ApplyScheduleRpcResult {
  applied_count: number;
  task_ids: string[];
}

export interface IPlannerRepository {
  applySchedule(
    userId: string,
    blocks: ApplyScheduleBlockPayload[]
  ): Promise<ApplyScheduleRpcResult>;
}

export class SupabasePlannerRepository implements IPlannerRepository {
  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) {}

  async applySchedule(
    userId: string,
    blocks: ApplyScheduleBlockPayload[]
  ): Promise<ApplyScheduleRpcResult> {
    const rpcClient = this.client as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: { applied_count?: number; task_ids?: string[] } | null; error: { message: string } | null }>;
    };

    const { data, error } = await rpcClient.rpc('planner_apply_schedule', {
      p_user_id: userId,
      p_blocks: blocks,
    });

    if (error) {
      throw new Error(`Failed to apply schedule: ${error.message}`);
    }

    const result = data as { applied_count?: number; task_ids?: string[] } | null;
    return {
      applied_count: result?.applied_count ?? 0,
      task_ids: result?.task_ids ?? [],
    };
  }
}

export class InMemoryPlannerRepository implements IPlannerRepository {
  constructor(private readonly tasksRepo: ITasksRepository = defaultTasksRepository) {}

  async applySchedule(
    userId: string,
    blocks: ApplyScheduleBlockPayload[]
  ): Promise<ApplyScheduleRpcResult> {
    // 1. Verify no internal payload overlap
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const b1 = blocks[i]!;
        const b2 = blocks[j]!;
        const s1 = new Date(b1.scheduled_start).getTime();
        const e1 = new Date(b1.scheduled_end).getTime();
        const s2 = new Date(b2.scheduled_start).getTime();
        const e2 = new Date(b2.scheduled_end).getTime();

        if (s1 < e2 && e1 > s2) {
          throw new Error('Payload contains overlapping schedule blocks');
        }
      }
    }

    // 2. Pre-verify all tasks and capture snapshots for rollback
    const snapshots: Array<{
      id: string;
      originalStatus: string;
      originalStart: string | null;
      originalEnd: string | null;
      updatedAt: string;
    }> = [];

    const updatedTaskIds: string[] = [];

    try {
      for (const block of blocks) {
        if (!isMinuteAligned(block.scheduled_start) || !isMinuteAligned(block.scheduled_end)) {
          throw new Error(
            `Schedule block timestamps for task ${block.task_id} must be aligned to whole-minute boundaries (zero seconds and fractional seconds)`
          );
        }

        const task = await this.tasksRepo.findTaskById(block.task_id, userId);
        if (!task) {
          throw new Error(`Task ${block.task_id} not found or belongs to another user`);
        }

        if (
          task.status === 'completed' ||
          task.status === 'cancelled' ||
          task.status === 'skipped' ||
          task.status === 'in_progress'
        ) {
          throw new Error(`Task ${block.task_id} is in non-schedulable status (${task.status}) and cannot be scheduled`);
        }

        const expectedDuration = (task.estimated_minutes && task.estimated_minutes > 0) ? task.estimated_minutes : 30;
        const durationMs = new Date(block.scheduled_end).getTime() - new Date(block.scheduled_start).getTime();
        if (durationMs % 60000 !== 0) {
          throw new Error(
            `Schedule block for task ${block.task_id} duration must be an exact number of minutes`
          );
        }
        const actualDuration = durationMs / 60000;
        if (actualDuration !== expectedDuration) {
          throw new Error(
            `Invalid block duration for task ${block.task_id}: scheduled duration (${actualDuration}m) does not match task estimate (${expectedDuration}m)`
          );
        }

        if (block.expected_updated_at && task.updated_at !== block.expected_updated_at) {
          throw new Error(`Stale proposal: task ${block.task_id} was modified since proposal generation`);
        }

        // Dependency check
        const deps = await this.tasksRepo.findDependenciesByTaskId(block.task_id, userId);
        const incomplete = deps.filter((d) => d.prerequisite.status !== 'completed');
        if (incomplete.length > 0) {
          throw new Error(`Task ${block.task_id} is blocked by ${incomplete.length} incomplete prerequisite(s)`);
        }

        snapshots.push({
          id: task.id,
          originalStatus: task.status,
          originalStart: task.scheduled_start,
          originalEnd: task.scheduled_end,
          updatedAt: task.updated_at,
        });
      }

      // 3. Apply updates
      for (const block of blocks) {
        const updated = await this.tasksRepo.updateTask(block.task_id, userId, {
          status: 'scheduled',
          scheduled_start: block.scheduled_start,
          scheduled_end: block.scheduled_end,
        });

        if (!updated) {
          throw new Error(`Failed to update task ${block.task_id}`);
        }

        updatedTaskIds.push(block.task_id);
      }

      return {
        applied_count: updatedTaskIds.length,
        task_ids: updatedTaskIds,
      };
    } catch (err) {
      // Compensating rollback for in-memory safety
      for (const snap of snapshots) {
        if (updatedTaskIds.includes(snap.id)) {
          await this.tasksRepo.updateTask(snap.id, userId, {
            status: snap.originalStatus as TaskStatus,
            scheduled_start: snap.originalStart,
            scheduled_end: snap.originalEnd,
          });
        }
      }
      throw err;
    }
  }
}

export const defaultPlannerRepository = new SupabasePlannerRepository();
