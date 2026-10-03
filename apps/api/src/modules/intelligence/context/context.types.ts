import type {
  GoalStatus,
  MilestoneStatus,
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

export interface TaskContextItem {
  id: string;
  goal_id: string | null;
  milestone_id: string | null;
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

export interface IntelligenceContext {
  userId: string;
  currentDate: string; // YYYY-MM-DD
  currentTimeIso: string; // ISO 8601 string
  timezone: string;
  activeGoals: GoalContextItem[];
  activeMilestones: MilestoneContextItem[];
  openTasks: TaskContextItem[];
  recentCompletedTasks: TaskContextItem[];
  recentFocusSessions: FocusContextItem[];
  recentEvidence: EvidenceContextItem[];
  activeFocusSessionTaskId: string | null;
}
