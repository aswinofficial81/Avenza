import { IDsaRepository } from './dsa.repository';
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

export class DsaServiceImpl implements IDsaRepository {
  constructor(private readonly repository: IDsaRepository) {}

  // Problem CRUD
  async createProblem(userId: string, data: CreateDsaProblemInput): Promise<DsaProblemDto> {
    return this.repository.createProblem(userId, data);
  }

  async getProblemById(userId: string, problemId: string): Promise<DsaProblemDto | null> {
    return this.repository.getProblemById(userId, problemId);
  }

  async getProblem(userId: string, problemId: string): Promise<DsaProblemDto> {
    const problem = await this.repository.getProblemById(userId, problemId);
    if (!problem) {
      throw new Error('Problem not found');
    }
    return problem;
  }

  async getProblemBySlug(userId: string, slug: string): Promise<DsaProblemDto | null> {
    return this.repository.getProblemBySlug(userId, slug);
  }

  async getProblemDetail(userId: string, problemId: string): Promise<DsaProblemDetailDto> {
    const problem = await this.repository.getProblemDetail(userId, problemId);
    if (!problem) {
      throw new Error('Problem not found');
    }
    return problem;
  }

  async listProblems(userId: string, query?: DsaProblemQueryInput): Promise<DsaProblemDto[]> {
    return this.repository.listProblems(userId, query);
  }

  async updateProblem(userId: string, problemId: string, data: UpdateDsaProblemInput): Promise<DsaProblemDto> {
    return this.repository.updateProblem(userId, problemId, data);
  }

  async archiveProblem(userId: string, problemId: string): Promise<DsaProblemDto> {
    return this.repository.archiveProblem(userId, problemId);
  }

  async deleteProblem(userId: string, problemId: string): Promise<void> {
    return this.repository.deleteProblem(userId, problemId);
  }

  // Attempt CRUD
  async createAttempt(userId: string, data: CreateDsaAttemptInput): Promise<DsaAttemptDto> {
    return this.repository.createAttempt(userId, data);
  }

  async getAttemptById(userId: string, attemptId: string): Promise<DsaAttemptDto | null> {
    return this.repository.getAttemptById(userId, attemptId);
  }

  async getAttempt(userId: string, attemptId: string): Promise<DsaAttemptDto> {
    const attempt = await this.repository.getAttemptById(userId, attemptId);
    if (!attempt) {
      throw new Error('Attempt not found');
    }
    return attempt;
  }

  async listAttemptsByProblem(userId: string, problemId: string): Promise<DsaAttemptDto[]> {
    return this.repository.listAttemptsByProblem(userId, problemId);
  }

  async updateAttempt(userId: string, attemptId: string, data: UpdateDsaAttemptInput): Promise<DsaAttemptDto> {
    return this.repository.updateAttempt(userId, attemptId, data);
  }

  // Topic CRUD
  async createTopic(userId: string, data: CreateDsaTopicInput): Promise<DsaTopicDto> {
    return this.repository.createTopic(userId, data);
  }

  async getTopicById(userId: string, topicId: string): Promise<DsaTopicDto | null> {
    return this.repository.getTopicById(userId, topicId);
  }

  async getTopicBySlug(userId: string, slug: string): Promise<DsaTopicDto | null> {
    return this.repository.getTopicBySlug(userId, slug);
  }

  async getTopic(userId: string, topicId: string): Promise<DsaTopicDto> {
    const topic = await this.repository.getTopicById(userId, topicId);
    if (!topic) {
      throw new Error('Topic not found');
    }
    return topic;
  }

  async listTopics(userId: string, query?: { status?: 'active' | 'archived'; parentTopicId?: string | null; search?: string }): Promise<DsaTopicDto[]> {
    return this.repository.listTopics(userId, query);
  }

  async updateTopic(userId: string, topicId: string, data: UpdateDsaTopicInput): Promise<DsaTopicDto> {
    return this.repository.updateTopic(userId, topicId, data);
  }

  async archiveTopic(userId: string, topicId: string): Promise<DsaTopicDto> {
    return this.repository.archiveTopic(userId, topicId);
  }

  async deleteTopic(userId: string, topicId: string): Promise<void> {
    return this.repository.deleteTopic(userId, topicId);
  }

  // Relationships
  async linkProblemTopic(userId: string, data: LinkDsaProblemTopicInput): Promise<void> {
    return this.repository.linkProblemTopic(userId, data);
  }

  async unlinkProblemTopic(userId: string, problemId: string, topicId: string): Promise<void> {
    return this.repository.unlinkProblemTopic(userId, problemId, topicId);
  }

  async linkProblemSkill(userId: string, data: LinkDsaProblemSkillInput): Promise<void> {
    return this.repository.linkProblemSkill(userId, data);
  }

  async unlinkProblemSkill(userId: string, problemId: string, skillId: string): Promise<void> {
    return this.repository.unlinkProblemSkill(userId, problemId, skillId);
  }

  async linkProblemGoal(userId: string, data: LinkDsaProblemGoalInput): Promise<void> {
    return this.repository.linkProblemGoal(userId, data);
  }

  async unlinkProblemGoal(userId: string, problemId: string, goalId: string): Promise<void> {
    return this.repository.unlinkProblemGoal(userId, problemId, goalId);
  }

  async linkProblemTask(userId: string, data: LinkDsaProblemTaskInput): Promise<void> {
    return this.repository.linkProblemTask(userId, data);
  }

  async unlinkProblemTask(userId: string, problemId: string, taskId: string): Promise<void> {
    return this.repository.unlinkProblemTask(userId, problemId, taskId);
  }

  // Overview and analytics
  async getOverview(userId: string): Promise<{
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
  }> {
    return this.repository.getOverview(userId);
  }
}