import type {
  CreateDsaProblemInput,
  DsaProblemDto,
  DsaProblemDetailDto,
  DsaProblemQueryInput,
  UpdateDsaProblemInput,
} from '@avenza/shared';
import type {
  CreateDsaAttemptInput,
  DsaAttemptDto,
  UpdateDsaAttemptInput,
} from '@avenza/shared';
import type {
  CreateDsaTopicInput,
  DsaTopicDto,
  UpdateDsaTopicInput,
} from '@avenza/shared';
import type {
  LinkDsaProblemGoalInput,
  LinkDsaProblemSkillInput,
  LinkDsaProblemTaskInput,
  LinkDsaProblemTopicInput,
} from '@avenza/shared';

export interface IDsaRepository {
  // Problem CRUD
  createProblem(userId: string, data: CreateDsaProblemInput): Promise<DsaProblemDto>;
  getProblemById(userId: string, problemId: string): Promise<DsaProblemDto | null>;
  getProblemBySlug(userId: string, slug: string): Promise<DsaProblemDto | null>;
  listProblems(userId: string, query?: DsaProblemQueryInput): Promise<DsaProblemDto[]>;
  updateProblem(userId: string, problemId: string, data: UpdateDsaProblemInput): Promise<DsaProblemDto>;
  archiveProblem(userId: string, problemId: string): Promise<DsaProblemDto>;
  deleteProblem(userId: string, problemId: string): Promise<void>;

  // Problem detail
  getProblemDetail(userId: string, problemId: string): Promise<DsaProblemDetailDto | null>;

  // Attempt CRUD
  createAttempt(userId: string, data: CreateDsaAttemptInput): Promise<DsaAttemptDto>;
  getAttemptById(userId: string, attemptId: string): Promise<DsaAttemptDto | null>;
  listAttemptsByProblem(userId: string, problemId: string): Promise<DsaAttemptDto[]>;
  updateAttempt(userId: string, attemptId: string, data: UpdateDsaAttemptInput): Promise<DsaAttemptDto>;
  deleteAttempt(userId: string, attemptId: string): Promise<void>;

  // Topic CRUD
  createTopic(userId: string, data: CreateDsaTopicInput): Promise<DsaTopicDto>;
  getTopicById(userId: string, topicId: string): Promise<DsaTopicDto | null>;
  getTopicBySlug(userId: string, slug: string): Promise<DsaTopicDto | null>;
  listTopics(userId: string, query?: { status?: 'active' | 'archived'; parentTopicId?: string | null; search?: string }): Promise<DsaTopicDto[]>;
  updateTopic(userId: string, topicId: string, data: UpdateDsaTopicInput): Promise<DsaTopicDto>;
  archiveTopic(userId: string, topicId: string): Promise<DsaTopicDto>;
  deleteTopic(userId: string, topicId: string): Promise<void>;

  // Relationships
  linkProblemTopic(userId: string, data: LinkDsaProblemTopicInput): Promise<void>;
  unlinkProblemTopic(userId: string, problemId: string, topicId: string): Promise<void>;
  linkProblemSkill(userId: string, data: LinkDsaProblemSkillInput): Promise<void>;
  unlinkProblemSkill(userId: string, problemId: string, skillId: string): Promise<void>;
  linkProblemGoal(userId: string, data: LinkDsaProblemGoalInput): Promise<void>;
  unlinkProblemGoal(userId: string, problemId: string, goalId: string): Promise<void>;
  linkProblemTask(userId: string, data: LinkDsaProblemTaskInput): Promise<void>;
  unlinkProblemTask(userId: string, problemId: string, taskId: string): Promise<void>;

  // Overview and analytics
  getOverview(userId: string): Promise<{
    total_problems: number;
    solved_problems: number;
    attempted_problems: number;
    revision_due_count: number;
    weak_areas: Array<{
      topic_id: string;
      topic_name: string;
      problem_count: number;
      failure_count: number;
      reason: string;
    }>;
    recommended_problem: {
      id: string;
      title: string;
      reason: string;
    } | null;
  }>;
}

export interface IDsaService {
  // Problem CRUD
  createProblem(userId: string, data: CreateDsaProblemInput): Promise<DsaProblemDto>;
  getProblem(userId: string, problemId: string): Promise<DsaProblemDto>;
  getProblemDetail(userId: string, problemId: string): Promise<DsaProblemDetailDto>;
  listProblems(userId: string, query?: DsaProblemQueryInput): Promise<DsaProblemDto[]>;
  updateProblem(userId: string, problemId: string, data: UpdateDsaProblemInput): Promise<DsaProblemDto>;
  archiveProblem(userId: string, problemId: string): Promise<DsaProblemDto>;
  deleteProblem(userId: string, problemId: string): Promise<void>;

  // Attempt CRUD
  createAttempt(userId: string, data: CreateDsaAttemptInput): Promise<DsaAttemptDto>;
  getAttempt(userId: string, attemptId: string): Promise<DsaAttemptDto>;
  listAttemptsByProblem(userId: string, problemId: string): Promise<DsaAttemptDto[]>;
  updateAttempt(userId: string, attemptId: string, data: UpdateDsaAttemptInput): Promise<DsaAttemptDto>;
  deleteAttempt(userId: string, attemptId: string): Promise<void>;

  // Topic CRUD
  createTopic(userId: string, data: CreateDsaTopicInput): Promise<DsaTopicDto>;
  getTopic(userId: string, topicId: string): Promise<DsaTopicDto>;
  listTopics(userId: string, query?: { status?: 'active' | 'archived'; parentTopicId?: string | null; search?: string }): Promise<DsaTopicDto[]>;
  updateTopic(userId: string, topicId: string, data: UpdateDsaTopicInput): Promise<DsaTopicDto>;
  archiveTopic(userId: string, topicId: string): Promise<DsaTopicDto>;
  deleteTopic(userId: string, topicId: string): Promise<void>;

  // Relationships
  linkProblemTopic(userId: string, data: LinkDsaProblemTopicInput): Promise<void>;
  unlinkProblemTopic(userId: string, problemId: string, topicId: string): Promise<void>;
  linkProblemSkill(userId: string, data: LinkDsaProblemSkillInput): Promise<void>;
  unlinkProblemSkill(userId: string, problemId: string, skillId: string): Promise<void>;
  linkProblemGoal(userId: string, data: LinkDsaProblemGoalInput): Promise<void>;
  unlinkProblemGoal(userId: string, problemId: string, goalId: string): Promise<void>;
  linkProblemTask(userId: string, data: LinkDsaProblemTaskInput): Promise<void>;
  unlinkProblemTask(userId: string, problemId: string, taskId: string): Promise<void>;

  // Overview and analytics
  getOverview(userId: string): Promise<{
    total_problems: number;
    solved_problems: number;
    attempted_problems: number;
    revision_due_count: number;
    weak_areas: Array<{
      topic_id: string;
      topic_name: string;
      problem_count: number;
      failure_count: number;
      reason: string;
    }>;
    recommended_problem: {
      id: string;
      title: string;
      reason: string;
    } | null;
  }>;
}