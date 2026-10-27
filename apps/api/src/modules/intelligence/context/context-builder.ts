import type { ITasksRepository } from '../../tasks/tasks.types';
import { defaultTasksRepository } from '../../tasks/tasks.repository';
import type { IGoalsRepository } from '../../goals/goals.types';
import { defaultGoalsRepository } from '../../goals/goals.repository';
import type { IFocusRepository } from '../../focus/focus.types';
import { defaultFocusRepository } from '../../focus/focus.repository';
import type { IEvidenceRepository } from '../../evidence/evidence.types';
import { SupabaseEvidenceRepository } from '../../evidence/evidence.repository';
import type { IPreferencesRepository } from '../../preferences/preferences.repository';
import { defaultPreferencesRepository } from '../../preferences/preferences.repository';
import type { IProfileRepository } from '../../identity/profile.repository';
import { defaultProfileRepository } from '../../identity/profile.repository';
import type { IProjectsRepository, ProjectCountsSummary } from '../../projects/projects.types';
import { defaultProjectsRepository } from '../../projects/projects.repository';
import { calculateProjectMetrics } from '../../projects/projects.service';
import type { ICareerRepository } from '../../career/career.repository';
import { SupabaseCareerRepository } from '../../career/career.repository.impl';
import type { ISkillsRepository } from '../../skills/skills.types';
import { SupabaseSkillsRepository } from '../../skills/skills.repository';
import {
  getTodayBoundaries,
  isValidTimezone,
} from '../../today/today.date-utils';
import type {
  EvidenceSummary,
  GoalStatus,
  MilestoneStatus,
  ProjectMilestoneRow,
  ProjectMilestoneStatus,
  ProjectPriority,
  ProjectStatus,
  ProjectType,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '@avenza/shared';
import type {
  CareerApplicationContextItem,
  CareerContext,
  CareerInterviewContextItem,
  CareerSkillGapContextItem,
  EvidenceContextItem,
  FocusContextItem,
  GoalContextItem,
  IntelligenceContext,
  MilestoneContextItem,
  ProjectContextItem,
  ProjectMilestoneContextItem,
  TaskContextItem,
} from './context.types';

export interface ContextBuilderOptions {
  date?: string;
  timezone?: string;
  currentTime?: string;
}

export const defaultCareerRepository: ICareerRepository = new SupabaseCareerRepository();
export const defaultSkillsRepository: ISkillsRepository = new SupabaseSkillsRepository();

export class IntelligenceContextBuilder {
  constructor(
    private readonly tasksRepository: ITasksRepository = defaultTasksRepository,
    private readonly goalsRepository: IGoalsRepository = defaultGoalsRepository,
    private readonly focusRepository: IFocusRepository = defaultFocusRepository,
    private readonly evidenceRepository: IEvidenceRepository = new SupabaseEvidenceRepository(),
    private readonly preferencesRepository: IPreferencesRepository = defaultPreferencesRepository,
    private readonly profileRepository: IProfileRepository = defaultProfileRepository,
    private readonly projectsRepository: IProjectsRepository = defaultProjectsRepository,
    private readonly careerRepository: ICareerRepository = defaultCareerRepository,
    private readonly skillsRepository: ISkillsRepository = defaultSkillsRepository
  ) {}

  async buildContext(
    userId: string,
    options?: ContextBuilderOptions
  ): Promise<IntelligenceContext> {
    // 1. Resolve effective timezone
    const [preferences, profile] = await Promise.all([
      this.preferencesRepository.findByUserId(userId).catch(() => null),
      this.profileRepository.findById(userId).catch(() => null),
    ]);

    let effectiveTimezone = 'UTC';
    if (options?.timezone && isValidTimezone(options.timezone)) {
      effectiveTimezone = options.timezone;
    } else if (preferences?.timezone && isValidTimezone(preferences.timezone)) {
      effectiveTimezone = preferences.timezone;
    } else if (profile?.timezone && isValidTimezone(profile.timezone)) {
      effectiveTimezone = profile.timezone;
    }

    const boundaries = getTodayBoundaries(options?.date, effectiveTimezone);
    const currentDate = boundaries.localDate;
    const currentTimeIso = options?.currentTime || (options?.date ? boundaries.startOfToday : new Date().toISOString());

    // 2. Fetch Active Goals & Milestones & Projects (bounded)
    const [
      goalsResult,
      tasksResult,
      allUserDeps,
      activeFocusSession,
      recentSessionsResult,
      recentEvidenceResult,
      projectsResult,
    ] = await Promise.all([
      this.goalsRepository.findGoals({ userId, status: 'active', pageSize: 50 }).catch(() => ({ data: [] })),
      this.tasksRepository.findTasks({
        userId,
        pageSize: 200,
        sortBy: 'created_at',
        sortOrder: 'desc',
      }),
      this.tasksRepository.getAllUserDependencies(userId).catch(() => []),
      this.focusRepository.findActiveSessionByUserId(userId).catch(() => null),
      this.focusRepository.findSessions({ userId, limit: 10, status: 'completed' }).catch(() => ({ data: [] })),
      this.evidenceRepository.findEvidence({ userId, limit: 10 }).catch(() => ({ data: [], summary: {} as unknown as EvidenceSummary })),
      this.projectsRepository.findProjects({ userId, page: 1, pageSize: 50, sortBy: 'created_at', sortOrder: 'desc' }).catch(() => ({ data: [] })),
    ]);

    // Active goals mapping
    const activeGoals: GoalContextItem[] = goalsResult.data.map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status as GoalStatus,
      priority: typeof g.priority === 'number' ? g.priority : 1,
    }));

    // Fetch milestones for active goals
    const activeMilestones: MilestoneContextItem[] = [];
    if (activeGoals.length > 0) {
      const milestonePromises = activeGoals.map((g) =>
        this.goalsRepository.findMilestonesByGoalId(g.id, userId).catch(() => [])
      );
      const milestoneArrays = await Promise.all(milestonePromises);
      for (const mArray of milestoneArrays) {
        for (const m of mArray) {
          activeMilestones.push({
            id: m.id,
            goalId: m.goal_id,
            title: m.title,
            status: m.status as MilestoneStatus,
            target_date: m.target_date,
          });
        }
      }
    }

    // 3. Process Projects (bounded, non-archived)
    const candidateProjects = (projectsResult?.data || []).filter((p) => p.status !== 'archived');
    const projectIds = candidateProjects.map((p) => p.id);

    let projectSummaries = new Map<string, ProjectCountsSummary>();
    let projectMilestonesList: ProjectMilestoneRow[][] = [];

    if (projectIds.length > 0) {
      const [fetchedSummaries, fetchedMilestones] = await Promise.all([
        this.projectsRepository.getProjectSummaries(projectIds).catch(() => new Map()),
        Promise.all(
          candidateProjects.map((p) =>
            this.projectsRepository.findMilestonesByProjectId(p.id, userId).catch(() => [])
          )
        ),
      ]);
      projectSummaries = fetchedSummaries;
      projectMilestonesList = fetchedMilestones;
    }

    const activeProjects: ProjectContextItem[] = candidateProjects.map((p, idx) => {
      const summary = projectSummaries.get(p.id) || {
        totalMilestones: 0,
        completedMilestones: 0,
        totalTasks: 0,
        completedTasks: 0,
        hasOverdueMilestones: false,
      };
      const metrics = calculateProjectMetrics(p, summary, new Date(currentTimeIso));

      let health: 'completed' | 'at_risk' | 'on_track' | 'unknown' = 'unknown';
      if (p.status === 'completed' || metrics.progressPercentage === 100) {
        health = 'completed';
      } else {
        health = metrics.healthStatus;
      }

      const milestones = projectMilestonesList[idx] || [];
      const pendingMilestones = milestones.filter(
        (m) => m.status === 'pending' || m.status === 'in_progress'
      );

      let nextPendingMilestone: ProjectMilestoneContextItem | null = null;
      if (pendingMilestones.length > 0) {
        pendingMilestones.sort((a, b) => {
          // 1. in_progress before pending
          if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
          if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;

          // 2. Earliest valid target_date
          if (a.target_date && b.target_date) {
            const cmp = a.target_date.localeCompare(b.target_date);
            if (cmp !== 0) return cmp;
          } else if (a.target_date && !b.target_date) {
            return -1;
          } else if (!a.target_date && b.target_date) {
            return 1;
          }

          // 3. order_index
          if (a.order_index !== b.order_index) {
            return a.order_index - b.order_index;
          }

          // 4. Milestone id
          return a.id.localeCompare(b.id);
        });

        const top = pendingMilestones[0];
        if (top) {
          nextPendingMilestone = {
            id: top.id,
            project_id: top.project_id,
            title: top.title,
            status: top.status as ProjectMilestoneStatus,
            order_index: top.order_index,
            target_date: top.target_date,
          };
        }
      }

      const inProgressMilestone = milestones.find((m) => m.status === 'in_progress');
      const activeMilestone: ProjectMilestoneContextItem | null = inProgressMilestone
        ? {
            id: inProgressMilestone.id,
            project_id: inProgressMilestone.project_id,
            title: inProgressMilestone.title,
            status: inProgressMilestone.status as ProjectMilestoneStatus,
            order_index: inProgressMilestone.order_index,
            target_date: inProgressMilestone.target_date,
          }
        : nextPendingMilestone;

      return {
        project_id: p.id,
        title: p.title,
        status: p.status as ProjectStatus,
        priority: p.priority as ProjectPriority,
        project_type: p.project_type as ProjectType,
        target_date: p.target_date,
        health,
        progress: metrics.progressPercentage,
        active_milestone: activeMilestone,
        next_pending_milestone: nextPendingMilestone,
        milestone_target_date: nextPendingMilestone?.target_date ?? null,
        task_summary: {
          totalTasks: summary.totalTasks,
          completedTasks: summary.completedTasks,
          openTasks: Math.max(0, summary.totalTasks - summary.completedTasks),
        },
      };
    });

    // 4. Process Tasks
    const allTasks = tasksResult.data;
    const openTasksRaw = allTasks.filter(
      (t) => t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'skipped'
    );
    const openTaskIds = openTasksRaw.map((t) => t.id);

    // Dependencies batch summaries
    const depSummaries = await this.tasksRepository.getDependencySummariesForTasks(openTaskIds, userId);

    // Unblocks count map: how many open tasks depend on task X?
    const unblocksCountMap = new Map<string, number>();
    const openTaskIdSet = new Set(openTaskIds);

    for (const dep of allUserDeps) {
      if (openTaskIdSet.has(dep.task_id)) {
        const currentCount = unblocksCountMap.get(dep.depends_on_task_id) || 0;
        unblocksCountMap.set(dep.depends_on_task_id, currentCount + 1);
      }
    }

    const openTasks: TaskContextItem[] = openTasksRaw.map((t) => {
      const summary = depSummaries.get(t.id);
      const isBlocked = (summary ? summary.uncompletedPrerequisites > 0 : false) || t.status === 'blocked';
      const unblocksCount = unblocksCountMap.get(t.id) || 0;

      return {
        id: t.id,
        goal_id: t.goal_id,
        milestone_id: t.milestone_id,
        project_id: t.project_id ?? null,
        project_milestone_id: t.project_milestone_id ?? null,
        application_id: t.application_id ?? null,
        title: t.title,
        description: t.description,
        priority: t.priority as TaskPriority,
        task_type: t.task_type as TaskType,
        status: t.status as TaskStatus,
        due_at: t.due_at,
        scheduled_date: t.scheduled_start ? t.scheduled_start.slice(0, 10) : null,
        estimated_minutes: t.estimated_minutes,
        actual_minutes: t.actual_minutes || 0,
        is_blocked: isBlocked,
        unblocks_count: unblocksCount,
        created_at: t.created_at,
        updated_at: t.updated_at,
      };
    });

    const recentCompletedTasks: TaskContextItem[] = allTasks
      .filter((t) => t.status === 'completed')
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        goal_id: t.goal_id,
        milestone_id: t.milestone_id,
        project_id: t.project_id ?? null,
        project_milestone_id: t.project_milestone_id ?? null,
        application_id: t.application_id ?? null,
        title: t.title,
        description: t.description,
        priority: t.priority as TaskPriority,
        task_type: t.task_type as TaskType,
        status: t.status as TaskStatus,
        due_at: t.due_at,
        scheduled_date: t.scheduled_start ? t.scheduled_start.slice(0, 10) : null,
        estimated_minutes: t.estimated_minutes,
        actual_minutes: t.actual_minutes || 0,
        is_blocked: false,
        unblocks_count: 0,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));

    // 5. Process Focus Sessions
    const recentFocusSessions: FocusContextItem[] = recentSessionsResult.data.map((s) => ({
      id: s.id,
      task_id: s.task_id,
      session_type: s.session_type,
      status: s.status,
      started_at: s.started_at,
      ended_at: s.ended_at,
      actual_minutes: s.actual_minutes,
    }));

    const activeFocusSessionTaskId =
      activeFocusSession && activeFocusSession.status === 'active' ? activeFocusSession.task_id : null;

    // 6. Process Evidence
    const evidenceIds = recentEvidenceResult.data.map((e) => e.id);
    let evidenceLinks: Array<{ evidence_id: string; entity_type: string; entity_id: string }> = [];
    if (evidenceIds.length > 0) {
      evidenceLinks = await this.evidenceRepository.findLinksForEvidenceIds(evidenceIds).catch(() => []);
    }

    const evidenceTaskMap = new Map<string, string[]>();
    for (const link of evidenceLinks) {
      if (link.entity_type === 'task') {
        const list = evidenceTaskMap.get(link.evidence_id) || [];
        list.push(link.entity_id);
        evidenceTaskMap.set(link.evidence_id, list);
      }
    }

    const recentEvidence: EvidenceContextItem[] = recentEvidenceResult.data.map((e) => ({
      id: e.id,
      evidence_type: e.evidence_type,
      title: e.title,
      verification_status: e.verification_status,
      occurred_at: e.occurred_at,
      linked_task_ids: evidenceTaskMap.get(e.id) || [],
    }));

    // 7. Process Career Context (bounded, tenant-isolated)
    let career: CareerContext | undefined = undefined;
    try {
      const [applicationsResult, interviewsResult, targetsResult] = await Promise.all([
        this.careerRepository.listApplications(userId, { pageSize: 50 }).catch(() => ({ data: [], total: 0, page: 1, pageSize: 50 })),
        this.careerRepository.listInterviews(userId, { status: 'scheduled', pageSize: 50 }).catch(() => ({ data: [], total: 0, page: 1, pageSize: 50 })),
        this.careerRepository.listTargets(userId, { pageSize: 10 }).catch(() => ({ data: [], total: 0, page: 1, pageSize: 10 })),
      ]);

      const terminalStages = new Set(['accepted', 'declined', 'rejected', 'withdrawn', 'closed']);
      const activeAppsRaw = (applicationsResult?.data || []).filter((a) => !terminalStages.has(a.stage));
      const scheduledInterviewsRaw = (interviewsResult?.data || []).filter((i) => i.status === 'scheduled');

      // Group interviews by application_id
      const interviewsByApp = new Map<string, Array<{ updated_at: string }>>();
      for (const interview of scheduledInterviewsRaw) {
        const list = interviewsByApp.get(interview.application_id) || [];
        list.push(interview);
        interviewsByApp.set(interview.application_id, list);
      }

      const featuredProjectIds: string[] = [];
      const activeApplications: CareerApplicationContextItem[] = [];

      const appPromises = activeAppsRaw.map(async (app) => {
        const [opp, appProjects, appHistory] = await Promise.all([
          this.careerRepository.getOpportunityById(userId, app.opportunity_id).catch(() => null),
          this.careerRepository.listApplicationProjects(userId, app.id).catch(() => []),
          this.careerRepository.listApplicationHistory(userId, app.id).catch(() => []),
        ]);

        const appFeaturedProjects = (appProjects || []).filter((p) => p.is_featured).map((p) => p.project_id);
        for (const fpId of appFeaturedProjects) {
          featuredProjectIds.push(fpId);
        }

        let latestActivityMs = new Date(app.updated_at || app.created_at).getTime();
        for (const h of appHistory || []) {
          const hTime = new Date(h.changed_at).getTime();
          if (!isNaN(hTime) && hTime > latestActivityMs) {
            latestActivityMs = hTime;
          }
        }
        const appInterviews = interviewsByApp.get(app.id) || [];
        for (const ai of appInterviews) {
          const iTime = new Date(ai.updated_at).getTime();
          if (!isNaN(iTime) && iTime > latestActivityMs) {
            latestActivityMs = iTime;
          }
        }

        const currentTimestampMs = new Date(currentTimeIso).getTime();
        const elapsedHours = (currentTimestampMs - latestActivityMs) / (1000 * 60 * 60);

        // Fixed 336-hour (14 full days) threshold, active outreach stages only
        const isFollowUpEligible =
          (app.stage === 'applied' || app.stage === 'screening') &&
          !isNaN(elapsedHours) &&
          elapsedHours >= 336.0;

        return {
          id: app.id,
          company_name: opp?.company_name || 'Target Company',
          role_title: opp?.role_title || 'Target Role',
          stage: app.stage,
          deadline: app.deadline,
          last_meaningful_activity_at: new Date(latestActivityMs).toISOString(),
          is_follow_up_eligible: isFollowUpEligible,
          featured_project_ids: appFeaturedProjects,
        };
      });

      const resolvedApps = await Promise.all(appPromises);
      activeApplications.push(...resolvedApps);

      const upcomingInterviews: CareerInterviewContextItem[] = scheduledInterviewsRaw.map((i) => ({
        id: i.id,
        application_id: i.application_id,
        round_number: i.round_number,
        round_type: i.round_type,
        scheduled_at: i.scheduled_at,
        status: i.status,
      }));

      // Missing Required Skills (Required importance only)
      const requiredSkillGaps: CareerSkillGapContextItem[] = [];
      const taskSkillsMap: Record<string, string[]> = {};

      const targets = targetsResult?.data || [];
      const targetSkillPromises = targets.map((t) =>
        this.careerRepository.listTargetSkills(userId, t.id).catch(() => [])
      );
      const targetSkillLists = await Promise.all(targetSkillPromises);

      const requiredSkillIds = new Set<string>();
      const skillNameMap = new Map<string, string>();
      for (const sList of targetSkillLists) {
        for (const s of sList) {
          if (s.importance === 'required') {
            requiredSkillIds.add(s.skill_id);
            if (s.skill_name) {
              skillNameMap.set(s.skill_id, s.skill_name);
            }
          }
        }
      }

      const userSkills = await this.skillsRepository.listSkills(userId).catch(() => []);
      const userSkillMap = new Map(userSkills.map((sk) => [sk.id, sk]));

      for (const skillId of requiredSkillIds) {
        const uSkill = userSkillMap.get(skillId);
        const isAcquired = Boolean(uSkill && uSkill.status && uSkill.status === 'active');
        if (!isAcquired) {
          const sName = skillNameMap.get(skillId) || uSkill?.name || 'Required Skill';
          requiredSkillGaps.push({
            skill_id: skillId,
            skill_name: sName,
            importance: 'required',
          });

          const linkedTasks = await this.skillsRepository.getTasksForSkill(userId, skillId).catch(() => []);
          for (const lt of linkedTasks) {
            const list = taskSkillsMap[lt.id] || [];
            list.push(skillId);
            taskSkillsMap[lt.id] = list;
          }
        }
      }

      career = {
        activeApplications,
        upcomingInterviews,
        requiredSkillGaps,
        taskSkillsMap,
        featuredProjectIds,
      };
    } catch {
      career = undefined;
    }

    return {
      userId,
      currentDate,
      currentTimeIso,
      timezone: effectiveTimezone,
      activeGoals,
      activeMilestones,
      activeProjects,
      projects: activeProjects,
      openTasks,
      recentCompletedTasks,
      recentFocusSessions,
      recentEvidence,
      activeFocusSessionTaskId,
      career,
    };
  }
}
