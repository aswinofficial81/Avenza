import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, DsaProblemDifficulty, DsaProblemSource, DsaProblemStatus, DsaRevisionStage, DsaAttemptStatus, DsaTopicStatus } from '@avenza/shared';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import type { IDsaRepository } from './dsa.repository';
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

export class DsaRepositoryImpl implements IDsaRepository {
  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) {}

  // Problem CRUD
  async createProblem(userId: string, data: CreateDsaProblemInput): Promise<DsaProblemDto> {
    const slug = data.slug && data.slug.trim().length > 0
      ? data.slug.trim()
      : this.generateSlug(data.title);

    const { data: row, error } = await this.client
      .from('dsa_problems')
      .insert({
        user_id: userId,
        title: data.title,
        slug,
        description: data.description ?? null,
        difficulty: data.difficulty,
        source: data.source,
        external_url: data.external_url ?? null,
        estimated_minutes: data.estimated_minutes ?? null,
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to create problem: ${error?.message || 'Unknown error'}`);
    }

    return this.mapDsaProblemRow(row);
  }

  async getProblemById(userId: string, problemId: string): Promise<DsaProblemDto | null> {
    const { data: row, error } = await this.client
      .from('dsa_problems')
      .select('*')
      .eq('id', problemId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !row) {
      return null;
    }

    return this.mapDsaProblemRow(row);
  }

  async getProblemBySlug(userId: string, slug: string): Promise<DsaProblemDto | null> {
    const { data: row, error } = await this.client
      .from('dsa_problems')
      .select('*')
      .eq('slug', slug)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !row) {
      return null;
    }

    return this.mapDsaProblemRow(row);
  }

  async listProblems(userId: string, query?: DsaProblemQueryInput): Promise<DsaProblemDto[]> {
    let q = this.client
      .from('dsa_problems')
      .select('*')
      .eq('user_id', userId);

    if (query?.status) {
      q = q.eq('status', query.status);
    }

    if (query?.difficulty) {
      q = q.eq('difficulty', query.difficulty);
    }

    if (query?.source) {
      q = q.eq('source', query.source);
    }

    if (query?.topic_id) {
      const topicProblemLinks = await this.client
        .from('dsa_problem_topics')
        .select('problem_id')
        .eq('topic_id', query.topic_id)
        .eq('user_id', userId);

      const problemIds = topicProblemLinks.data?.map(link => link.problem_id) || [];
      if (problemIds.length > 0) {
        q = q.in('id', problemIds);
      } else {
        // No matching problems, return empty array
        return [];
      }
    }

    if (query?.skill_id) {
      const skillProblemLinks = await this.client
        .from('dsa_problem_skills')
        .select('problem_id')
        .eq('skill_id', query.skill_id)
        .eq('user_id', userId);

      const problemIds = skillProblemLinks.data?.map(link => link.problem_id) || [];
      if (problemIds.length > 0) {
        q = q.in('id', problemIds);
      } else {
        // No matching problems, return empty array
        return [];
      }
    }

    if (query?.goal_id) {
      const goalProblemLinks = await this.client
        .from('dsa_problem_goals')
        .select('problem_id')
        .eq('goal_id', query.goal_id)
        .eq('user_id', userId);

      const problemIds = goalProblemLinks.data?.map(link => link.problem_id) || [];
      if (problemIds.length > 0) {
        q = q.in('id', problemIds);
      } else {
        // No matching problems, return empty array
        return [];
      }
    }

    if (query?.task_id) {
      const taskProblemLinks = await this.client
        .from('dsa_problem_tasks')
        .select('problem_id')
        .eq('task_id', query.task_id)
        .eq('user_id', userId);

      const problemIds = taskProblemLinks.data?.map(link => link.problem_id) || [];
      if (problemIds.length > 0) {
        q = q.in('id', problemIds);
      } else {
        // No matching problems, return empty array
        return [];
      }
    }

    if (query?.search) {
      const searchTerm = `%${query.search}%`;
      q = q.or(`title.ilike${searchTerm},description.ilike${searchTerm}`);
    }

    if (query?.revision_due) {
      q = q.not('next_review_at', 'is', null)
        .lte('next_review_at', new Date().toISOString());
    }

    const { data: rows, error } = await q.order('created_at', { ascending: false });

    if (error || !rows) {
      return [];
    }

    return rows.map(row => this.mapDsaProblemRow(row));
  }

  async updateProblem(userId: string, problemId: string, data: UpdateDsaProblemInput): Promise<DsaProblemDto> {
    const updatePayload: Partial<Database['public']['Tables']['dsa_problems']['Update']> = {};

    if (data.title !== undefined) {
      updatePayload.title = data.title;
    }
    if (data.slug !== undefined) {
      updatePayload.slug = data.slug;
    }
    if (data.description !== undefined) {
      updatePayload.description = data.description ?? null;
    }
    if (data.difficulty !== undefined) {
      updatePayload.difficulty = data.difficulty;
    }
    if (data.source !== undefined) {
      updatePayload.source = data.source;
    }
    if (data.external_url !== undefined) {
      updatePayload.external_url = data.external_url ?? null;
    }
    if (data.estimated_minutes !== undefined) {
      updatePayload.estimated_minutes = data.estimated_minutes ?? null;
    }
    if (data.status !== undefined) {
      updatePayload.status = data.status;
    }

    const { data: row, error } = await this.client
      .from('dsa_problems')
      .update(updatePayload)
      .eq('id', problemId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to update problem: ${error?.message || 'Unknown error'}`);
    }

    return this.mapDsaProblemRow(row);
  }

  async archiveProblem(userId: string, problemId: string): Promise<DsaProblemDto> {
    return this.updateProblem(userId, problemId, { status: 'archived' });
  }

  async deleteProblem(userId: string, problemId: string): Promise<void> {
    const { error } = await this.client
      .from('dsa_problems')
      .delete()
      .eq('id', problemId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete problem: ${error.message}`);
    }
  }

  // Problem detail
  async getProblemDetail(userId: string, problemId: string): Promise<DsaProblemDetailDto | null> {
    const problem = await this.getProblemById(userId, problemId);
    if (!problem) return null;

    // Get topics
    const { data: topicLinks, error: topicError } = await this.client
      .from('dsa_problem_topics')
      .select('topic_id')
      .eq('problem_id', problemId)
      .eq('user_id', userId);

    // Get skills
    const { data: skillLinks, error: skillError } = await this.client
      .from('dsa_problem_skills')
      .select('skill_id')
      .eq('problem_id', problemId)
      .eq('user_id', userId);

    // Get goals
    const { data: goalLinks, error: goalError } = await this.client
      .from('dsa_problem_goals')
      .select('goal_id')
      .eq('problem_id', problemId)
      .eq('user_id', userId);

    // Get tasks
    const { data: taskLinks, error: taskError } = await this.client
      .from('dsa_problem_tasks')
      .select('task_id')
      .eq('problem_id', problemId)
      .eq('user_id', userId);

    // Get recent attempts (limit to 5 most recent)
    const { data: recentAttempts, error: attemptsError } = await this.client
      .from('dsa_attempts')
      .select('*')
      .eq('problem_id', problemId)
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(5);

    if (topicError || skillError || goalError || taskError || attemptsError) {
      throw new Error('Failed to fetch problem details');
    }

    // Fetch full topic details
    const topics = topicLinks && topicLinks.length > 0
      ? await this.fetchTopicsByIds(userId, topicLinks.map(link => link.topic_id))
      : [];

    // Fetch full skill details
    const skills = skillLinks && skillLinks.length > 0
      ? await this.fetchSkillsByIds(userId, skillLinks.map(link => link.skill_id))
      : [];

    // Fetch full goal details
    const goals = goalLinks && goalLinks.length > 0
      ? await this.fetchGoalsByIds(userId, goalLinks.map(link => link.goal_id))
      : [];

    // Fetch full task details
    const tasks = taskLinks && taskLinks.length > 0
      ? await this.fetchTasksByIds(userId, taskLinks.map(link => link.task_id))
      : [];

    return {
      problem,
      topics,
      skills,
      goals,
      tasks,
      recent_attempts: recentAttempts?.map(this.mapDsaAttemptRow) || [],
    };
  }

  // Attempt CRUD
  async createAttempt(userId: string, data: CreateDsaAttemptInput): Promise<DsaAttemptDto> {
    const { data: row, error } = await this.client
      .from('dsa_attempts')
      .insert({
        user_id: userId,
        problem_id: data.problem_id,
        status: data.status,
        started_at: data.started_at ?? null,
        submitted_at: data.submitted_at ?? null,
        occurred_at: data.occurred_at ?? new Date().toISOString(),
        recorded_at: new Date().toISOString(),
        solve_time_minutes: data.solve_time_minutes ?? null,
        language: data.language ?? null,
        notes: data.notes ?? null,
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to create attempt: ${error?.message || 'Unknown error'}`);
    }

    // Update problem statistics
    await this.updateProblemStatistics(userId, data.problem_id);

    // If attempt is solved, idempotently generate evidence
    if (row.status === 'solved') {
      await this.ensureEvidenceForSolvedAttempt(userId, row.id, data.problem_id, data.solve_time_minutes ?? null);
    }

    return this.mapDsaAttemptRow(row);
  }

  async getAttemptById(userId: string, attemptId: string): Promise<DsaAttemptDto | null> {
    const { data: row, error } = await this.client
      .from('dsa_attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !row) {
      return null;
    }

    return this.mapDsaAttemptRow(row);
  }

  async listAttemptsByProblem(userId: string, problemId: string): Promise<DsaAttemptDto[]> {
    const { data: rows, error } = await this.client
      .from('dsa_attempts')
      .select('*')
      .eq('problem_id', problemId)
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false });

    if (error || !rows) {
      return [];
    }

    return rows.map(row => this.mapDsaAttemptRow(row));
  }

  async updateAttempt(userId: string, attemptId: string, data: UpdateDsaAttemptInput): Promise<DsaAttemptDto> {
    const updatePayload: Partial<Database['public']['Tables']['dsa_attempts']['Update']> = {};

    if (data.status !== undefined) {
      updatePayload.status = data.status;
    }
    if (data.started_at !== undefined) {
      updatePayload.started_at = data.started_at ?? null;
    }
    if (data.submitted_at !== undefined) {
      updatePayload.submitted_at = data.submitted_at ?? null;
    }
    if (data.solve_time_minutes !== undefined) {
      updatePayload.solve_time_minutes = data.solve_time_minutes ?? null;
    }
    if (data.language !== undefined) {
      updatePayload.language = data.language ?? null;
    }
    if (data.notes !== undefined) {
      updatePayload.notes = data.notes ?? null;
    }

    const { data: row, error } = await this.client
      .from('dsa_attempts')
      .update(updatePayload)
      .eq('id', attemptId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to update attempt: ${error?.message || 'Unknown error'}`);
    }

    // Update problem statistics if the attempt status changed
    if (data.status !== undefined) {
      const attemptRecord = await this.getAttemptById(userId, attemptId);
      if (attemptRecord) {
        await this.updateProblemStatistics(userId, attemptRecord.problem_id);
      }
    }

    // If attempt is solved, idempotently generate evidence
    if (row.status === 'solved') {
      await this.ensureEvidenceForSolvedAttempt(userId, row.id, row.problem_id, row.solve_time_minutes);
    }

    return this.mapDsaAttemptRow(row);
  }

  // Topic CRUD
  async createTopic(userId: string, data: CreateDsaTopicInput): Promise<DsaTopicDto> {
    const slug = data.slug && data.slug.trim().length > 0
      ? data.slug.trim()
      : this.generateSlug(data.name);

    const { data: row, error } = await this.client
      .from('dsa_topics')
      .insert({
        user_id: userId,
        parent_topic_id: data.parent_topic_id ?? null,
        name: data.name,
        slug,
        status: 'active',
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to create topic: ${error?.message || 'Unknown error'}`);
    }

    return this.mapDsaTopicRow(row);
  }

  async getTopicById(userId: string, topicId: string): Promise<DsaTopicDto | null> {
    const { data: row, error } = await this.client
      .from('dsa_topics')
      .select('*')
      .eq('id', topicId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !row) {
      return null;
    }

    return this.mapDsaTopicRow(row);
  }

  async getTopicBySlug(userId: string, slug: string): Promise<DsaTopicDto | null> {
    const { data: row, error } = await this.client
      .from('dsa_topics')
      .select('*')
      .eq('slug', slug)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !row) {
      return null;
    }

    return this.mapDsaTopicRow(row);
  }

  async listTopics(userId: string, query?: { status?: 'active' | 'archived'; parentTopicId?: string | null; search?: string }): Promise<DsaTopicDto[]> {
    let q = this.client
      .from('dsa_topics')
      .select('*')
      .eq('user_id', userId);

    if (query?.status) {
      q = q.eq('status', query.status);
    }

    if (query?.parentTopicId !== undefined && query.parentTopicId !== null) {
      q = q.eq('parent_topic_id', query.parentTopicId);
    }

    if (query?.search) {
      const searchTerm = `%${query.search}%`;
      q = q.or(`name.ilike${searchTerm},slug.ilike${searchTerm}`);
    }

    const { data: rows, error } = await q.order('created_at', { ascending: false });

    if (error || !rows) {
      return [];
    }

    return rows.map(row => this.mapDsaTopicRow(row));
  }

  async updateTopic(userId: string, topicId: string, data: UpdateDsaTopicInput): Promise<DsaTopicDto> {
    const updatePayload: Partial<Database['public']['Tables']['dsa_topics']['Update']> = {};

    if (data.name !== undefined) {
      updatePayload.name = data.name;
    }
    if (data.slug !== undefined) {
      updatePayload.slug = data.slug;
    }
    if (data.parent_topic_id !== undefined) {
      updatePayload.parent_topic_id = data.parent_topic_id;
    }
    if (data.status !== undefined) {
      updatePayload.status = data.status;
    }

    const { data: row, error } = await this.client
      .from('dsa_topics')
      .update(updatePayload)
      .eq('id', topicId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to update topic: ${error?.message || 'Unknown error'}`);
    }

    return this.mapDsaTopicRow(row);
  }

  async archiveTopic(userId: string, topicId: string): Promise<DsaTopicDto> {
    return this.updateTopic(userId, topicId, { status: 'archived' });
  }

  async deleteTopic(userId: string, topicId: string): Promise<void> {
    const { error } = await this.client
      .from('dsa_topics')
      .delete()
      .eq('id', topicId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete topic: ${error.message}`);
    }
  }


  // Relationships
  async linkProblemTopic(userId: string, data: LinkDsaProblemTopicInput): Promise<void> {
    // Verify ownership
    const [problem, topic] = await Promise.all([
      this.client
        .from('dsa_problems')
        .select('id')
        .eq('id', data.problem_id)
        .eq('user_id', userId)
        .single(),
      this.client
        .from('dsa_topics')
        .select('id')
        .eq('id', data.topic_id)
        .eq('user_id', userId)
        .single(),
    ]);

    if (problem.error || !problem.data) {
      throw new Error('Problem not found or access denied');
    }

    if (topic.error || !topic.data) {
      throw new Error('Topic not found or access denied');
    }

    // Create the link
    const { error } = await this.client
      .from('dsa_problem_topics')
      .insert({
        problem_id: data.problem_id,
        topic_id: data.topic_id,
        user_id: userId,
      });

    if (error) {
      throw new Error(`Failed to link problem to topic: ${error.message}`);
    }
  }

  async unlinkProblemTopic(userId: string, problemId: string, topicId: string): Promise<void> {
    const { error } = await this.client
      .from('dsa_problem_topics')
      .delete()
      .eq('problem_id', problemId)
      .eq('topic_id', topicId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to unlink problem from topic: ${error.message}`);
    }
  }

  async linkProblemSkill(userId: string, data: LinkDsaProblemSkillInput): Promise<void> {
    // Verify ownership
    const [problem, skill] = await Promise.all([
      this.client
        .from('dsa_problems')
        .select('id')
        .eq('id', data.problem_id)
        .eq('user_id', userId)
        .single(),
      this.client
        .from('skills')
        .select('id')
        .eq('id', data.skill_id)
        .eq('user_id', userId)
        .single(),
    ]);

    if (problem.error || !problem.data) {
      throw new Error('Problem not found or access denied');
    }

    if (skill.error || !skill.data) {
      throw new Error('Skill not found or access denied');
    }

    // Create the link
    const { error } = await this.client
      .from('dsa_problem_skills')
      .insert({
        problem_id: data.problem_id,
        skill_id: data.skill_id,
        user_id: userId,
      });

    if (error) {
      throw new Error(`Failed to link problem to skill: ${error.message}`);
    }
  }

  async unlinkProblemSkill(userId: string, problemId: string, skillId: string): Promise<void> {
    const { error } = await this.client
      .from('dsa_problem_skills')
      .delete()
      .eq('problem_id', problemId)
      .eq('skill_id', skillId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to unlink problem from skill: ${error.message}`);
    }
  }

  async linkProblemGoal(userId: string, data: LinkDsaProblemGoalInput): Promise<void> {
    // Verify ownership
    const [problem, goal] = await Promise.all([
      this.client
        .from('dsa_problems')
        .select('id')
        .eq('id', data.problem_id)
        .eq('user_id', userId)
        .single(),
      this.client
        .from('goals')
        .select('id')
        .eq('id', data.goal_id)
        .eq('user_id', userId)
        .single(),
    ]);

    if (problem.error || !problem.data) {
      throw new Error('Problem not found or access denied');
    }

    if (goal.error || !goal.data) {
      throw new Error('Goal not found or access denied');
    }

    // Create the link
    const { error } = await this.client
      .from('dsa_problem_goals')
      .insert({
        problem_id: data.problem_id,
        goal_id: data.goal_id,
        user_id: userId,
      });

    if (error) {
      throw new Error(`Failed to link problem to goal: ${error.message}`);
    }
  }

  async unlinkProblemGoal(userId: string, problemId: string, goalId: string): Promise<void> {
    const { error } = await this.client
      .from('dsa_problem_goals')
      .delete()
      .eq('problem_id', problemId)
      .eq('goal_id', goalId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to unlink problem from goal: ${error.message}`);
    }
  }

  async linkProblemTask(userId: string, data: LinkDsaProblemTaskInput): Promise<void> {
    // Verify ownership
    const [problem, task] = await Promise.all([
      this.client
        .from('dsa_problems')
        .select('id')
        .eq('id', data.problem_id)
        .eq('user_id', userId)
        .single(),
      this.client
        .from('tasks')
        .select('id')
        .eq('id', data.task_id)
        .eq('user_id', userId)
        .single(),
    ]);

    if (problem.error || !problem.data) {
      throw new Error('Problem not found or access denied');
    }

    if (task.error || !task.data) {
      throw new Error('Task not found or access denied');
    }

    // Create the link
    const { error } = await this.client
      .from('dsa_problem_tasks')
      .insert({
        problem_id: data.problem_id,
        task_id: data.task_id,
        user_id: userId,
      });

    if (error) {
      throw new Error(`Failed to link problem to task: ${error.message}`);
    }
  }

  async unlinkProblemTask(userId: string, problemId: string, taskId: string): Promise<void> {
    const { error } = await this.client
      .from('dsa_problem_tasks')
      .delete()
      .eq('problem_id', problemId)
      .eq('task_id', taskId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to unlink problem from task: ${error.message}`);
    }
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
    const nowIso = new Date().toISOString();

    // 1. Fetch user active problems
    const { data: problems } = await this.client
      .from('dsa_problems')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    const toIsoStr = (d: unknown): string => (d instanceof Date ? d.toISOString() : String(d));
    const allProblems = problems || [];
    const total_problems = allProblems.length;
    const solved_problems = allProblems.filter(p => p.solved_count > 0).length;
    const attempted_problems = allProblems.filter(p => p.attempt_count > 0).length;
    const revision_due_count = allProblems.filter(
      p => p.next_review_at !== null && toIsoStr(p.next_review_at) <= nowIso
    ).length;

    // 2. Fetch topics, problem-topic links, and all attempts for user
    const [topicsRes, linksRes, attemptsRes] = await Promise.all([
      this.client
        .from('dsa_topics')
        .select('id, name')
        .eq('user_id', userId)
        .eq('status', 'active'),
      this.client
        .from('dsa_problem_topics')
        .select('problem_id, topic_id')
        .eq('user_id', userId),
      this.client
        .from('dsa_attempts')
        .select('id, problem_id, status, occurred_at')
        .eq('user_id', userId),
    ]);

    const topics = topicsRes.data || [];
    const topicLinks = linksRes.data || [];
    const allAttempts = attemptsRes.data || [];

    // 3. Compute Weak Areas deterministically
    // Rule: attempt_count >= 3 AND failure_rate > 0.50 (strictly greater than 50%)
    const computedWeakAreas: Array<{
      topic_id: string;
      topic_name: string;
      problem_count: number;
      failure_count: number;
      failure_rate: number;
      total_attempts: number;
      reason: string;
    }> = [];

    for (const topic of topics) {
      const topicProblemIds = topicLinks
        .filter(l => l.topic_id === topic.id)
        .map(l => l.problem_id);

      const topicAttempts = allAttempts.filter(a => topicProblemIds.includes(a.problem_id));
      const totalTopicAttempts = topicAttempts.length;
      const failedTopicAttempts = topicAttempts.filter(a => a.status === 'failed').length;
      const failureRate = totalTopicAttempts > 0 ? failedTopicAttempts / totalTopicAttempts : 0;

      if (totalTopicAttempts >= 3 && failureRate > 0.5) {
        computedWeakAreas.push({
          topic_id: topic.id,
          topic_name: topic.name,
          problem_count: topicProblemIds.length,
          failure_count: failedTopicAttempts,
          failure_rate: failureRate,
          total_attempts: totalTopicAttempts,
          reason: `${failedTopicAttempts}/${totalTopicAttempts} attempts failed (${Math.round(failureRate * 100)}% failure rate)`,
        });
      }
    }

    // Sort weak areas: failure_rate DESC, total_attempts DESC, topic_id ASC (deterministic tie-breaker)
    computedWeakAreas.sort((a, b) => {
      if (b.failure_rate !== a.failure_rate) return b.failure_rate - a.failure_rate;
      if (b.total_attempts !== a.total_attempts) return b.total_attempts - a.total_attempts;
      return a.topic_id.localeCompare(b.topic_id);
    });

    const weak_areas = computedWeakAreas.map(w => ({
      topic_id: w.topic_id,
      topic_name: w.topic_name,
      problem_count: w.problem_count,
      failure_count: w.failure_count,
      reason: w.reason,
    }));

    // 4. Deterministic Recommendation Engine
    let recommended_problem: { id: string; title: string; reason: string } | null = null;

    // Priority 1: Revision Due
    const revisionDueCandidates = allProblems
      .filter(p => p.next_review_at !== null && toIsoStr(p.next_review_at) <= nowIso)
      .sort((a, b) => {
        const timeDiff = new Date(toIsoStr(a.next_review_at)).getTime() - new Date(toIsoStr(b.next_review_at)).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.id.localeCompare(b.id);
      });

    if (revisionDueCandidates.length > 0) {
      const p = revisionDueCandidates[0]!;
      recommended_problem = {
        id: p.id,
        title: p.title,
        reason: 'Revision is due.',
      };
    }

    // Priority 2: Recent Failure (unsolved problems with failures, most recent first)
    if (!recommended_problem) {
      const unsolvedProblems = allProblems.filter(p => p.solved_count === 0);
      const recentFailedCandidates = unsolvedProblems
        .filter(p => p.failed_count > 0 && p.last_attempt_at !== null)
        .sort((a, b) => {
          const recencyDiff = new Date(b.last_attempt_at!).getTime() - new Date(a.last_attempt_at!).getTime();
          if (recencyDiff !== 0) return recencyDiff;
          return a.id.localeCompare(b.id);
        });

      if (recentFailedCandidates.length > 0) {
        const p = recentFailedCandidates[0]!;
        recommended_problem = {
          id: p.id,
          title: p.title,
          reason: 'You recently struggled with this problem.',
        };
      }
    }

    // Priority 3: Weak Area Problems
    if (!recommended_problem && computedWeakAreas.length > 0) {
      const unsolvedProblems = allProblems.filter(p => p.solved_count === 0);
      for (const weakArea of computedWeakAreas) {
        const weakProblemIds = topicLinks
          .filter(l => l.topic_id === weakArea.topic_id)
          .map(l => l.problem_id);

        const candidatesInWeakTopic = unsolvedProblems
          .filter(p => weakProblemIds.includes(p.id))
          .sort((a, b) => {
            const dateDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            if (dateDiff !== 0) return dateDiff;
            return a.id.localeCompare(b.id);
          });

        if (candidatesInWeakTopic.length > 0) {
          const p = candidatesInWeakTopic[0]!;
          recommended_problem = {
            id: p.id,
            title: p.title,
            reason: `Practice problem in weak topic: ${weakArea.topic_name}.`,
          };
          break;
        }
      }
    }

    // Priority 4: Goal Relevance
    if (!recommended_problem) {
      const { data: goalLinks } = await this.client
        .from('dsa_problem_goals')
        .select('problem_id')
        .eq('user_id', userId);

      const goalProblemIds = (goalLinks || []).map(g => g.problem_id);
      const unsolvedGoalProblems = allProblems
        .filter(p => p.solved_count === 0 && goalProblemIds.includes(p.id))
        .sort((a, b) => {
          const dateDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          if (dateDiff !== 0) return dateDiff;
          return a.id.localeCompare(b.id);
        });

      if (unsolvedGoalProblems.length > 0) {
        const p = unsolvedGoalProblems[0]!;
        recommended_problem = {
          id: p.id,
          title: p.title,
          reason: 'Aligns with your active goals.',
        };
      }
    }

    // Priority 5: Difficulty Progression / Recency
    if (!recommended_problem) {
      const difficultyOrder: Record<string, number> = { easy: 1, medium: 2, hard: 3 };
      const remainingUnsolved = allProblems
        .filter(p => p.solved_count === 0)
        .sort((a, b) => {
          const diffScoreA = difficultyOrder[a.difficulty] ?? 2;
          const diffScoreB = difficultyOrder[b.difficulty] ?? 2;
          if (diffScoreA !== diffScoreB) return diffScoreA - diffScoreB;
          const dateDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          if (dateDiff !== 0) return dateDiff;
          return a.id.localeCompare(b.id);
        });

      if (remainingUnsolved.length > 0) {
        const p = remainingUnsolved[0]!;
        recommended_problem = {
          id: p.id,
          title: p.title,
          reason: 'Suggested next problem based on difficulty progression.',
        };
      }
    }

    return {
      total_problems,
      solved_problems,
      attempted_problems,
      revision_due_count,
      weak_areas,
      recommended_problem,
    };
  }

  private async ensureEvidenceForSolvedAttempt(
    userId: string,
    attemptId: string,
    problemId: string,
    solveTimeMinutes: number | null
  ): Promise<void> {
    // Check if evidence already exists for this attempt
    const { data: existing } = await this.client
      .from('evidence')
      .select('id')
      .eq('user_id', userId)
      .eq('source_type', 'dsa_attempt')
      .eq('source_id', attemptId)
      .maybeSingle();

    if (existing) {
      return;
    }

    // Fetch problem title and difficulty
    const { data: problem } = await this.client
      .from('dsa_problems')
      .select('title, difficulty')
      .eq('id', problemId)
      .maybeSingle();

    const title = problem ? `Solved DSA Problem: ${problem.title}` : 'Solved DSA Problem';
    const description = problem
      ? `Solved problem "${problem.title}" (${problem.difficulty})${solveTimeMinutes ? ` in ${solveTimeMinutes} minutes` : ''}.`
      : 'Successfully solved DSA problem.';

    await this.client
      .from('evidence')
      .insert({
        user_id: userId,
        evidence_type: 'dsa_problem_solved',
        title,
        description,
        source_type: 'dsa_attempt',
        source_id: attemptId,
        verification_status: 'verified',
        evidence_strength: 'high',
        reliability: 'high',
        directness: 'direct',
        occurred_at: new Date().toISOString(),
      });
  }

  // Private helper methods
  private generateSlug(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }

  private mapDsaProblemRow(row: Database['public']['Tables']['dsa_problems']['Row']): DsaProblemDto {
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      difficulty: row.difficulty as DsaProblemDifficulty,
      source: row.source as DsaProblemSource,
      status: row.status as DsaProblemStatus,
      external_url: row.external_url,
      estimated_minutes: row.estimated_minutes,
      attempt_count: row.attempt_count,
      solved_count: row.solved_count,
      failed_count: row.failed_count,
      last_attempt_at: row.last_attempt_at,
      last_solved_at: row.last_solved_at,
      next_review_at: row.next_review_at,
      revision_count: row.revision_count,
      review_stage: row.review_stage as DsaRevisionStage,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapDsaTopicRow(row: Database['public']['Tables']['dsa_topics']['Row']): DsaTopicDto {
    return {
      id: row.id,
      user_id: row.user_id,
      parent_topic_id: row.parent_topic_id,
      name: row.name,
      slug: row.slug,
      status: row.status as DsaTopicStatus,
      created_at: row.created_at,
      updated_at: row.updated_at,
      parent_topic: null, // Would need to be populated separately when fetching with relationships
      children: [], // Would need to populate this separately if needed
    };
  }

  private mapDsaAttemptRow(row: Database['public']['Tables']['dsa_attempts']['Row']): DsaAttemptDto {
    return {
      id: row.id,
      user_id: row.user_id,
      problem_id: row.problem_id,
      status: row.status as DsaAttemptStatus,
      started_at: row.started_at,
      submitted_at: row.submitted_at,
      occurred_at: row.occurred_at,
      recorded_at: row.recorded_at,
      solve_time_minutes: row.solve_time_minutes,
      language: row.language,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private async fetchTopicsByIds(userId: string, topicIds: string[]): Promise<DsaTopicDto[]> {
    if (topicIds.length === 0) return [];

    const { data: rows, error } = await this.client
      .from('dsa_topics')
      .select('*')
      .eq('user_id', userId)
      .in('id', topicIds);

    if (error || !rows) return [];
    return rows.map(this.mapDsaTopicRow);
  }

  private async fetchSkillsByIds(userId: string, skillIds: string[]): Promise<{ id: string; name: string; slug: string }[]> {
    if (skillIds.length === 0) return [];

    const { data: rows, error } = await this.client
      .from('skills')
      .select('id, name, slug')
      .eq('user_id', userId)
      .in('id', skillIds);

    if (error || !rows) return [];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
    }));
  }

  private async fetchGoalsByIds(userId: string, goalIds: string[]): Promise<{ id: string; title: string; status: string }[]> {
    if (goalIds.length === 0) return [];

    const { data: rows, error } = await this.client
      .from('goals')
      .select('id, title, status')
      .eq('user_id', userId)
      .in('id', goalIds);

    if (error || !rows) return [];
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      status: row.status,
    }));
  }

  private async fetchTasksByIds(userId: string, taskIds: string[]): Promise<{ id: string; title: string; status: string }[]> {
    if (taskIds.length === 0) return [];

    const { data: rows, error } = await this.client
      .from('tasks')
      .select('id, title, status')
      .eq('user_id', userId)
      .in('id', taskIds);

    if (error || !rows) return [];
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      status: row.status,
    }));
  }

  private async updateProblemStatistics(userId: string, problemId: string): Promise<void> {
    // Recalculate problem statistics from attempts
    const { data: attempts, error } = await this.client
      .from('dsa_attempts')
      .select('*')
      .eq('problem_id', problemId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to update problem statistics: ${error?.message || 'Unknown error'}`);
    }

    // Calculate statistics from attempts
    const attempt_count = attempts.length;
    const solved_count = attempts.filter(a => a.status === 'solved').length;
    const failed_count = attempts.filter(a => a.status === 'failed').length;
    const toIsoStr = (d: unknown): string => (d instanceof Date ? d.toISOString() : String(d));
    const last_attempt_at = attempts.length > 0
      ? attempts.reduce((max, attempt) => {
          const occ = toIsoStr(attempt.occurred_at);
          return (max === null || occ > max) ? occ : max;
        }, null as string | null)
      : null;
    const solvedAttempts = attempts.filter(a => a.status === 'solved');
    const last_solved_at = solvedAttempts.length > 0
      ? solvedAttempts.reduce((max, attempt) => {
          const occ = toIsoStr(attempt.occurred_at);
          return (max === null || occ > max) ? occ : max;
        }, null as string | null)
      : null;

    // Calculate next review date and revision stage based on solved_count
    let next_review_at: Date | null = null;
    let revision_count = 0;
    let review_stage = 0;

    if (solved_count > 0) {
      revision_count = solved_count;

      // Determine review stage based on revision count
      if (revision_count === 1) {
        review_stage = 1; // First solve -> +2 days
      } else if (revision_count === 2) {
        review_stage = 2; // Second revision -> +7 days
      } else if (revision_count >= 3) {
        review_stage = 3; // Third revision -> +21 days
      }

      // Calculate next review date based on last successful solve
      if (last_solved_at) {
        const lastSolved = new Date(last_solved_at);
        let daysToAdd = 0;

        switch (review_stage) {
          case 1: daysToAdd = 2; break;
          case 2: daysToAdd = 7; break;
          case 3: daysToAdd = 21; break;
        }

        next_review_at = new Date(lastSolved.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
      }
    }

    // Update the problem with calculated statistics
    const { error: updateError } = await this.client
      .from('dsa_problems')
      .update({
        attempt_count,
        solved_count,
        failed_count,
        last_attempt_at,
        last_solved_at,
        next_review_at: next_review_at ? next_review_at.toISOString() : null,
        revision_count,
        review_stage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', problemId)
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(`Failed to update problem statistics: ${updateError.message}`);
    }
  }
}

export class InMemoryDsaRepository implements IDsaRepository {
  private problems = new Map<string, DsaProblemDto>();
  private attempts = new Map<string, DsaAttemptDto>();
  private topics = new Map<string, DsaTopicDto>();
  private problemTopics: Array<{ problem_id: string; topic_id: string; user_id: string }> = [];
  private problemSkills: Array<{ problem_id: string; skill_id: string; user_id: string }> = [];
  private problemGoals: Array<{ problem_id: string; goal_id: string; user_id: string }> = [];
  private problemTasks: Array<{ problem_id: string; task_id: string; user_id: string }> = [];

  private generateSlug(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }

  // Problem CRUD
  async createProblem(userId: string, data: CreateDsaProblemInput): Promise<DsaProblemDto> {
    const now = new Date().toISOString();
    const slug = data.slug && data.slug.trim().length > 0 ? data.slug.trim() : this.generateSlug(data.title);
    const id = crypto.randomUUID();
    const problem: DsaProblemDto = {
      id,
      user_id: userId,
      title: data.title,
      slug,
      description: data.description ?? null,
      difficulty: data.difficulty,
      source: data.source,
      status: 'active',
      external_url: data.external_url ?? null,
      estimated_minutes: data.estimated_minutes ?? null,
      attempt_count: 0,
      solved_count: 0,
      failed_count: 0,
      last_attempt_at: null,
      last_solved_at: null,
      next_review_at: null,
      revision_count: 0,
      review_stage: 0,
      created_at: now,
      updated_at: now,
    };
    this.problems.set(id, problem);
    return { ...problem };
  }

  async getProblemById(userId: string, problemId: string): Promise<DsaProblemDto | null> {
    const p = this.problems.get(problemId);
    if (!p || p.user_id !== userId) return null;
    return { ...p };
  }

  async getProblemBySlug(userId: string, slug: string): Promise<DsaProblemDto | null> {
    for (const p of this.problems.values()) {
      if (p.user_id === userId && p.slug === slug) {
        return { ...p };
      }
    }
    return null;
  }

  async listProblems(userId: string, query?: DsaProblemQueryInput): Promise<DsaProblemDto[]> {
    let list = Array.from(this.problems.values()).filter((p) => p.user_id === userId);
    if (query?.difficulty) list = list.filter((p) => p.difficulty === query.difficulty);
    if (query?.source) list = list.filter((p) => p.source === query.source);
    if (query?.status) list = list.filter((p) => p.status === query.status);
    if (query?.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
    }
    return list.map((p) => ({ ...p }));
  }

  async updateProblem(userId: string, problemId: string, data: UpdateDsaProblemInput): Promise<DsaProblemDto> {
    const existing = this.problems.get(problemId);
    if (!existing || existing.user_id !== userId) {
      throw new Error('Problem not found');
    }
    const updated: DsaProblemDto = {
      ...existing,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
      ...(data.source !== undefined ? { source: data.source } : {}),
      ...(data.external_url !== undefined ? { external_url: data.external_url ?? null } : {}),
      ...(data.estimated_minutes !== undefined ? { estimated_minutes: data.estimated_minutes ?? null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updated_at: new Date().toISOString(),
    };
    this.problems.set(problemId, updated);
    return { ...updated };
  }

  async archiveProblem(userId: string, problemId: string): Promise<DsaProblemDto> {
    return this.updateProblem(userId, problemId, { status: 'archived' });
  }

  async deleteProblem(userId: string, problemId: string): Promise<void> {
    const existing = this.problems.get(problemId);
    if (!existing || existing.user_id !== userId) {
      throw new Error('Problem not found');
    }
    this.problems.delete(problemId);
  }

  // Attempt CRUD
  async createAttempt(userId: string, data: CreateDsaAttemptInput): Promise<DsaAttemptDto> {
    const problem = this.problems.get(data.problem_id);
    if (!problem || problem.user_id !== userId) {
      throw new Error('Problem not found');
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const attempt: DsaAttemptDto = {
      id,
      user_id: userId,
      problem_id: data.problem_id,
      status: data.status,
      started_at: data.started_at ?? null,
      submitted_at: data.submitted_at ?? null,
      occurred_at: data.occurred_at ?? now,
      recorded_at: now,
      solve_time_minutes: data.solve_time_minutes ?? null,
      language: data.language ?? null,
      notes: data.notes ?? null,
      created_at: now,
      updated_at: now,
    };
    this.attempts.set(id, attempt);
    await this.updateProblemStatistics(userId, data.problem_id);
    return { ...attempt };
  }

  async getAttemptById(userId: string, attemptId: string): Promise<DsaAttemptDto | null> {
    const a = this.attempts.get(attemptId);
    if (!a || a.user_id !== userId) return null;
    return { ...a };
  }

  async listAttemptsByProblem(userId: string, problemId: string): Promise<DsaAttemptDto[]> {
    return Array.from(this.attempts.values())
      .filter((a) => a.user_id === userId && a.problem_id === problemId)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      .map((a) => ({ ...a }));
  }

  async updateAttempt(userId: string, attemptId: string, data: UpdateDsaAttemptInput): Promise<DsaAttemptDto> {
    const existing = this.attempts.get(attemptId);
    if (!existing || existing.user_id !== userId) {
      throw new Error('Attempt not found');
    }
    const updated: DsaAttemptDto = {
      ...existing,
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.started_at !== undefined ? { started_at: data.started_at ?? null } : {}),
      ...(data.submitted_at !== undefined ? { submitted_at: data.submitted_at ?? null } : {}),
      ...(data.solve_time_minutes !== undefined ? { solve_time_minutes: data.solve_time_minutes ?? null } : {}),
      ...(data.language !== undefined ? { language: data.language ?? null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
      updated_at: new Date().toISOString(),
    };
    this.attempts.set(attemptId, updated);
    if (data.status !== undefined) {
      await this.updateProblemStatistics(userId, existing.problem_id);
    }
    return { ...updated };
  }

  private async updateProblemStatistics(userId: string, problemId: string): Promise<void> {
    const problem = this.problems.get(problemId);
    if (!problem || problem.user_id !== userId) return;

    const attempts = Array.from(this.attempts.values()).filter(
      (a) => a.user_id === userId && a.problem_id === problemId
    );

    const attempt_count = attempts.length;
    const solved_count = attempts.filter((a) => a.status === 'solved').length;
    const failed_count = attempts.filter((a) => a.status === 'failed').length;

    let last_attempt_at: string | null = null;
    for (const a of attempts) {
      if (!last_attempt_at || a.occurred_at > last_attempt_at) {
        last_attempt_at = a.occurred_at;
      }
    }

    const solvedAttempts = attempts.filter((a) => a.status === 'solved');
    let last_solved_at: string | null = null;
    for (const a of solvedAttempts) {
      if (!last_solved_at || a.occurred_at > last_solved_at) {
        last_solved_at = a.occurred_at;
      }
    }

    let next_review_at: Date | null = null;
    let revision_count = 0;
    let review_stage = 0;

    if (solved_count > 0) {
      revision_count = solved_count;
      if (revision_count === 1) review_stage = 1;
      else if (revision_count === 2) review_stage = 2;
      else if (revision_count >= 3) review_stage = 3;

      if (last_solved_at) {
        const lastSolved = new Date(last_solved_at);
        let daysToAdd = 0;
        switch (review_stage) {
          case 1: daysToAdd = 2; break;
          case 2: daysToAdd = 7; break;
          case 3: daysToAdd = 21; break;
        }
        next_review_at = new Date(lastSolved.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      }
    }

    this.problems.set(problemId, {
      ...problem,
      attempt_count,
      solved_count,
      failed_count,
      last_attempt_at,
      last_solved_at,
      next_review_at: next_review_at ? next_review_at.toISOString() : null,
      revision_count,
      review_stage: review_stage as DsaRevisionStage,
      updated_at: new Date().toISOString(),
    });
  }

  // Problem detail
  async getProblemDetail(userId: string, problemId: string): Promise<DsaProblemDetailDto | null> {
    const problem = await this.getProblemById(userId, problemId);
    if (!problem) return null;

    const topicIds = this.problemTopics
      .filter((pt) => pt.user_id === userId && pt.problem_id === problemId)
      .map((pt) => pt.topic_id);
    const topics = Array.from(this.topics.values()).filter((t) => topicIds.includes(t.id));

    const recentAttempts = await this.listAttemptsByProblem(userId, problemId);

    return {
      problem,
      topics,
      skills: [],
      goals: [],
      tasks: [],
      recent_attempts: recentAttempts.slice(0, 5),
    };
  }

  // Topic CRUD
  async createTopic(userId: string, data: CreateDsaTopicInput): Promise<DsaTopicDto> {
    const now = new Date().toISOString();
    const slug = data.slug && data.slug.trim().length > 0 ? data.slug.trim() : this.generateSlug(data.name);
    const id = crypto.randomUUID();
    const topic: DsaTopicDto = {
      id,
      user_id: userId,
      parent_topic_id: data.parent_topic_id ?? null,
      name: data.name,
      slug,
      status: 'active',
      created_at: now,
      updated_at: now,
      parent_topic: null,
      children: [],
    };
    this.topics.set(id, topic);
    return { ...topic };
  }

  async getTopicById(userId: string, topicId: string): Promise<DsaTopicDto | null> {
    const t = this.topics.get(topicId);
    if (!t || t.user_id !== userId) return null;
    return { ...t };
  }

  async getTopicBySlug(userId: string, slug: string): Promise<DsaTopicDto | null> {
    for (const t of this.topics.values()) {
      if (t.user_id === userId && t.slug === slug) {
        return { ...t };
      }
    }
    return null;
  }

  async listTopics(userId: string, query?: { status?: 'active' | 'archived'; parentTopicId?: string | null; search?: string }): Promise<DsaTopicDto[]> {
    let list = Array.from(this.topics.values()).filter((t) => t.user_id === userId);
    if (query?.status) list = list.filter((t) => t.status === query.status);
    if (query?.parentTopicId !== undefined) list = list.filter((t) => t.parent_topic_id === query.parentTopicId);
    if (query?.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
    }
    return list.map((t) => ({ ...t }));
  }

  async updateTopic(userId: string, topicId: string, data: UpdateDsaTopicInput): Promise<DsaTopicDto> {
    const existing = this.topics.get(topicId);
    if (!existing || existing.user_id !== userId) {
      throw new Error('Topic not found');
    }
    const updated: DsaTopicDto = {
      ...existing,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.parent_topic_id !== undefined ? { parent_topic_id: data.parent_topic_id ?? null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updated_at: new Date().toISOString(),
    };
    this.topics.set(topicId, updated);
    return { ...updated };
  }

  async archiveTopic(userId: string, topicId: string): Promise<DsaTopicDto> {
    return this.updateTopic(userId, topicId, { status: 'archived' });
  }

  async deleteTopic(userId: string, topicId: string): Promise<void> {
    const existing = this.topics.get(topicId);
    if (!existing || existing.user_id !== userId) {
      throw new Error('Topic not found');
    }
    this.topics.delete(topicId);
  }

  // Relationships
  async linkProblemTopic(userId: string, data: LinkDsaProblemTopicInput): Promise<void> {
    if (!this.problemTopics.some((pt) => pt.user_id === userId && pt.problem_id === data.problem_id && pt.topic_id === data.topic_id)) {
      this.problemTopics.push({ user_id: userId, problem_id: data.problem_id, topic_id: data.topic_id });
    }
  }

  async unlinkProblemTopic(userId: string, problemId: string, topicId: string): Promise<void> {
    this.problemTopics = this.problemTopics.filter(
      (pt) => !(pt.user_id === userId && pt.problem_id === problemId && pt.topic_id === topicId)
    );
  }

  async linkProblemSkill(userId: string, data: LinkDsaProblemSkillInput): Promise<void> {
    if (!this.problemSkills.some((ps) => ps.user_id === userId && ps.problem_id === data.problem_id && ps.skill_id === data.skill_id)) {
      this.problemSkills.push({ user_id: userId, problem_id: data.problem_id, skill_id: data.skill_id });
    }
  }

  async unlinkProblemSkill(userId: string, problemId: string, skillId: string): Promise<void> {
    this.problemSkills = this.problemSkills.filter(
      (ps) => !(ps.user_id === userId && ps.problem_id === problemId && ps.skill_id === skillId)
    );
  }

  async linkProblemGoal(userId: string, data: LinkDsaProblemGoalInput): Promise<void> {
    if (!this.problemGoals.some((pg) => pg.user_id === userId && pg.problem_id === data.problem_id && pg.goal_id === data.goal_id)) {
      this.problemGoals.push({ user_id: userId, problem_id: data.problem_id, goal_id: data.goal_id });
    }
  }

  async unlinkProblemGoal(userId: string, problemId: string, goalId: string): Promise<void> {
    this.problemGoals = this.problemGoals.filter(
      (pg) => !(pg.user_id === userId && pg.problem_id === problemId && pg.goal_id === goalId)
    );
  }

  async linkProblemTask(userId: string, data: LinkDsaProblemTaskInput): Promise<void> {
    if (!this.problemTasks.some((pt) => pt.user_id === userId && pt.problem_id === data.problem_id && pt.task_id === data.task_id)) {
      this.problemTasks.push({ user_id: userId, problem_id: data.problem_id, task_id: data.task_id });
    }
  }

  async unlinkProblemTask(userId: string, problemId: string, taskId: string): Promise<void> {
    this.problemTasks = this.problemTasks.filter(
      (pt) => !(pt.user_id === userId && pt.problem_id === problemId && pt.task_id === taskId)
    );
  }

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
    const problems = Array.from(this.problems.values()).filter((p) => p.user_id === userId);
    const total_problems = problems.length;
    const solved_problems = problems.filter((p) => p.solved_count > 0).length;
    const attempted_problems = problems.filter((p) => p.attempt_count > 0).length;
    const revision_due_count = problems.filter((p) => p.next_review_at && new Date(p.next_review_at) <= new Date()).length;

    return {
      total_problems,
      solved_problems,
      attempted_problems,
      revision_due_count,
      weak_areas: [],
      recommended_problem: null,
    };
  }
}