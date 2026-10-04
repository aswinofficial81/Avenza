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

    return this.mapDsaAttemptRow(row);
  }

  async deleteAttempt(userId: string, attemptId: string): Promise<void> {
    // Get the attempt first to know which problem to update
    const attempt = await this.getAttemptById(userId, attemptId);
    if (!attempt) {
      throw new Error('Attempt not found');
    }

    const { error } = await this.client
      .from('dsa_attempts')
      .delete()
      .eq('id', attemptId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete attempt: ${error.message}`);
    }

    // Update problem statistics after deletion
    await this.updateProblemStatistics(userId, attempt.problem_id);
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
    // Get basic counts
    const [statsResult, weakAreaRows, revisionDueProblem, recentlyFailedProblem, recentUnsolvedProblem] = await Promise.all([
      // Basic counts
      this.client
        .from('dsa_problems')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .then(res => res),

      // Weak areas (topics with most failed attempts)
      this.client
        .from('dsa_topics')
        .select('id, name')
        .eq('dsa_topics.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(res => res),

      // Revision due problems
      this.client
        .from('dsa_problems')
        .select('id, title')
        .eq('user_id', userId)
        .not('next_review_at', 'is', null)
        .lte('next_review_at', new Date().toISOString())
        .order('next_review_at', { ascending: true })
        .limit(1)
        .then(res => res),

      // Recently failed problems
      this.client
        .from('dsa_attempts')
        .select('dsa_problems(id, title)')
        .eq('dsa_attempts.user_id', userId)
        .eq('dsa_attempts.status', 'failed' as DsaAttemptStatus)
        .order('dsa_attempts.occurred_at', { ascending: false })
        .limit(1)
        .then(res => res),

      // Recent unsolved problems
      this.client
        .from('dsa_problems')
        .select('id, title, solved_count, attempt_count, last_attempt_at')
        .eq('user_id', userId)
        .eq('solved_count', 0)
        .gt('attempt_count', 0)
        .order('last_attempt_at', { ascending: false })
        .limit(1)
        .then(res => res)
    ]);

    // Process basic counts
    const total_problems = statsResult.count ?? 0;
    const solved_problems = statsResult.data?.filter(p => p.solved_count > 0).length ?? 0;
    const attempted_problems = statsResult.data?.filter(p => p.attempt_count > 0).length ?? 0;

    // Process revision due count
    const revisionDueData = await this.client
      .from('dsa_problems')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .not('next_review_at', 'is', null)
      .lte('next_review_at', new Date().toISOString());

    const revision_due_count = revisionDueData.count ?? 0;

    // Process weak areas
    const weak_areas = (weakAreaRows.data || []).map((row: { id: string; name: string }) => ({
      topic_id: row.id,
      topic_name: row.name,
      problem_count: 0, // Placeholder - would need separate query to compute
      failure_count: 0, // Placeholder - would need separate query to compute
      reason: 'Topic needs review' // Placeholder reason
    }));

    // Get recommended problem
    let recommendedProblem: { id: string; title: string; reason: string } | null = null;

    // First check for revision due problems
    if (revisionDueProblem.data && revisionDueProblem.data.length > 0) {
      const problem = revisionDueProblem.data[0];
      if (problem) {
        recommendedProblem = {
          id: problem.id,
          title: problem.title,
          reason: 'Revision is due.'
        };
      }
    } else if (recentlyFailedProblem.data && recentlyFailedProblem.data.length > 0) {
      // Check for recently failed problems
      const problem = recentlyFailedProblem.data[0];
      if (problem && problem.dsa_problems) {
        recommendedProblem = {
          id: problem.dsa_problems.id,
          title: problem.dsa_problems.title,
          reason: 'You recently struggled with this problem.'
        };
      }
    } else if (recentUnsolvedProblem.data && recentUnsolvedProblem.data.length > 0) {
      // Fallback to most recently attempted unsolved problem
      const problem = recentUnsolvedProblem.data[0];
      if (problem) {
        recommendedProblem = {
          id: problem.id,
          title: problem.title,
          reason: 'You have attempted this problem but not yet solved it.'
        };
      }
    }

    return {
      total_problems,
      solved_problems,
      attempted_problems,
      revision_due_count,
      weak_areas,
      recommended_problem: recommendedProblem
    };
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
    const last_attempt_at = attempts.length > 0
      ? attempts.reduce((max, attempt) =>
          (max === null || attempt.occurred_at > max) ? attempt.occurred_at : max
        , null as string | null)
      : null;
    const solvedAttempts = attempts.filter(a => a.status === 'solved');
    const last_solved_at = solvedAttempts.length > 0
      ? solvedAttempts.reduce((max, attempt) =>
          (max === null || attempt.occurred_at > max) ? attempt.occurred_at : max
        , null as string | null)
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