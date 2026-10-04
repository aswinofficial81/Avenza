import { useBaseApi } from './base';

export const useDsaApi = () => {
  const baseApi = useBaseApi();

  return {
    // Problem methods
    getOverview: () => baseApi.get<{
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
    }>('/dsa/overview'),

    listProblems: (params?: {
      status?: 'active' | 'archived';
      difficulty?: 'easy' | 'medium' | 'hard';
      source?: 'user' | 'system' | 'imported';
      topic_id?: string;
      skill_id?: string;
      goal_id?: string;
      task_id?: string;
      search?: string;
      revision_due?: boolean;
    }) =>
      baseApi.get<Array<{
        id: string;
        user_id: string;
        title: string;
        slug: string;
        description: string | null;
        difficulty: 'easy' | 'medium' | 'hard';
        source: 'user' | 'system' | 'imported';
        status: 'active' | 'archived';
        external_url: string | null;
        estimated_minutes: number | null;
        attempt_count: number;
        solved_count: number;
        failed_count: number;
        last_attempt_at: string | null;
        last_solved_at: string | null;
        next_review_at: string | null;
        revision_count: number;
        review_stage: number;
        created_at: string;
        updated_at: string;
      }>>('/dsa/problems', { params }),

    getProblem: (id: string) =>
      baseApi.get<{
        id: string;
        user_id: string;
        title: string;
        slug: string;
        description: string | null;
        difficulty: 'easy' | 'medium' | 'hard';
        source: 'user' | 'system' | 'imported';
        status: 'active' | 'archived';
        external_url: string | null;
        estimated_minutes: number | null;
        attempt_count: number;
        solved_count: number;
        failed_count: number;
        last_attempt_at: string | null;
        last_solved_at: string | null;
        next_review_at: string | null;
        revision_count: number;
        review_stage: number;
        created_at: string;
        updated_at: string;
      }>(`/dsa/problems/${id}`),

    getProblemDetail: (id: string) =>
      baseApi.get<{
        problem: {
          id: string;
          user_id: string;
          title: string;
          slug: string;
          description: string | null;
          difficulty: 'easy' | 'medium' | 'hard';
          source: 'user' | 'system' | 'imported';
          status: 'active' | 'archived';
          external_url: string | null;
          estimated_minutes: number | null;
          attempt_count: number;
          solved_count: number;
          failed_count: number;
          last_attempt_at: string | null;
          last_solved_at: string | null;
          next_review_at: string | null;
          revision_count: number;
          review_stage: number;
          created_at: string;
          updated_at: string;
        };
        topics: Array<{
          id: string;
          user_id: string;
          parent_topic_id: string | null;
          name: string;
          slug: string;
          status: 'active' | 'archived';
          created_at: string;
          updated_at: string;
        }>;
        skills: Array<{
          id: string;
          name: string;
          slug: string;
        }>;
        goals: Array<{
          id: string;
          title: string;
          status: string;
        }>;
        tasks: Array<{
          id: string;
          title: string;
          status: string;
        }>;
        recent_attempts: Array<{
          id: string;
          user_id: string;
          problem_id: string;
          status: 'attempted' | 'solved' | 'failed' | 'abandoned';
          started_at: string | null;
          submitted_at: string | null;
          occurred_at: string;
          recorded_at: string;
          solve_time_minutes: number | null;
          language: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        }>;
      }>(`/dsa/problems/${id}/detail`),

    createProblem: (data: {
      title: string;
      slug?: string;
      description?: string | null;
      difficulty: 'easy' | 'medium' | 'hard';
      source?: 'user' | 'system' | 'imported';
      external_url?: string | null;
      estimated_minutes?: number | null;
    }) =>
      baseApi.post<{
        id: string;
        user_id: string;
        title: string;
        slug: string;
        description: string | null;
        difficulty: 'easy' | 'medium' | 'hard';
        source: 'user' | 'system' | 'imported';
        status: 'active' | 'archived';
        external_url: string | null;
        estimated_minutes: number | null;
        attempt_count: number;
        solved_count: number;
        failed_count: number;
        last_attempt_at: string | null;
        last_solved_at: string | null;
        next_review_at: string | null;
        revision_count: number;
        review_stage: number;
        created_at: string;
        updated_at: string;
      }>('/dsa/problems', data),

    updateProblem: (id: string, data: {
      title?: string;
      slug?: string;
      description?: string | null;
      difficulty?: 'easy' | 'medium' | 'hard';
      source?: 'user' | 'system' | 'imported';
      external_url?: string | null;
      estimated_minutes?: number | null;
      status?: 'active' | 'archived';
    }) =>
      baseApi.patch<{
        id: string;
        user_id: string;
        title: string;
        slug: string;
        description: string | null;
        difficulty: 'easy' | 'medium' | 'hard';
        source: 'user' | 'system' | 'imported';
        status: 'active' | 'archived';
        external_url: string | null;
        estimated_minutes: number | null;
        attempt_count: number;
        solved_count: number;
        failed_count: number;
        last_attempt_at: string | null;
        last_solved_at: string | null;
        next_review_at: string | null;
        revision_count: number;
        review_stage: number;
        created_at: string;
        updated_at: string;
      }>(`/dsa/problems/${id}`, data),

    archiveProblem: (id: string) =>
      baseApi.post<{
        id: string;
        user_id: string;
        title: string;
        slug: string;
        description: string | null;
        difficulty: 'easy' | 'medium' | 'hard';
        source: 'user' | 'system' | 'imported';
        status: 'active' | 'archived';
        external_url: string | null;
        estimated_minutes: number | null;
        attempt_count: number;
        solved_count: number;
        failed_count: number;
        last_attempt_at: string | null;
        last_solved_at: string | null;
        next_review_at: string | null;
        revision_count: number;
        review_stage: number;
        created_at: string;
        updated_at: string;
      }>(`/dsa/problems/${id}/archive`, {}),


    // Attempt methods
    createAttempt: (problemId: string, data: {
      status: 'attempted' | 'solved' | 'failed' | 'abandoned';
      started_at?: string | null;
      submitted_at?: string | null;
      occurred_at?: string;
      solve_time_minutes?: number | null;
      language?: string | null;
      notes?: string | null;
    }) =>
      baseApi.post<{
        id: string;
        user_id: string;
        problem_id: string;
        status: 'attempted' | 'solved' | 'failed' | 'abandoned';
        started_at: string | null;
        submitted_at: string | null;
        occurred_at: string;
        recorded_at: string;
        solve_time_minutes: number | null;
        language: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>(`/dsa/problems/${problemId}/attempts`, data),

    listAttemptsByProblem: (problemId: string) =>
      baseApi.get<Array<{
        id: string;
        user_id: string;
        problem_id: string;
        status: 'attempted' | 'solved' | 'failed' | 'abandoned';
        started_at: string | null;
        submitted_at: string | null;
        occurred_at: string;
        recorded_at: string;
        solve_time_minutes: number | null;
        language: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>>(`/dsa/problems/${problemId}/attempts`),

    getAttempt: (id: string) =>
      baseApi.get<{
        id: string;
        user_id: string;
        problem_id: string;
        status: 'attempted' | 'solved' | 'failed' | 'abandoned';
        started_at: string | null;
        submitted_at: string | null;
        occurred_at: string;
        recorded_at: string;
        solve_time_minutes: number | null;
        language: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>(`/dsa/attempts/${id}`),

    updateAttempt: (id: string, data: {
      status?: 'attempted' | 'solved' | 'failed' | 'abandoned';
      started_at?: string | null;
      submitted_at?: string | null;
      solve_time_minutes?: number | null;
      language?: string | null;
      notes?: string | null;
    }) =>
      baseApi.patch<{
        id: string;
        user_id: string;
        problem_id: string;
        status: 'attempted' | 'solved' | 'failed' | 'abandoned';
        started_at: string | null;
        submitted_at: string | null;
        occurred_at: string;
        recorded_at: string;
        solve_time_minutes: number | null;
        language: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>(`/dsa/attempts/${id}`, data),

    deleteAttempt: (id: string) =>
      baseApi.delete(`/dsa/attempts/${id}`),


    // Topic methods
    listTopics: (params?: {
      status?: 'active' | 'archived';
      parentTopicId?: string | null;
      search?: string;
    }) =>
      baseApi.get<Array<{
        id: string;
        user_id: string;
        parent_topic_id: string | null;
        name: string;
        slug: string;
        status: 'active' | 'archived';
        created_at: string;
        updated_at: string;
      }>>('/dsa/topics', { params }),

    getTopic: (id: string) =>
      baseApi.get<{
        id: string;
        user_id: string;
        parent_topic_id: string | null;
        name: string;
        slug: string;
        status: 'active' | 'archived';
        created_at: string;
        updated_at: string;
      }>(`/dsa/topics/${id}`),

    createTopic: (data: {
      name: string;
      slug?: string;
      parent_topic_id?: string | null;
    }) =>
      baseApi.post<{
        id: string;
        user_id: string;
        parent_topic_id: string | null;
        name: string;
        slug: string;
        status: 'active' | 'archived';
        created_at: string;
        updated_at: string;
      }>('/dsa/topics', data),

    updateTopic: (id: string, data: {
      name?: string;
      slug?: string;
      parent_topic_id?: string | null;
      status?: 'active' | 'archived';
    }) =>
      baseApi.patch<{
        id: string;
        user_id: string;
        parent_topic_id: string | null;
        name: string;
        slug: string;
        status: 'active' | 'archived';
        created_at: string;
        updated_at: string;
      }>(`/dsa/topics/${id}`, data),

    archiveTopic: (id: string) =>
      baseApi.post<{
        id: string;
        user_id: string;
        parent_topic_id: string | null;
        name: string;
        slug: string;
        status: 'active' | 'archived';
        created_at: string;
        updated_at: string;
      }>(`/dsa/topics/${id}/archive`, {}),


    // Relationship methods
    linkProblemTopic: (problemId: string, data: { topic_id: string }) =>
      baseApi.post(`/dsa/problems/${problemId}/topics`, data),

    unlinkProblemTopic: (problemId: string, topicId: string) =>
      baseApi.delete(`/dsa/problems/${problemId}/topics/${topicId}`),

    linkProblemSkill: (problemId: string, data: { skill_id: string }) =>
      baseApi.post(`/dsa/problems/${problemId}/skills`, data),

    unlinkProblemSkill: (problemId: string, skillId: string) =>
      baseApi.delete(`/dsa/problems/${problemId}/skills/${skillId}`),

    linkProblemGoal: (problemId: string, data: { goal_id: string }) =>
      baseApi.post(`/dsa/problems/${problemId}/goals`, data),

    unlinkProblemGoal: (problemId: string, goalId: string) =>
      baseApi.delete(`/dsa/problems/${problemId}/goals/${goalId}`),

    linkProblemTask: (problemId: string, data: { task_id: string }) =>
      baseApi.post(`/dsa/problems/${problemId}/tasks`, data),

    unlinkProblemTask: (problemId: string, taskId: string) =>
      baseApi.delete(`/dsa/problems/${problemId}/tasks/${taskId}`),
  };
};