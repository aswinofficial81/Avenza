import type { IntelligenceContext } from '../context/context.types';
import type { CandidateAction } from './candidate.types';

export class CandidateGenerator {
  /**
   * Generates actionable candidates from the bounded intelligence context.
   * Only actionable, non-blocked, uncompleted, non-terminal tasks are eligible.
   */
  generateCandidates(context: IntelligenceContext): CandidateAction[] {
    const {
      openTasks,
      activeGoals,
      activeMilestones,
      activeProjects,
      activeFocusSessionTaskId,
      recentFocusSessions,
      recentEvidence,
    } = context;

    // Fast lookup maps for goal/milestone titles
    const goalMap = new Map(activeGoals.map((g) => [g.id, g.title]));
    const milestoneMap = new Map(activeMilestones.map((m) => [m.id, m.title]));

    // Fast lookup maps for projects and project milestones
    const projectList = activeProjects || context.projects || [];
    const projectMap = new Map(projectList.map((p) => [p.project_id, p]));
    const projectMilestoneMap = new Map<string, { title: string; target_date: string | null }>();
    for (const p of projectList) {
      if (p.next_pending_milestone) {
        projectMilestoneMap.set(p.next_pending_milestone.id, {
          title: p.next_pending_milestone.title,
          target_date: p.next_pending_milestone.target_date,
        });
      }
      if (p.active_milestone) {
        projectMilestoneMap.set(p.active_milestone.id, {
          title: p.active_milestone.title,
          target_date: p.active_milestone.target_date,
        });
      }
    }

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

    // Career context lookups
    const careerContext = context.career;
    const applicationMap = new Map(careerContext?.activeApplications?.map((a) => [a.id, a]) || []);
    const interviewMap = new Map<string, { scheduled_at: string | null; round_type: string }>();
    if (careerContext?.upcomingInterviews) {
      for (const interview of careerContext.upcomingInterviews) {
        const existing = interviewMap.get(interview.application_id);
        if (!existing) {
          interviewMap.set(interview.application_id, {
            scheduled_at: interview.scheduled_at,
            round_type: interview.round_type,
          });
        } else if (
          interview.scheduled_at &&
          (!existing.scheduled_at || interview.scheduled_at < existing.scheduled_at)
        ) {
          interviewMap.set(interview.application_id, {
            scheduled_at: interview.scheduled_at,
            round_type: interview.round_type,
          });
        }
      }
    }

    const missingSkillMap = new Map(careerContext?.requiredSkillGaps?.map((s) => [s.skill_id, s.skill_name]) || []);
    const taskSkillsMap = careerContext?.taskSkillsMap || {};
    const featuredProjectIdsSet = new Set(careerContext?.featuredProjectIds || []);

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

      let projectId: string | null = null;
      let projectTitle: string | null = null;
      let projectHealth: 'completed' | 'at_risk' | 'on_track' | 'unknown' | null = null;
      let projectProgress: number | null = null;
      let projectTargetDate: string | null = null;
      let projectMilestoneId: string | null = null;
      let projectMilestoneTitle: string | null = null;
      let projectMilestoneTargetDate: string | null = null;
      let isNextPendingMilestone = false;

      if (task.project_id) {
        const proj = projectMap.get(task.project_id);
        if (proj) {
          projectId = proj.project_id;
          projectTitle = proj.title;
          projectHealth = proj.health;
          projectProgress = proj.progress;
          projectTargetDate = proj.target_date;

          if (task.project_milestone_id) {
            projectMilestoneId = task.project_milestone_id;
            const isNext = proj.next_pending_milestone?.id === task.project_milestone_id;
            isNextPendingMilestone = isNext;
            const mInfo = projectMilestoneMap.get(task.project_milestone_id);
            projectMilestoneTitle = mInfo?.title ?? (isNext ? proj.next_pending_milestone?.title ?? null : null);
            projectMilestoneTargetDate = mInfo?.target_date ?? (isNext ? proj.next_pending_milestone?.target_date ?? null : null);
          }
        }
      }

      // Career resolution
      let applicationId: string | null = null;
      let companyName: string | null = null;
      let careerStage: string | null = null;
      let careerInterviewScheduledAt: string | null = null;
      let careerInterviewRoundType: string | null = null;
      let careerAssessmentDeadline: string | null = null;
      let isCareerFollowUpDue = false;

      if (task.application_id) {
        const app = applicationMap.get(task.application_id);
        if (app) {
          applicationId = app.id;
          companyName = app.company_name;
          careerStage = app.stage;
          if (app.stage === 'assessment') {
            careerAssessmentDeadline = app.deadline;
          }
          isCareerFollowUpDue = app.is_follow_up_eligible;

          const interview = interviewMap.get(task.application_id);
          if (interview) {
            careerInterviewScheduledAt = interview.scheduled_at;
            careerInterviewRoundType = interview.round_type;
          }
        }
      }

      let hasRequiredSkillGap = false;
      let requiredSkillName: string | null = null;
      const linkedSkillIds = taskSkillsMap[task.id] || [];
      for (const sId of linkedSkillIds) {
        if (missingSkillMap.has(sId)) {
          hasRequiredSkillGap = true;
          requiredSkillName = missingSkillMap.get(sId) || null;
          break;
        }
      }

      const isFeaturedProjectPrep = Boolean(task.project_id && featuredProjectIdsSet.has(task.project_id));

      candidates.push({
        type: actionType,
        taskId: task.id,
        task,
        goalTitle: task.goal_id ? goalMap.get(task.goal_id) || null : null,
        milestoneTitle: task.milestone_id ? milestoneMap.get(task.milestone_id) || null : null,
        projectId,
        projectTitle,
        projectHealth,
        projectProgress,
        projectTargetDate,
        projectMilestoneId,
        projectMilestoneTitle,
        projectMilestoneTargetDate,
        isNextPendingMilestone,
        applicationId,
        companyName,
        careerStage,
        careerInterviewScheduledAt,
        careerInterviewRoundType,
        careerAssessmentDeadline,
        isCareerFollowUpDue,
        hasRequiredSkillGap,
        requiredSkillName,
        isFeaturedProjectPrep,
      });
    }

    return candidates;
  }
}
