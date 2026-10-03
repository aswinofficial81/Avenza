import type { IntelligenceContext } from '../context/context.types';
import type { CandidateAction } from './candidate.types';

export class CandidateGenerator {
  /**
   * Generates actionable candidates from the bounded intelligence context.
   * Only actionable, non-blocked, uncompleted, non-terminal tasks are eligible.
   */
  generateCandidates(context: IntelligenceContext): CandidateAction[] {
    const { openTasks, activeGoals, activeMilestones, activeFocusSessionTaskId, recentFocusSessions, recentEvidence } =
      context;

    // Fast lookup maps for goal/milestone titles
    const goalMap = new Map(activeGoals.map((g) => [g.id, g.title]));
    const milestoneMap = new Map(activeMilestones.map((m) => [m.id, m.title]));

    // Find task IDs that have recent focus sessions
    const recentFocusTaskIds = new Set(
      recentFocusSessions.map((s) => s.task_id).filter((id): id is string => Boolean(id))
    );

    // Find task IDs with unverified evidence
    const unverifiedEvidenceTaskIds = new Set<string>();
    for (const ev of recentEvidence) {
      if (ev.verification_status === 'unverified') {
        for (const tId of ev.linked_task_ids) {
          unverifiedEvidenceTaskIds.add(tId);
        }
      }
    }

    const candidates: CandidateAction[] = [];

    for (const task of openTasks) {
      // Invariant: Blocked tasks MUST NOT become candidates
      if (task.is_blocked) {
        continue;
      }

      // Invariant: Completed, cancelled, or skipped tasks are excluded
      if (task.status === 'completed' || task.status === 'cancelled' || task.status === 'skipped') {
        continue;
      }

      // Determine the actionable type
      let actionType: CandidateAction['type'] = 'start_task';

      if (task.id === activeFocusSessionTaskId) {
        actionType = 'continue_task';
      } else if (task.status === 'in_progress' && recentFocusTaskIds.has(task.id)) {
        actionType = 'continue_task';
      } else if (unverifiedEvidenceTaskIds.has(task.id)) {
        actionType = 'review_task';
      } else if (
        task.task_type === 'dsa' ||
        task.task_type === 'study' ||
        task.task_type === 'practice' ||
        task.task_type === 'project' ||
        task.priority === 'critical' ||
        task.priority === 'high' ||
        (task.estimated_minutes !== null && task.estimated_minutes >= 30)
      ) {
        actionType = 'focus_task';
      } else if (
        task.status === 'in_progress' &&
        task.estimated_minutes !== null &&
        task.actual_minutes >= task.estimated_minutes
      ) {
        actionType = 'complete_task';
      } else if (task.status === 'inbox' || task.status === 'planned') {
        actionType = 'start_task';
      } else {
        actionType = 'focus_task';
      }

      candidates.push({
        type: actionType,
        taskId: task.id,
        task,
        goalTitle: task.goal_id ? goalMap.get(task.goal_id) || null : null,
        milestoneTitle: task.milestone_id ? milestoneMap.get(task.milestone_id) || null : null,
      });
    }

    return candidates;
  }
}
