import {
  type CreateSkillInput,
  type Database,
  type EvidenceDto,
  type EvidenceLinkDto,
  type EvidenceSkillDto,
  type GoalSkillDto,
  type LinkEvidenceToSkillInput,
  type LinkGoalToSkillInput,
  type LinkTaskToSkillInput,
  type LinkTopicToSkillInput,
  type SkillDto,
  type SkillQueryInput,
  type SkillRow,
  type TaskSkillDto,
  type TopicSkillDto,
  type UpdateSkillInput,
  slugifySkillName,
} from '@avenza/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import type { ISkillsRepository } from './skills.types';

export class SupabaseSkillsRepository implements ISkillsRepository {
  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) { }

  private mapSkillRow(row: SkillRow, parent?: { id: string; name: string; slug: string } | null): SkillDto {
    return {
      id: row.id,
      user_id: row.user_id,
      parent_skill_id: row.parent_skill_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      category: row.category,
      status: row.status as SkillDto['status'],
      source: row.source as SkillDto['source'],
      created_at: row.created_at,
      updated_at: row.updated_at,
      parent_skill: parent ?? null,
    };
  }

  async createSkill(userId: string, data: CreateSkillInput): Promise<SkillDto> {
    const slug = data.slug && data.slug.trim().length > 0 ? data.slug.trim() : slugifySkillName(data.name);

    const { data: row, error } = await this.client
      .from('skills')
      .insert({
        user_id: userId,
        name: data.name.trim(),
        slug,
        description: data.description ?? null,
        category: data.category ?? null,
        parent_skill_id: data.parent_skill_id ?? null,
        status: 'active',
        source: 'user',
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to create skill: ${error?.message || 'Unknown error'}`);
    }

    let parent: { id: string; name: string; slug: string } | null = null;
    if (row.parent_skill_id) {
      const parentSkill = await this.getSkillById(userId, row.parent_skill_id);
      if (parentSkill) {
        parent = { id: parentSkill.id, name: parentSkill.name, slug: parentSkill.slug };
      }
    }

    return this.mapSkillRow(row, parent);
  }

  async getSkillById(userId: string, skillId: string): Promise<SkillDto | null> {
    const { data: row, error } = await this.client
      .from('skills')
      .select('*')
      .eq('id', skillId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !row) {
      return null;
    }

    let parent: { id: string; name: string; slug: string } | null = null;
    if (row.parent_skill_id) {
      const { data: parentRow } = await this.client
        .from('skills')
        .select('id, name, slug')
        .eq('id', row.parent_skill_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (parentRow) {
        parent = { id: parentRow.id, name: parentRow.name, slug: parentRow.slug };
      }
    }

    return this.mapSkillRow(row, parent);
  }

  async getSkillBySlug(userId: string, slug: string): Promise<SkillDto | null> {
    const { data: row, error } = await this.client
      .from('skills')
      .select('*')
      .eq('slug', slug)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !row) {
      return null;
    }

    return this.mapSkillRow(row);
  }

  async listSkills(userId: string, query?: SkillQueryInput): Promise<SkillDto[]> {
    let q = this.client
      .from('skills')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (query?.status) {
      q = q.eq('status', query.status);
    }
    if (query?.category) {
      q = q.eq('category', query.category);
    }
    if (query?.parent_skill_id !== undefined) {
      if (query.parent_skill_id === null) {
        q = q.is('parent_skill_id', null);
      } else {
        q = q.eq('parent_skill_id', query.parent_skill_id);
      }
    }
    if (query?.search && query.search.trim().length > 0) {
      q = q.ilike('name', `%${query.search.trim()}%`);
    }

    const { data: rows, error } = await q;
    if (error || !rows) {
      throw new Error(`Failed to list skills: ${error?.message || 'Unknown error'}`);
    }

    // Build parent map for fast lookup
    const parentIds = rows.map((r) => r.parent_skill_id).filter((id): id is string => Boolean(id));
    const parentMap = new Map<string, { id: string; name: string; slug: string }>();

    if (parentIds.length > 0) {
      const { data: parents } = await this.client
        .from('skills')
        .select('id, name, slug')
        .in('id', parentIds);

      if (parents) {
        for (const p of parents) {
          parentMap.set(p.id, { id: p.id, name: p.name, slug: p.slug });
        }
      }
    }

    return rows.map((row) => this.mapSkillRow(row, row.parent_skill_id ? parentMap.get(row.parent_skill_id) : null));
  }

  async updateSkill(userId: string, skillId: string, data: UpdateSkillInput): Promise<SkillDto> {
    const updatePayload: Partial<Database['public']['Tables']['skills']['Update']> = {};

    if (data.name !== undefined) {
      updatePayload.name = data.name.trim();
      if (!data.slug) {
        updatePayload.slug = slugifySkillName(data.name);
      }
    }
    if (data.slug !== undefined) {
      updatePayload.slug = data.slug.trim();
    }
    if (data.description !== undefined) {
      updatePayload.description = data.description;
    }
    if (data.category !== undefined) {
      updatePayload.category = data.category;
    }
    if (data.status !== undefined) {
      updatePayload.status = data.status;
    }
    if (data.parent_skill_id !== undefined) {
      updatePayload.parent_skill_id = data.parent_skill_id;
    }

    const { data: row, error } = await this.client
      .from('skills')
      .update(updatePayload)
      .eq('id', skillId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to update skill: ${error?.message || 'Unknown error'}`);
    }

    return this.mapSkillRow(row);
  }

  async archiveSkill(userId: string, skillId: string): Promise<SkillDto> {
    return this.updateSkill(userId, skillId, { status: 'archived' });
  }

  async deleteSkill(userId: string, skillId: string): Promise<void> {
    const { error } = await this.client
      .from('skills')
      .delete()
      .eq('id', skillId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete skill: ${error.message}`);
    }
  }

  // ----------------------------------------------------------------------------
  // Evidence Linkage
  // ----------------------------------------------------------------------------
  async linkEvidence(userId: string, data: LinkEvidenceToSkillInput): Promise<EvidenceSkillDto> {
    const { data: row, error } = await this.client
      .from('evidence_skills')
      .insert({
        evidence_id: data.evidence_id,
        skill_id: data.skill_id,
        user_id: userId,
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to link evidence to skill: ${error?.message || 'Unknown error'}`);
    }

    return {
      evidence_id: row.evidence_id,
      skill_id: row.skill_id,
      user_id: row.user_id,
      created_at: row.created_at,
    };
  }

  async unlinkEvidence(userId: string, evidenceId: string, skillId: string): Promise<void> {
    const { error } = await this.client
      .from('evidence_skills')
      .delete()
      .eq('evidence_id', evidenceId)
      .eq('skill_id', skillId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to unlink evidence from skill: ${error.message}`);
    }
  }

  async getEvidenceForSkill(userId: string, skillId: string): Promise<EvidenceDto[]> {
    const { data: links, error: linkErr } = await this.client
      .from('evidence_skills')
      .select('evidence_id')
      .eq('skill_id', skillId)
      .eq('user_id', userId);

    if (linkErr || !links || links.length === 0) {
      return [];
    }

    const evidenceIds = links.map((l) => l.evidence_id);
    const { data: rows, error: evErr } = await this.client
      .from('evidence')
      .select('*')
      .in('id', evidenceIds)
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false });

    if (evErr || !rows) {
      return [];
    }

    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      evidence_type: r.evidence_type as EvidenceDto['evidence_type'],
      title: r.title,
      description: r.description,
      source_type: r.source_type as EvidenceDto['source_type'],
      source_id: r.source_id,
      source_reference: r.source_reference,
      external_url: r.external_url,
      occurred_at: r.occurred_at,
      recorded_at: r.recorded_at,
      verification_status: r.verification_status as EvidenceDto['verification_status'],
      evidence_strength: r.evidence_strength as EvidenceDto['evidence_strength'],
      reliability: r.reliability as EvidenceDto['reliability'],
      directness: r.directness as EvidenceDto['directness'],
      notes: r.notes,
      metadata: (r.metadata || {}) as Record<string, unknown>,
      created_at: r.created_at,
      updated_at: r.updated_at,
      links: [],
    }));
  }

  async getSkillsForEvidence(userId: string, evidenceId: string): Promise<SkillDto[]> {
    const { data: links, error: linkErr } = await this.client
      .from('evidence_skills')
      .select('skill_id')
      .eq('evidence_id', evidenceId)
      .eq('user_id', userId);

    if (linkErr || !links || links.length === 0) {
      return [];
    }

    const skillIds = links.map((l) => l.skill_id);
    const { data: rows, error: skErr } = await this.client
      .from('skills')
      .select('*')
      .in('id', skillIds)
      .eq('user_id', userId);

    if (skErr || !rows) {
      return [];
    }

    return rows.map((r) => this.mapSkillRow(r));
  }

  // ----------------------------------------------------------------------------
  // Goal Linkage
  // ----------------------------------------------------------------------------
  async linkGoal(userId: string, data: LinkGoalToSkillInput): Promise<GoalSkillDto> {
    const { data: row, error } = await this.client
      .from('goal_skills')
      .insert({
        goal_id: data.goal_id,
        skill_id: data.skill_id,
        user_id: userId,
        target_mastery_state: data.target_mastery_state ?? null,
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to link goal to skill: ${error?.message || 'Unknown error'}`);
    }

    return {
      goal_id: row.goal_id,
      skill_id: row.skill_id,
      user_id: row.user_id,
      target_mastery_state: row.target_mastery_state as GoalSkillDto['target_mastery_state'],
      created_at: row.created_at,
    };
  }

  async unlinkGoal(userId: string, goalId: string, skillId: string): Promise<void> {
    const { error } = await this.client
      .from('goal_skills')
      .delete()
      .eq('goal_id', goalId)
      .eq('skill_id', skillId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to unlink goal from skill: ${error.message}`);
    }
  }

  async getGoalsForSkill(
    userId: string,
    skillId: string
  ): Promise<
    Array<{
      id: string;
      title: string;
      status: string;
      target_mastery_state: GoalSkillDto['target_mastery_state'];
    }>
  > {
    const { data: links, error: linkErr } = await this.client
      .from('goal_skills')
      .select('goal_id, target_mastery_state')
      .eq('skill_id', skillId)
      .eq('user_id', userId);

    if (linkErr || !links || links.length === 0) {
      return [];
    }

    const goalIds = links.map((l) => l.goal_id);
    const { data: goals, error: gErr } = await this.client
      .from('goals')
      .select('id, title, status')
      .in('id', goalIds)
      .eq('user_id', userId);

    if (gErr || !goals) {
      return [];
    }

    const stateMap = new Map(links.map((l) => [l.goal_id, l.target_mastery_state]));
    return goals.map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status,
      target_mastery_state: (stateMap.get(g.id) || null) as GoalSkillDto['target_mastery_state'],
    }));
  }

  // ----------------------------------------------------------------------------
  // Task Linkage
  // ----------------------------------------------------------------------------
  async linkTask(userId: string, data: LinkTaskToSkillInput): Promise<TaskSkillDto> {
    const { data: row, error } = await this.client
      .from('task_skills')
      .insert({
        task_id: data.task_id,
        skill_id: data.skill_id,
        user_id: userId,
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to link task to skill: ${error?.message || 'Unknown error'}`);
    }

    return {
      task_id: row.task_id,
      skill_id: row.skill_id,
      user_id: row.user_id,
      created_at: row.created_at,
    };
  }

  async unlinkTask(userId: string, taskId: string, skillId: string): Promise<void> {
    const { error } = await this.client
      .from('task_skills')
      .delete()
      .eq('task_id', taskId)
      .eq('skill_id', skillId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to unlink task from skill: ${error.message}`);
    }
  }

  async getTasksForSkill(
    userId: string,
    skillId: string
  ): Promise<Array<{ id: string; title: string; status: string }>> {
    const { data: links, error: linkErr } = await this.client
      .from('task_skills')
      .select('task_id')
      .eq('skill_id', skillId)
      .eq('user_id', userId);

    if (linkErr || !links || links.length === 0) {
      return [];
    }

    const taskIds = links.map((l) => l.task_id);
    const { data: tasks, error: tErr } = await this.client
      .from('tasks')
      .select('id, title, status')
      .in('id', taskIds)
      .eq('user_id', userId);

    if (tErr || !tasks) {
      return [];
    }

    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
    }));
  }

  // ----------------------------------------------------------------------------
  // Topic Linkage
  // ----------------------------------------------------------------------------
  async linkTopic(userId: string, data: LinkTopicToSkillInput): Promise<TopicSkillDto> {
    const { data: row, error } = await this.client
      .from('topic_skills')
      .insert({
        topic_id: data.topic_id,
        skill_id: data.skill_id,
        user_id: userId,
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to link topic to skill: ${error?.message || 'Unknown error'}`);
    }

    return {
      topic_id: row.topic_id,
      skill_id: row.skill_id,
      user_id: row.user_id,
      created_at: row.created_at,
    };
  }

  async unlinkTopic(userId: string, topicId: string, skillId: string): Promise<void> {
    const { error } = await this.client
      .from('topic_skills')
      .delete()
      .eq('topic_id', topicId)
      .eq('skill_id', skillId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to unlink topic from skill: ${error.message}`);
    }
  }

  async getTopicsForSkill(
    userId: string,
    skillId: string
  ): Promise<
    Array<{
      id: string;
      name: string;
      status: string;
      subject_id: string;
      subject_name?: string;
    }>
  > {
    const { data: links, error: linkErr } = await this.client
      .from('topic_skills')
      .select('topic_id')
      .eq('skill_id', skillId)
      .eq('user_id', userId);

    if (linkErr || !links || links.length === 0) {
      return [];
    }

    const topicIds = links.map((l) => l.topic_id);
    const { data: topics, error: topErr } = await this.client
      .from('subject_topics')
      .select('id, name, status, subject_id')
      .in('id', topicIds)
      .eq('user_id', userId);

    if (topErr || !topics || topics.length === 0) {
      return [];
    }

    // Fetch subjects for topic names
    const subjectIds = Array.from(new Set(topics.map((t) => t.subject_id)));
    const { data: subjects } = await this.client
      .from('subjects')
      .select('id, name')
      .in('id', subjectIds)
      .eq('user_id', userId);

    const subjectMap = new Map((subjects || []).map((s) => [s.id, s.name]));

    return topics.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      subject_id: t.subject_id,
      subject_name: subjectMap.get(t.subject_id),
    }));
  }

  // ----------------------------------------------------------------------------
  // Child Skills
  // ----------------------------------------------------------------------------
  async getChildSkills(userId: string, parentSkillId: string): Promise<SkillDto[]> {
    const { data: rows, error } = await this.client
      .from('skills')
      .select('*')
      .eq('parent_skill_id', parentSkillId)
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error || !rows) {
      return [];
    }

    return rows.map((r) => this.mapSkillRow(r));
  }
}

export interface ISkillsEvidenceLookup {
  getEvidenceRowById(id: string): { user_id: string } | null;
  findEvidenceById(
    id: string,
    userId: string
  ): Promise<{ evidence: EvidenceDto; links?: EvidenceLinkDto[] } | null>;
}

export class InMemorySkillsRepository implements ISkillsRepository {
  private skills: SkillDto[] = [];
  private evidenceSkillLinks: Array<{
    evidence_id: string;
    skill_id: string;
    user_id: string;
    created_at: string;
  }> = [];
  private goalSkillLinks: Array<{
    goal_id: string;
    skill_id: string;
    user_id: string;
    created_at: string;
    target_mastery_state: GoalSkillDto['target_mastery_state'];
  }> = [];
  private taskSkillLinks: Array<{
    task_id: string;
    skill_id: string;
    user_id: string;
    created_at: string;
  }> = [];
  private topicSkillLinks: Array<{
    topic_id: string;
    skill_id: string;
    user_id: string;
    created_at: string;
  }> = [];

  constructor(
    initialSkills: SkillDto[] = [],
    private readonly evidenceLookup?: ISkillsEvidenceLookup
  ) {
    this.skills = [...initialSkills];
  }

  async createSkill(userId: string, data: CreateSkillInput): Promise<SkillDto> {
    const slug = data.slug && data.slug.trim().length > 0 ? data.slug.trim() : slugifySkillName(data.name);

    let parent: { id: string; name: string; slug: string } | null = null;
    if (data.parent_skill_id) {
      const parentSkill = await this.getSkillById(userId, data.parent_skill_id);
      if (parentSkill) {
        parent = { id: parentSkill.id, name: parentSkill.name, slug: parentSkill.slug };
      }
    }

    const now = new Date().toISOString();
    const newSkill: SkillDto = {
      id: crypto.randomUUID(),
      user_id: userId,
      parent_skill_id: data.parent_skill_id ?? null,
      name: data.name.trim(),
      slug,
      description: data.description ?? null,
      category: data.category ?? null,
      status: 'active',
      source: 'user',
      created_at: now,
      updated_at: now,
      parent_skill: parent,
    };

    this.skills.push(newSkill);
    return { ...newSkill };
  }

  async getSkillById(userId: string, skillId: string): Promise<SkillDto | null> {
    const skill = this.skills.find((s) => s.id === skillId && s.user_id === userId);
    if (!skill) return null;

    let parent: { id: string; name: string; slug: string } | null = null;
    if (skill.parent_skill_id) {
      const parentSkill = this.skills.find(
        (s) => s.id === skill.parent_skill_id && s.user_id === userId
      );
      if (parentSkill) {
        parent = { id: parentSkill.id, name: parentSkill.name, slug: parentSkill.slug };
      }
    }

    return { ...skill, parent_skill: parent };
  }

  async getSkillBySlug(userId: string, slug: string): Promise<SkillDto | null> {
    const skill = this.skills.find((s) => s.slug === slug && s.user_id === userId);
    return skill ? { ...skill } : null;
  }

  async listSkills(userId: string, query?: SkillQueryInput): Promise<SkillDto[]> {
    let result = this.skills.filter((s) => s.user_id === userId);

    if (query?.status) {
      result = result.filter((s) => s.status === query.status);
    }
    if (query?.category) {
      result = result.filter((s) => s.category === query.category);
    }
    if (query?.parent_skill_id !== undefined) {
      result = result.filter((s) => s.parent_skill_id === query.parent_skill_id);
    }
    if (query?.search && query.search.trim()) {
      const q = query.search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q))
      );
    }

    return result.sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ ...s }));
  }

  async updateSkill(userId: string, skillId: string, data: UpdateSkillInput): Promise<SkillDto> {
    const idx = this.skills.findIndex((s) => s.id === skillId && s.user_id === userId);
    if (idx === -1) {
      throw new Error('Skill not found');
    }

    const existing = this.skills[idx]!;
    const now = new Date().toISOString();
    const updated: SkillDto = {
      ...existing,
      name: data.name !== undefined ? data.name.trim() : existing.name,
      slug:
        data.slug !== undefined
          ? data.slug
          : data.name !== undefined
            ? slugifySkillName(data.name)
            : existing.slug,
      description: data.description !== undefined ? data.description : existing.description,
      category: data.category !== undefined ? data.category : existing.category,
      parent_skill_id:
        data.parent_skill_id !== undefined ? data.parent_skill_id : existing.parent_skill_id,
      updated_at: now,
    };

    this.skills[idx] = updated;
    return { ...updated };
  }

  async archiveSkill(userId: string, skillId: string): Promise<SkillDto> {
    const idx = this.skills.findIndex((s) => s.id === skillId && s.user_id === userId);
    if (idx === -1) throw new Error('Skill not found');

    this.skills[idx] = {
      ...this.skills[idx]!,
      status: 'archived',
      updated_at: new Date().toISOString(),
    };
    return { ...this.skills[idx]! };
  }

  async deleteSkill(userId: string, skillId: string): Promise<void> {
    const idx = this.skills.findIndex((s) => s.id === skillId && s.user_id === userId);
    if (idx === -1) throw new Error('Skill not found');

    this.skills.splice(idx, 1);
    this.evidenceSkillLinks = this.evidenceSkillLinks.filter((l) => l.skill_id !== skillId);
    this.goalSkillLinks = this.goalSkillLinks.filter((l) => l.skill_id !== skillId);
    this.taskSkillLinks = this.taskSkillLinks.filter((l) => l.skill_id !== skillId);
    this.topicSkillLinks = this.topicSkillLinks.filter((l) => l.skill_id !== skillId);
  }

  // Evidence links
  async linkEvidence(userId: string, data: LinkEvidenceToSkillInput): Promise<EvidenceSkillDto> {
    const skill = this.skills.find((s) => s.id === data.skill_id && s.user_id === userId);
    if (!skill) {
      throw new Error('Referenced skill not found');
    }

    if (this.evidenceLookup) {
      const ev = this.evidenceLookup.getEvidenceRowById(data.evidence_id);
      if (!ev) {
        throw new Error('Referenced evidence does not exist (not found)');
      }
      if (ev.user_id !== userId) {
        throw new Error('Referenced evidence does not belong to user (User ID must match across evidence and skill records)');
      }
    }

    const duplicate = this.evidenceSkillLinks.find(
      (l) => l.evidence_id === data.evidence_id && l.skill_id === data.skill_id
    );
    if (duplicate) {
      throw new Error(
        'Failed to link evidence to skill: duplicate key value violates unique constraint pk_evidence_skills'
      );
    }

    const now = new Date().toISOString();
    const link: EvidenceSkillDto = {
      evidence_id: data.evidence_id,
      skill_id: data.skill_id,
      user_id: userId,
      created_at: now,
    };

    this.evidenceSkillLinks.push(link);
    return { ...link };
  }

  async unlinkEvidence(userId: string, evidenceId: string, skillId: string): Promise<void> {
    this.evidenceSkillLinks = this.evidenceSkillLinks.filter(
      (l) => !(l.evidence_id === evidenceId && l.skill_id === skillId && l.user_id === userId)
    );
  }

  async getEvidenceForSkill(userId: string, skillId: string): Promise<EvidenceDto[]> {
    const links = this.evidenceSkillLinks.filter(
      (l) => l.skill_id === skillId && l.user_id === userId
    );
    if (links.length === 0) return [];

    const results: EvidenceDto[] = [];
    if (this.evidenceLookup) {
      for (const l of links) {
        const item = await this.evidenceLookup.findEvidenceById(l.evidence_id, userId);
        if (item) {
          const ev = item.evidence;
          results.push({
            id: ev.id,
            user_id: ev.user_id,
            evidence_type: ev.evidence_type,
            title: ev.title,
            description: ev.description,
            source_type: ev.source_type,
            source_id: ev.source_id,
            source_reference: ev.source_reference,
            external_url: ev.external_url,
            occurred_at: ev.occurred_at,
            recorded_at: ev.recorded_at,
            verification_status: ev.verification_status,
            evidence_strength: ev.evidence_strength,
            reliability: ev.reliability,
            directness: ev.directness,
            notes: ev.notes,
            metadata: ev.metadata,
            created_at: ev.created_at,
            updated_at: ev.updated_at,
            links: item.links?.map((link: EvidenceLinkDto) => ({
              id: link.id,
              evidence_id: link.evidence_id,
              entity_type: link.entity_type,
              entity_id: link.entity_id,
              created_at: link.created_at,
              entity_title: link.entity_title ?? null,
            })),
          });
        }
      }
    }

    results.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    return results;
  }

  async getSkillsForEvidence(userId: string, evidenceId: string): Promise<SkillDto[]> {
    const links = this.evidenceSkillLinks.filter(
      (l) => l.evidence_id === evidenceId && l.user_id === userId
    );
    const skillIds = links.map((l) => l.skill_id);
    return this.skills.filter((s) => skillIds.includes(s.id) && s.user_id === userId);
  }

  // Goal links
  async linkGoal(userId: string, data: LinkGoalToSkillInput): Promise<GoalSkillDto> {
    const now = new Date().toISOString();
    const link: GoalSkillDto = {
      goal_id: data.goal_id,
      skill_id: data.skill_id,
      user_id: userId,
      created_at: now,
      target_mastery_state: data.target_mastery_state ?? null,
    };
    this.goalSkillLinks.push(link);
    return { ...link };
  }

  async unlinkGoal(userId: string, goalId: string, skillId: string): Promise<void> {
    this.goalSkillLinks = this.goalSkillLinks.filter(
      (l) => !(l.goal_id === goalId && l.skill_id === skillId && l.user_id === userId)
    );
  }

  async getGoalsForSkill(
    userId: string,
    skillId: string
  ): Promise<
    Array<{
      id: string;
      title: string;
      status: string;
      target_mastery_state: GoalSkillDto['target_mastery_state'];
    }>
  > {
    return this.goalSkillLinks
      .filter((l) => l.skill_id === skillId && l.user_id === userId)
      .map((l) => ({
        id: l.goal_id,
        title: 'Mock Goal',
        status: 'active',
        target_mastery_state: l.target_mastery_state,
      }));
  }

  // Task links
  async linkTask(userId: string, data: LinkTaskToSkillInput): Promise<TaskSkillDto> {
    const now = new Date().toISOString();
    const link: TaskSkillDto = {
      task_id: data.task_id,
      skill_id: data.skill_id,
      user_id: userId,
      created_at: now,
    };
    this.taskSkillLinks.push(link);
    return { ...link };
  }

  async unlinkTask(userId: string, taskId: string, skillId: string): Promise<void> {
    this.taskSkillLinks = this.taskSkillLinks.filter(
      (l) => !(l.task_id === taskId && l.skill_id === skillId && l.user_id === userId)
    );
  }

  async getTasksForSkill(
    userId: string,
    skillId: string
  ): Promise<Array<{ id: string; title: string; status: string }>> {
    return this.taskSkillLinks
      .filter((l) => l.skill_id === skillId && l.user_id === userId)
      .map((l) => ({ id: l.task_id, title: 'Mock Task', status: 'completed' }));
  }

  // Topic links
  async linkTopic(userId: string, data: LinkTopicToSkillInput): Promise<TopicSkillDto> {
    const now = new Date().toISOString();
    const link: TopicSkillDto = {
      topic_id: data.topic_id,
      skill_id: data.skill_id,
      user_id: userId,
      created_at: now,
    };
    this.topicSkillLinks.push(link);
    return { ...link };
  }

  async unlinkTopic(userId: string, topicId: string, skillId: string): Promise<void> {
    this.topicSkillLinks = this.topicSkillLinks.filter(
      (l) => !(l.topic_id === topicId && l.skill_id === skillId && l.user_id === userId)
    );
  }

  async getTopicsForSkill(
    userId: string,
    skillId: string
  ): Promise<
    Array<{
      id: string;
      name: string;
      status: string;
      subject_id: string;
      subject_name?: string;
    }>
  > {
    return this.topicSkillLinks
      .filter((l) => l.skill_id === skillId && l.user_id === userId)
      .map((l) => ({
        id: l.topic_id,
        name: 'Mock Topic',
        status: 'active',
        subject_id: crypto.randomUUID(),
        subject_name: 'Computer Science',
      }));
  }

  // Children
  async getChildSkills(userId: string, parentSkillId: string): Promise<SkillDto[]> {
    return this.skills
      .filter((s) => s.parent_skill_id === parentSkillId && s.user_id === userId)
      .map((s) => ({ ...s }));
  }
}