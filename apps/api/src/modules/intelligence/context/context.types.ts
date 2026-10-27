import type {
  GoalStatus,
  MilestoneStatus,
  ProjectMilestoneStatus,
  ProjectPriority,
  ProjectStatus,
  ProjectType,
  TaskPriority,
  TaskStatus,
  TaskType,
  FocusSessionStatus,
  FocusSessionType,
  EvidenceType,
  EvidenceVerificationStatus,
} from '@avenza/shared';

export interface GoalContextItem {
  id: string;
  title: string;
  status: GoalStatus;
  priority: number;
}

export interface MilestoneContextItem {
  id: string;
  goalId: string;
  title: string;
  status: MilestoneStatus;
  target_date: string | null;
}

export interface ProjectMilestoneContextItem {
  id: string;
  project_id: string;
  title: string;
  status: ProjectMilestoneStatus;
  order_index: number;
  target_date: string | null;
}

export interface ProjectTaskSummaryContextItem {
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
}

export interface ProjectContextItem {
  project_id: string;
  title: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  project_type: ProjectType;
  target_date: string | null;
  health: 'completed' | 'at_risk' | 'on_track' | 'unknown';
  progress: number;
  active_milestone: ProjectMilestoneContextItem | null;
  next_pending_milestone: ProjectMilestoneContextItem | null;
  milestone_target_date: string | null;
  task_summary: ProjectTaskSummaryContextItem;
}

export interface TaskContextItem {
  id: string;
  goal_id: string | null;
  milestone_id: string | null;
  project_id?: string | null;
  project_milestone_id?: string | null;
  application_id?: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  task_type: TaskType;
  status: TaskStatus;
  due_at: string | null;
  scheduled_date: string | null;
  estimated_minutes: number | null;
  actual_minutes: number;
  is_blocked: boolean;
  unblocks_count: number;
  created_at: string;
  updated_at: string;
}

export interface FocusContextItem {
  id: string;
  task_id: string | null;
  session_type: FocusSessionType;
  status: FocusSessionStatus;
  started_at: string;
  ended_at: string | null;
  actual_minutes: number | null;
}

export interface EvidenceContextItem {
  id: string;
  evidence_type: EvidenceType;
  title: string;
  verification_status: EvidenceVerificationStatus;
  occurred_at: string;
  linked_task_ids: string[];
}

export interface CareerApplicationContextItem {
  id: string;
  company_name: string;
  role_title: string;
  stage: string;
  deadline: string | null;
  last_meaningful_activity_at: string | null;
  is_follow_up_eligible: boolean;
  featured_project_ids: string[];
}

export interface CareerInterviewContextItem {
  id: string;
  application_id: string;
  round_number: number;
  round_type: string;
  scheduled_at: string | null;
  status: string;
}

export interface CareerSkillGapContextItem {
  skill_id: string;
  skill_name: string;
  importance: 'required';
}

export interface CareerContext {
  activeApplications: CareerApplicationContextItem[];
  upcomingInterviews: CareerInterviewContextItem[];
  requiredSkillGaps: CareerSkillGapContextItem[];
  taskSkillsMap: Record<string, string[]>;
  featuredProjectIds: string[];
}

export interface IntelligenceContext {
  userId: string;
  currentDate: string; // YYYY-MM-DD
  currentTimeIso: string; // ISO 8601 string
  timezone: string;
  activeGoals: GoalContextItem[];
  activeMilestones: MilestoneContextItem[];
  activeProjects: ProjectContextItem[];
  projects?: ProjectContextItem[];
  openTasks: TaskContextItem[];
  recentCompletedTasks: TaskContextItem[];
  recentFocusSessions: FocusContextItem[];
  recentEvidence: EvidenceContextItem[];
  activeFocusSessionTaskId: string | null;
  career?: CareerContext;
}
