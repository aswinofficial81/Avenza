import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AddCareerOpportunitySkillInput,
  AddCareerTargetSkillInput,
  AttachCareerApplicationProjectInput,
  CareerApplicationDetailDto,
  CareerApplicationDto,
  CareerApplicationHistoryDto,
  CareerApplicationPreparationDto,
  CareerApplicationProjectDto,
  CareerApplicationQueryInput,
  CareerApplicationStage,
  CareerSkillReadinessItem,
  CareerProjectReadinessItem,
  CareerProjectEvidenceItem,
  CareerTaskReadinessItem,
  CareerEmploymentType,
  CareerInterviewDto,
  CareerInterviewQueryInput,
  CareerInterviewResult,
  CareerInterviewStatus,
  CareerInterviewType,
  CareerLocationType,
  CareerOpportunityDetailDto,
  CareerOpportunityDto,
  CareerOpportunityQueryInput,
  CareerOpportunitySkillDto,
  CareerOpportunitySource,
  CareerOpportunityStatus,
  CareerSkillImportance,
  CareerTargetDetailDto,
  CareerTargetDto,
  CareerTargetQueryInput,
  CareerTargetSkillDto,
  CreateCareerApplicationHistoryInput,
  CreateCareerApplicationInput,
  CreateCareerInterviewInput,
  CreateCareerOpportunityInput,
  CreateCareerTargetInput,
  Database,
  PaginatedList,
  CareerTargetUpdate,
  CareerOpportunityUpdate,
  CareerApplicationUpdate,
  CareerApplicationProjectUpdate,
  CareerInterviewUpdate,
  CareerTargetRow,
  CareerTargetSkillRow,
  CareerOpportunityRow,
  CareerOpportunitySkillRow,
  CareerApplicationRow,
  CareerApplicationHistoryRow,
  CareerApplicationProjectRow,
  CareerInterviewRow,
  UpdateCareerApplicationInput,
  UpdateCareerApplicationProjectInput,
  UpdateCareerInterviewInput,
  UpdateCareerOpportunityInput,
  UpdateCareerOpportunitySkillInput,
  UpdateCareerTargetInput,
  UpdateCareerTargetSkillInput,
} from '@avenza/shared';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import {
  CareerConflictError,
  CareerNotFoundError,
  CareerOwnershipViolationError,
  CareerValidationError,
  type ICareerRepository,
} from './career.repository';

type TargetSkillJoinedRow = CareerTargetSkillRow & {
  skills?: { name: string; slug: string; category?: string | null } | null;
  skill_name?: string;
  skill_slug?: string;
  skill_category?: string | null;
};

type OpportunitySkillJoinedRow = CareerOpportunitySkillRow & {
  skills?: { name: string; slug: string; category?: string | null } | null;
  skill_name?: string;
  skill_slug?: string;
  skill_category?: string | null;
};

type ApplicationProjectJoinedRow = CareerApplicationProjectRow & {
  projects?: { title: string; slug: string; status: string } | null;
  project_title?: string;
  project_slug?: string;
  project_status?: string;
};

// ==============================================================================
// PostgreSQL / Supabase Database Implementation
// ==============================================================================

export class SupabaseCareerRepository implements ICareerRepository {
  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) {}

  // ----------------------------------------------------------------------------
  // Row Mapping Helpers
  // ----------------------------------------------------------------------------

  private mapTargetRow(row: CareerTargetRow): CareerTargetDto {
    return {
      id: row.id,
      user_id: row.user_id,
      goal_id: row.goal_id ?? null,
      title: row.title,
      target_role: row.target_role,
      target_locations: Array.isArray(row.target_locations) ? (row.target_locations as string[]) : [],
      employment_type: (row.employment_type as CareerEmploymentType) ?? null,
      target_date: row.target_date ?? null,
      min_compensation: row.min_compensation != null ? Number(row.min_compensation) : null,
      currency: row.currency ?? null,
      is_primary: Boolean(row.is_primary),
      notes: row.notes ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapTargetSkillRow(row: TargetSkillJoinedRow): CareerTargetSkillDto {
    return {
      id: row.id,
      user_id: row.user_id,
      target_id: row.target_id,
      skill_id: row.skill_id,
      importance: row.importance as CareerSkillImportance,
      created_at: row.created_at,
      skill_name: row.skills?.name ?? row.skill_name,
      skill_slug: row.skills?.slug ?? row.skill_slug,
      skill_category: row.skills?.category ?? row.skill_category ?? null,
    };
  }

  private mapOpportunityRow(row: CareerOpportunityRow): CareerOpportunityDto {
    return {
      id: row.id,
      user_id: row.user_id,
      target_id: row.target_id ?? null,
      company_name: row.company_name,
      role_title: row.role_title,
      employment_type: (row.employment_type as CareerEmploymentType) ?? null,
      location_type: (row.location_type as CareerLocationType) ?? null,
      location: row.location ?? null,
      source: row.source as CareerOpportunitySource,
      job_url: row.job_url ?? null,
      salary_min: row.salary_min != null ? Number(row.salary_min) : null,
      salary_max: row.salary_max != null ? Number(row.salary_max) : null,
      salary_currency: row.salary_currency ?? null,
      deadline: row.deadline ?? null,
      description: row.description ?? null,
      status: row.status as CareerOpportunityStatus,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapOpportunitySkillRow(row: OpportunitySkillJoinedRow): CareerOpportunitySkillDto {
    return {
      id: row.id,
      user_id: row.user_id,
      opportunity_id: row.opportunity_id,
      skill_id: row.skill_id,
      importance: row.importance as CareerSkillImportance,
      created_at: row.created_at,
      skill_name: row.skills?.name ?? row.skill_name,
      skill_slug: row.skills?.slug ?? row.skill_slug,
      skill_category: row.skills?.category ?? row.skill_category ?? null,
    };
  }

  private mapApplicationRow(row: CareerApplicationRow): CareerApplicationDto {
    return {
      id: row.id,
      user_id: row.user_id,
      opportunity_id: row.opportunity_id,
      stage: row.stage as CareerApplicationStage,
      applied_at: row.applied_at ?? null,
      deadline: row.deadline ?? null,
      resume_file_url: row.resume_file_url ?? null,
      cover_letter_url: row.cover_letter_url ?? null,
      notes: row.notes ?? null,
      rejection_reason: row.rejection_reason ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapApplicationHistoryRow(row: CareerApplicationHistoryRow): CareerApplicationHistoryDto {
    return {
      id: row.id,
      user_id: row.user_id,
      application_id: row.application_id,
      from_stage: (row.from_stage as CareerApplicationStage) ?? null,
      to_stage: row.to_stage as CareerApplicationStage,
      changed_at: row.changed_at,
      notes: row.notes ?? null,
    };
  }

  private mapApplicationProjectRow(row: ApplicationProjectJoinedRow): CareerApplicationProjectDto {
    return {
      id: row.id,
      user_id: row.user_id,
      application_id: row.application_id,
      project_id: row.project_id,
      is_featured: Boolean(row.is_featured),
      talking_points: row.talking_points ?? null,
      created_at: row.created_at,
      project_title: row.projects?.title ?? row.project_title,
      project_slug: row.projects?.slug ?? row.project_slug,
      project_status: row.projects?.status ?? row.project_status,
    };
  }

  private mapInterviewRow(row: CareerInterviewRow): CareerInterviewDto {
    return {
      id: row.id,
      user_id: row.user_id,
      application_id: row.application_id,
      round_number: row.round_number,
      round_type: row.round_type as CareerInterviewType,
      scheduled_at: row.scheduled_at ?? null,
      duration_minutes: row.duration_minutes,
      meeting_link: row.meeting_link ?? null,
      status: row.status as CareerInterviewStatus,
      result: row.result as CareerInterviewResult,
      interviewer_names: Array.isArray(row.interviewer_names) ? (row.interviewer_names as string[]) : [],
      notes: row.notes ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ----------------------------------------------------------------------------
  // Database Error Mapping Helper
  // ----------------------------------------------------------------------------

  private handleDbError(error: unknown, fallbackMessage: string): never {
    if (!error) {
      throw new Error(fallbackMessage);
    }
    const dbErr = error as { message?: string };
    const msg = dbErr.message || '';
    if (msg.includes('uq_career_targets_user_primary')) {
      throw new CareerConflictError('User already has a primary career target');
    }
    if (msg.includes('uq_career_target_skills_target_skill')) {
      throw new CareerConflictError('Skill is already attached to this career target');
    }
    if (msg.includes('uq_career_opportunity_skills_opp_skill')) {
      throw new CareerConflictError('Skill is already attached to this career opportunity');
    }
    if (
      msg.includes('uq_career_applications_user_opportunity') ||
      msg.includes('An application already exists for this opportunity')
    ) {
      throw new CareerConflictError('An application already exists for this opportunity');
    }
    if (msg.includes('uq_career_app_projects_app_proj')) {
      throw new CareerConflictError('Project is already attached to this career application');
    }
    if (msg.includes('career_application_history records are immutable')) {
      throw new CareerValidationError('Application history records are immutable and cannot be updated');
    }
    if (msg.includes('Referenced goal does not exist or belongs to another user')) {
      throw new CareerNotFoundError('Referenced goal does not exist or belongs to another user');
    }
    if (msg.includes('Career target not found')) {
      throw new CareerNotFoundError('Career target not found');
    }
    if (msg.includes('Career opportunity not found')) {
      throw new CareerNotFoundError('Career opportunity not found');
    }
    if (msg.includes('Career application not found')) {
      throw new CareerNotFoundError('Career application not found');
    }
    if (
      msg.includes('Application stage conflict') ||
      msg.includes('stage conflict') ||
      msg.includes('Cannot transition application from terminal stage')
    ) {
      throw new CareerConflictError(msg);
    }
    if (msg.includes('Illegal stage transition')) {
      throw new CareerValidationError(msg);
    }
    if (msg.includes('must belong to the same user') || msg.includes('does not exist')) {
      throw new CareerOwnershipViolationError(msg);
    }
    if (msg.includes('violates foreign key constraint')) {
      throw new CareerValidationError(`Invalid foreign key relationship: ${msg}`);
    }
    if (msg.includes('violates check constraint')) {
      throw new CareerValidationError(`Validation constraint violated: ${msg}`);
    }
    throw new Error(`${fallbackMessage}: ${msg}`);
  }

  // ============================================================================
  // 1. Career Target CRUD
  // ============================================================================

  async createTarget(userId: string, data: CreateCareerTargetInput): Promise<CareerTargetDto> {
    if (data.goal_id) {
      const { data: goal } = await this.client
        .from('goals')
        .select('id')
        .eq('id', data.goal_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (!goal) {
        throw new CareerNotFoundError('Referenced goal does not exist or belongs to another user');
      }
    }

    const { data: created, error } = await this.client.rpc('career_create_target', {
      p_user_id: userId,
      p_title: data.title,
      p_target_role: data.target_role,
      p_target_locations: data.target_locations || [],
      p_employment_type: data.employment_type ?? null,
      p_target_date: data.target_date ?? null,
      p_min_compensation: data.min_compensation ?? null,
      p_currency: data.currency ? data.currency.toUpperCase() : null,
      p_is_primary: Boolean(data.is_primary),
      p_notes: data.notes ?? null,
      p_goal_id: data.goal_id ?? null,
    });

    if (error || !created) {
      this.handleDbError(error, 'Failed to create career target');
    }

    return this.mapTargetRow(created as unknown as CareerTargetRow);
  }

  async getTargetById(userId: string, targetId: string): Promise<CareerTargetDto | null> {
    const { data: row, error } = await this.client
      .from('career_targets')
      .select('*')
      .eq('id', targetId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !row) {
      return null;
    }
    return this.mapTargetRow(row);
  }

  async getTargetDetail(userId: string, targetId: string): Promise<CareerTargetDetailDto | null> {
    const target = await this.getTargetById(userId, targetId);
    if (!target) {
      return null;
    }

    let goalTitle: string | null = null;
    if (target.goal_id) {
      const { data: goal } = await this.client
        .from('goals')
        .select('title')
        .eq('id', target.goal_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (goal) {
        goalTitle = goal.title;
      }
    }

    const skills = await this.listTargetSkills(userId, targetId);

    const { count } = await this.client
      .from('career_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('target_id', targetId)
      .eq('user_id', userId);

    return {
      ...target,
      goal_title: goalTitle,
      skills,
      opportunity_count: count ?? 0,
    };
  }

  async listTargets(userId: string, query?: CareerTargetQueryInput): Promise<PaginatedList<CareerTargetDto>> {
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const sortBy = query?.sortBy ?? 'created_at';
    const sortOrder = query?.sortOrder ?? 'desc';

    let q = this.client
      .from('career_targets')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (query?.is_primary !== undefined) {
      q = q.eq('is_primary', query.is_primary);
    }
    if (query?.employment_type) {
      q = q.eq('employment_type', query.employment_type);
    }
    if (query?.search && query.search.trim()) {
      const term = query.search.trim();
      q = q.or(`title.ilike.%${term}%,target_role.ilike.%${term}%`);
    }

    q = q.order(sortBy, { ascending: sortOrder === 'asc' });

    const offset = (page - 1) * pageSize;
    q = q.range(offset, offset + pageSize - 1);

    const { data, count, error } = await q;
    if (error) {
      this.handleDbError(error, 'Failed to list career targets');
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: (data || []).map((row) => this.mapTargetRow(row)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async updateTarget(
    userId: string,
    targetId: string,
    data: UpdateCareerTargetInput
  ): Promise<CareerTargetDto | null> {
    const existing = await this.getTargetById(userId, targetId);
    if (!existing) {
      return null;
    }

    if (data.goal_id) {
      const { data: goal } = await this.client
        .from('goals')
        .select('id')
        .eq('id', data.goal_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (!goal) {
        throw new CareerNotFoundError('Referenced goal does not exist or belongs to another user');
      }
    }

    if (data.is_primary === true) {
      // Atomically set as primary and unset previous primary within a single transaction
      const { data: primaryUpdated, error: rpcError } = await this.client.rpc('career_set_target_primary', {
        p_user_id: userId,
        p_target_id: targetId,
      });

      if (rpcError || !primaryUpdated) {
        this.handleDbError(rpcError, 'Failed to update career target as primary');
      }
    }

    const updatePayload: CareerTargetUpdate = {};
    if (data.title !== undefined) updatePayload.title = data.title.trim();
    if (data.target_role !== undefined) updatePayload.target_role = data.target_role.trim();
    if (data.target_locations !== undefined) updatePayload.target_locations = data.target_locations;
    if (data.employment_type !== undefined) updatePayload.employment_type = data.employment_type;
    if (data.target_date !== undefined) updatePayload.target_date = data.target_date;
    if (data.min_compensation !== undefined) updatePayload.min_compensation = data.min_compensation;
    if (data.currency !== undefined) updatePayload.currency = data.currency ? data.currency.toUpperCase() : null;
    if (data.is_primary === false) updatePayload.is_primary = false;
    if (data.notes !== undefined) updatePayload.notes = data.notes;
    if (data.goal_id !== undefined) updatePayload.goal_id = data.goal_id;

    if (Object.keys(updatePayload).length > 0) {
      const { data: updated, error } = await this.client
        .from('career_targets')
        .update(updatePayload)
        .eq('id', targetId)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();

      if (error) {
        this.handleDbError(error, 'Failed to update career target');
      }
      return updated ? this.mapTargetRow(updated) : null;
    }

    return this.getTargetById(userId, targetId);
  }

  async deleteTarget(userId: string, targetId: string): Promise<boolean> {
    const { error, count } = await this.client
      .from('career_targets')
      .delete({ count: 'exact' })
      .eq('id', targetId)
      .eq('user_id', userId);

    if (error) {
      this.handleDbError(error, 'Failed to delete career target');
    }
    return (count ?? 0) > 0;
  }

  async setPrimaryTarget(userId: string, targetId: string): Promise<CareerTargetDto | null> {
    const existing = await this.getTargetById(userId, targetId);
    if (!existing) {
      return null;
    }

    const { data: updated, error } = await this.client.rpc('career_set_target_primary', {
      p_user_id: userId,
      p_target_id: targetId,
    });

    if (error || !updated) {
      this.handleDbError(error, 'Failed to set primary career target');
    }

    return this.mapTargetRow(updated as unknown as CareerTargetRow);
  }

  // ============================================================================
  // 2. Career Target Skills
  // ============================================================================

  async addTargetSkill(
    userId: string,
    targetId: string,
    data: AddCareerTargetSkillInput
  ): Promise<CareerTargetSkillDto> {
    // 1. Tenant check target
    const target = await this.getTargetById(userId, targetId);
    if (!target) {
      throw new CareerNotFoundError('Career target not found');
    }

    // 2. Tenant check skill
    const { data: skill } = await this.client
      .from('skills')
      .select('id, name, slug, category')
      .eq('id', data.skill_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!skill) {
      throw new CareerNotFoundError('Skill not found');
    }

    const { data: row, error } = await this.client
      .from('career_target_skills')
      .insert({
        user_id: userId,
        target_id: targetId,
        skill_id: data.skill_id,
        importance: data.importance,
      })
      .select('*')
      .single();

    if (error || !row) {
      this.handleDbError(error, 'Failed to add skill to career target');
    }

    return {
      ...this.mapTargetSkillRow(row),
      skill_name: skill.name,
      skill_slug: skill.slug,
      skill_category: skill.category,
    };
  }

  async updateTargetSkill(
    userId: string,
    targetId: string,
    skillId: string,
    data: UpdateCareerTargetSkillInput
  ): Promise<CareerTargetSkillDto | null> {
    const { data: updated, error } = await this.client
      .from('career_target_skills')
      .update({ importance: data.importance })
      .eq('target_id', targetId)
      .eq('skill_id', skillId)
      .eq('user_id', userId)
      .select('*, skills(name, slug, category)')
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'Failed to update career target skill');
    }
    return updated ? this.mapTargetSkillRow(updated) : null;
  }

  async removeTargetSkill(userId: string, targetId: string, skillId: string): Promise<boolean> {
    const { error, count } = await this.client
      .from('career_target_skills')
      .delete({ count: 'exact' })
      .eq('target_id', targetId)
      .eq('skill_id', skillId)
      .eq('user_id', userId);

    if (error) {
      this.handleDbError(error, 'Failed to remove skill from career target');
    }
    return (count ?? 0) > 0;
  }

  async listTargetSkills(userId: string, targetId: string): Promise<CareerTargetSkillDto[]> {
    const { data, error } = await this.client
      .from('career_target_skills')
      .select('*, skills(name, slug, category)')
      .eq('target_id', targetId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      this.handleDbError(error, 'Failed to list career target skills');
    }

    return (data || []).map((row) => this.mapTargetSkillRow(row));
  }

  // ============================================================================
  // 3. Career Opportunity CRUD
  // ============================================================================

  async createOpportunity(userId: string, data: CreateCareerOpportunityInput): Promise<CareerOpportunityDto> {
    if (data.target_id) {
      const target = await this.getTargetById(userId, data.target_id);
      if (!target) {
        throw new CareerNotFoundError('Career target not found');
      }
    }

    const { data: created, error } = await this.client
      .from('career_opportunities')
      .insert({
        user_id: userId,
        target_id: data.target_id ?? null,
        company_name: data.company_name.trim(),
        role_title: data.role_title.trim(),
        employment_type: data.employment_type ?? null,
        location_type: data.location_type ?? null,
        location: data.location?.trim() ?? null,
        source: data.source ?? 'other',
        job_url: data.job_url?.trim() ?? null,
        salary_min: data.salary_min ?? null,
        salary_max: data.salary_max ?? null,
        salary_currency: data.salary_currency ? data.salary_currency.toUpperCase() : null,
        deadline: data.deadline ?? null,
        description: data.description ?? null,
        status: data.status ?? 'active',
      })
      .select('*')
      .single();

    if (error || !created) {
      this.handleDbError(error, 'Failed to create career opportunity');
    }

    return this.mapOpportunityRow(created);
  }

  async getOpportunityById(userId: string, opportunityId: string): Promise<CareerOpportunityDto | null> {
    const { data: row, error } = await this.client
      .from('career_opportunities')
      .select('*')
      .eq('id', opportunityId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !row) {
      return null;
    }
    return this.mapOpportunityRow(row);
  }

  async getOpportunityDetail(userId: string, opportunityId: string): Promise<CareerOpportunityDetailDto | null> {
    const opportunity = await this.getOpportunityById(userId, opportunityId);
    if (!opportunity) {
      return null;
    }

    let targetTitle: string | null = null;
    if (opportunity.target_id) {
      const target = await this.getTargetById(userId, opportunity.target_id);
      if (target) {
        targetTitle = target.title;
      }
    }

    const skills = await this.listOpportunitySkills(userId, opportunityId);

    const { data: appRow } = await this.client
      .from('career_applications')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('user_id', userId)
      .maybeSingle();

    const application = appRow ? this.mapApplicationRow(appRow) : null;

    return {
      ...opportunity,
      target_title: targetTitle,
      skills,
      application,
    };
  }

  async listOpportunities(
    userId: string,
    query?: CareerOpportunityQueryInput
  ): Promise<PaginatedList<CareerOpportunityDto>> {
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const sortBy = query?.sortBy ?? 'created_at';
    const sortOrder = query?.sortOrder ?? 'desc';

    let q = this.client
      .from('career_opportunities')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (query?.target_id) {
      q = q.eq('target_id', query.target_id);
    }
    if (query?.status) {
      q = q.eq('status', query.status);
    }
    if (query?.employment_type) {
      q = q.eq('employment_type', query.employment_type);
    }
    if (query?.location_type) {
      q = q.eq('location_type', query.location_type);
    }
    if (query?.source) {
      q = q.eq('source', query.source);
    }
    if (query?.search && query.search.trim()) {
      const term = query.search.trim();
      q = q.or(`company_name.ilike.%${term}%,role_title.ilike.%${term}%`);
    }

    q = q.order(sortBy, { ascending: sortOrder === 'asc' });

    const offset = (page - 1) * pageSize;
    q = q.range(offset, offset + pageSize - 1);

    const { data, count, error } = await q;
    if (error) {
      this.handleDbError(error, 'Failed to list career opportunities');
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: (data || []).map((row) => this.mapOpportunityRow(row)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async updateOpportunity(
    userId: string,
    opportunityId: string,
    data: UpdateCareerOpportunityInput
  ): Promise<CareerOpportunityDto | null> {
    const existing = await this.getOpportunityById(userId, opportunityId);
    if (!existing) {
      return null;
    }

    if (data.target_id) {
      const target = await this.getTargetById(userId, data.target_id);
      if (!target) {
        throw new CareerNotFoundError('Career target not found');
      }
    }

    const updatePayload: CareerOpportunityUpdate = {};
    if (data.company_name !== undefined) updatePayload.company_name = data.company_name.trim();
    if (data.role_title !== undefined) updatePayload.role_title = data.role_title.trim();
    if (data.target_id !== undefined) updatePayload.target_id = data.target_id;
    if (data.employment_type !== undefined) updatePayload.employment_type = data.employment_type;
    if (data.location_type !== undefined) updatePayload.location_type = data.location_type;
    if (data.location !== undefined) updatePayload.location = data.location?.trim() ?? null;
    if (data.source !== undefined) updatePayload.source = data.source;
    if (data.job_url !== undefined) updatePayload.job_url = data.job_url?.trim() ?? null;
    if (data.salary_min !== undefined) updatePayload.salary_min = data.salary_min;
    if (data.salary_max !== undefined) updatePayload.salary_max = data.salary_max;
    if (data.salary_currency !== undefined) updatePayload.salary_currency = data.salary_currency ? data.salary_currency.toUpperCase() : null;
    if (data.deadline !== undefined) updatePayload.deadline = data.deadline;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.status !== undefined) updatePayload.status = data.status;

    const { data: updated, error } = await this.client
      .from('career_opportunities')
      .update(updatePayload)
      .eq('id', opportunityId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'Failed to update career opportunity');
    }
    return updated ? this.mapOpportunityRow(updated) : null;
  }

  async deleteOpportunity(userId: string, opportunityId: string): Promise<boolean> {
    const { error, count } = await this.client
      .from('career_opportunities')
      .delete({ count: 'exact' })
      .eq('id', opportunityId)
      .eq('user_id', userId);

    if (error) {
      this.handleDbError(error, 'Failed to delete career opportunity');
    }
    return (count ?? 0) > 0;
  }

  // ============================================================================
  // 4. Career Opportunity Skills
  // ============================================================================

  async addOpportunitySkill(
    userId: string,
    opportunityId: string,
    data: AddCareerOpportunitySkillInput
  ): Promise<CareerOpportunitySkillDto> {
    const opportunity = await this.getOpportunityById(userId, opportunityId);
    if (!opportunity) {
      throw new CareerNotFoundError('Career opportunity not found');
    }

    const { data: skill } = await this.client
      .from('skills')
      .select('id, name, slug, category')
      .eq('id', data.skill_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!skill) {
      throw new CareerNotFoundError('Skill not found');
    }

    const { data: row, error } = await this.client
      .from('career_opportunity_skills')
      .insert({
        user_id: userId,
        opportunity_id: opportunityId,
        skill_id: data.skill_id,
        importance: data.importance,
      })
      .select('*')
      .single();

    if (error || !row) {
      this.handleDbError(error, 'Failed to add skill to career opportunity');
    }

    return {
      ...this.mapOpportunitySkillRow(row),
      skill_name: skill.name,
      skill_slug: skill.slug,
      skill_category: skill.category,
    };
  }

  async updateOpportunitySkill(
    userId: string,
    opportunityId: string,
    skillId: string,
    data: UpdateCareerOpportunitySkillInput
  ): Promise<CareerOpportunitySkillDto | null> {
    const { data: updated, error } = await this.client
      .from('career_opportunity_skills')
      .update({ importance: data.importance })
      .eq('opportunity_id', opportunityId)
      .eq('skill_id', skillId)
      .eq('user_id', userId)
      .select('*, skills(name, slug, category)')
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'Failed to update career opportunity skill');
    }
    return updated ? this.mapOpportunitySkillRow(updated) : null;
  }

  async removeOpportunitySkill(userId: string, opportunityId: string, skillId: string): Promise<boolean> {
    const { error, count } = await this.client
      .from('career_opportunity_skills')
      .delete({ count: 'exact' })
      .eq('opportunity_id', opportunityId)
      .eq('skill_id', skillId)
      .eq('user_id', userId);

    if (error) {
      this.handleDbError(error, 'Failed to remove skill from career opportunity');
    }
    return (count ?? 0) > 0;
  }

  async listOpportunitySkills(userId: string, opportunityId: string): Promise<CareerOpportunitySkillDto[]> {
    const { data, error } = await this.client
      .from('career_opportunity_skills')
      .select('*, skills(name, slug, category)')
      .eq('opportunity_id', opportunityId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      this.handleDbError(error, 'Failed to list career opportunity skills');
    }

    return (data || []).map((row) => this.mapOpportunitySkillRow(row));
  }

  // ============================================================================
  // 5. Career Application CRUD
  // ============================================================================

  async createApplication(userId: string, data: CreateCareerApplicationInput): Promise<CareerApplicationDto> {
    const opportunity = await this.getOpportunityById(userId, data.opportunity_id);
    if (!opportunity) {
      throw new CareerNotFoundError('Career opportunity not found');
    }

    const { data: existingApp } = await this.client
      .from('career_applications')
      .select('id')
      .eq('opportunity_id', data.opportunity_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingApp) {
      throw new CareerConflictError('An application already exists for this opportunity');
    }

    const { data: result, error } = await this.client.rpc('career_create_application', {
      p_user_id: userId,
      p_opportunity_id: data.opportunity_id,
      p_stage: data.stage ?? 'saved',
      p_applied_at: data.applied_at ?? null,
      p_deadline: data.deadline ?? null,
      p_resume_file_url: data.resume_file_url?.trim() ?? null,
      p_cover_letter_url: data.cover_letter_url?.trim() ?? null,
      p_notes: data.notes ?? null,
      p_rejection_reason: data.rejection_reason ?? null,
      p_history_notes: 'Initial application entry created',
    });

    if (error || !result) {
      this.handleDbError(error, 'Failed to create career application');
    }

    const payload = result as unknown as {
      application: CareerApplicationRow;
      history: CareerApplicationHistoryRow;
    };
    return this.mapApplicationRow(payload.application);
  }

  async getApplicationById(userId: string, applicationId: string): Promise<CareerApplicationDto | null> {
    const { data: row, error } = await this.client
      .from('career_applications')
      .select('*')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !row) {
      return null;
    }
    return this.mapApplicationRow(row);
  }

  async getApplicationDetail(userId: string, applicationId: string): Promise<CareerApplicationDetailDto | null> {
    const app = await this.getApplicationById(userId, applicationId);
    if (!app) {
      return null;
    }

    const opportunity = await this.getOpportunityById(userId, app.opportunity_id);
    const history = await this.listApplicationHistory(userId, applicationId);
    const projects = await this.listApplicationProjects(userId, applicationId);
    const interviewList = await this.listInterviews(userId, { application_id: applicationId, pageSize: 100 });

    return {
      ...app,
      opportunity: opportunity ?? undefined,
      history,
      projects,
      interviews: interviewList.data,
    };
  }

  async listApplications(
    userId: string,
    query?: CareerApplicationQueryInput
  ): Promise<PaginatedList<CareerApplicationDto>> {
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const sortBy = query?.sortBy ?? 'created_at';
    const sortOrder = query?.sortOrder ?? 'desc';

    let q = this.client
      .from('career_applications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (query?.stage) {
      q = q.eq('stage', query.stage);
    }
    if (query?.opportunity_id) {
      q = q.eq('opportunity_id', query.opportunity_id);
    }

    q = q.order(sortBy, { ascending: sortOrder === 'asc' });

    const offset = (page - 1) * pageSize;
    q = q.range(offset, offset + pageSize - 1);

    const { data, count, error } = await q;
    if (error) {
      this.handleDbError(error, 'Failed to list career applications');
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: (data || []).map((row) => this.mapApplicationRow(row)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async updateApplication(
    userId: string,
    applicationId: string,
    data: UpdateCareerApplicationInput
  ): Promise<CareerApplicationDto | null> {
    const existing = await this.getApplicationById(userId, applicationId);
    if (!existing) {
      return null;
    }

    const updatePayload: CareerApplicationUpdate = {};
    if (data.stage !== undefined) updatePayload.stage = data.stage;
    if (data.applied_at !== undefined) updatePayload.applied_at = data.applied_at;
    if (data.deadline !== undefined) updatePayload.deadline = data.deadline;
    if (data.resume_file_url !== undefined) updatePayload.resume_file_url = data.resume_file_url?.trim() ?? null;
    if (data.cover_letter_url !== undefined) updatePayload.cover_letter_url = data.cover_letter_url?.trim() ?? null;
    if (data.notes !== undefined) updatePayload.notes = data.notes;
    if (data.rejection_reason !== undefined) updatePayload.rejection_reason = data.rejection_reason;

    const { data: updated, error } = await this.client
      .from('career_applications')
      .update(updatePayload)
      .eq('id', applicationId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'Failed to update career application');
    }
    return updated ? this.mapApplicationRow(updated) : null;
  }

  async deleteApplication(userId: string, applicationId: string): Promise<boolean> {
    const { error, count } = await this.client
      .from('career_applications')
      .delete({ count: 'exact' })
      .eq('id', applicationId)
      .eq('user_id', userId);

    if (error) {
      this.handleDbError(error, 'Failed to delete career application');
    }
    return (count ?? 0) > 0;
  }

  // ============================================================================
  // 6. Career Application History (Immutable Audit Trail)
  // ============================================================================

  async recordApplicationHistory(
    userId: string,
    applicationId: string,
    data: CreateCareerApplicationHistoryInput
  ): Promise<CareerApplicationHistoryDto> {
    const app = await this.getApplicationById(userId, applicationId);
    if (!app) {
      throw new CareerNotFoundError('Career application not found');
    }

    const { data: row, error } = await this.client
      .from('career_application_history')
      .insert({
        user_id: userId,
        application_id: applicationId,
        from_stage: data.from_stage ?? null,
        to_stage: data.to_stage,
        changed_at: data.changed_at ?? new Date().toISOString(),
        notes: data.notes ?? null,
      })
      .select('*')
      .single();

    if (error || !row) {
      this.handleDbError(error, 'Failed to record application history');
    }

    return this.mapApplicationHistoryRow(row);
  }

  async listApplicationHistory(userId: string, applicationId: string): Promise<CareerApplicationHistoryDto[]> {
    const { data, error } = await this.client
      .from('career_application_history')
      .select('*')
      .eq('application_id', applicationId)
      .eq('user_id', userId)
      .order('changed_at', { ascending: false });

    if (error) {
      this.handleDbError(error, 'Failed to list application history');
    }

    return (data || []).map((row) => this.mapApplicationHistoryRow(row));
  }

  async updateApplicationStageWithHistory(
    userId: string,
    applicationId: string,
    newStage: CareerApplicationStage,
    notes?: string | null,
    expectedStage?: CareerApplicationStage | null
  ): Promise<{ application: CareerApplicationDto; history: CareerApplicationHistoryDto }> {
    const existing = await this.getApplicationById(userId, applicationId);
    if (!existing) {
      throw new CareerNotFoundError('Career application not found');
    }

    const { data: result, error } = await this.client.rpc('career_update_application_stage_with_history', {
      p_user_id: userId,
      p_application_id: applicationId,
      p_new_stage: newStage,
      p_notes: notes ?? null,
      p_expected_stage: expectedStage ?? null,
    });

    if (error || !result) {
      this.handleDbError(error, 'Failed to update application stage with history');
    }

    const payload = result as unknown as {
      application: CareerApplicationRow;
      history: CareerApplicationHistoryRow;
    };

    return {
      application: this.mapApplicationRow(payload.application),
      history: this.mapApplicationHistoryRow(payload.history),
    };
  }

  // ============================================================================
  // 7. Career Application Projects
  // ============================================================================

  async attachApplicationProject(
    userId: string,
    applicationId: string,
    data: AttachCareerApplicationProjectInput
  ): Promise<CareerApplicationProjectDto> {
    const app = await this.getApplicationById(userId, applicationId);
    if (!app) {
      throw new CareerNotFoundError('Career application not found');
    }

    const { data: project } = await this.client
      .from('projects')
      .select('id, title, slug, status')
      .eq('id', data.project_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!project) {
      throw new CareerNotFoundError('Project not found');
    }

    const { data: row, error } = await this.client
      .from('career_application_projects')
      .insert({
        user_id: userId,
        application_id: applicationId,
        project_id: data.project_id,
        is_featured: Boolean(data.is_featured),
        talking_points: data.talking_points ?? null,
      })
      .select('*')
      .single();

    if (error || !row) {
      this.handleDbError(error, 'Failed to attach project to career application');
    }

    return {
      ...this.mapApplicationProjectRow(row),
      project_title: project.title,
      project_slug: project.slug,
      project_status: project.status,
    };
  }

  async updateApplicationProject(
    userId: string,
    applicationId: string,
    projectId: string,
    data: UpdateCareerApplicationProjectInput
  ): Promise<CareerApplicationProjectDto | null> {
    const updatePayload: CareerApplicationProjectUpdate = {};
    if (data.is_featured !== undefined) updatePayload.is_featured = data.is_featured;
    if (data.talking_points !== undefined) updatePayload.talking_points = data.talking_points;

    const { data: updated, error } = await this.client
      .from('career_application_projects')
      .update(updatePayload)
      .eq('application_id', applicationId)
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .select('*, projects(title, slug, status)')
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'Failed to update career application project');
    }
    return updated ? this.mapApplicationProjectRow(updated) : null;
  }

  async removeApplicationProject(userId: string, applicationId: string, projectId: string): Promise<boolean> {
    const { error, count } = await this.client
      .from('career_application_projects')
      .delete({ count: 'exact' })
      .eq('application_id', applicationId)
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      this.handleDbError(error, 'Failed to remove project from career application');
    }
    return (count ?? 0) > 0;
  }

  async listApplicationProjects(userId: string, applicationId: string): Promise<CareerApplicationProjectDto[]> {
    const { data, error } = await this.client
      .from('career_application_projects')
      .select('*, projects(title, slug, status)')
      .eq('application_id', applicationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      this.handleDbError(error, 'Failed to list career application projects');
    }

    return (data || []).map((row) => this.mapApplicationProjectRow(row));
  }

  // ============================================================================
  // 8. Career Interview CRUD
  // ============================================================================

  async createInterview(
    userId: string,
    applicationId: string,
    data: CreateCareerInterviewInput
  ): Promise<CareerInterviewDto> {
    const app = await this.getApplicationById(userId, applicationId);
    if (!app) {
      throw new CareerNotFoundError('Career application not found');
    }

    const { data: created, error } = await this.client
      .from('career_interviews')
      .insert({
        user_id: userId,
        application_id: applicationId,
        round_number: data.round_number ?? 1,
        round_type: data.round_type ?? 'recruiter_screen',
        scheduled_at: data.scheduled_at ?? null,
        duration_minutes: data.duration_minutes ?? 45,
        meeting_link: data.meeting_link?.trim() ?? null,
        status: data.status ?? 'scheduled',
        result: data.result ?? 'pending',
        interviewer_names: data.interviewer_names || [],
        notes: data.notes ?? null,
      })
      .select('*')
      .single();

    if (error || !created) {
      this.handleDbError(error, 'Failed to create career interview');
    }

    return this.mapInterviewRow(created);
  }

  async getInterviewById(userId: string, interviewId: string): Promise<CareerInterviewDto | null> {
    const { data: row, error } = await this.client
      .from('career_interviews')
      .select('*')
      .eq('id', interviewId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !row) {
      return null;
    }
    return this.mapInterviewRow(row);
  }

  async listInterviews(
    userId: string,
    query?: CareerInterviewQueryInput
  ): Promise<PaginatedList<CareerInterviewDto>> {
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const sortBy = query?.sortBy ?? 'scheduled_at';
    const sortOrder = query?.sortOrder ?? 'asc';

    let q = this.client
      .from('career_interviews')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (query?.application_id) {
      q = q.eq('application_id', query.application_id);
    }
    if (query?.status) {
      q = q.eq('status', query.status);
    }
    if (query?.result) {
      q = q.eq('result', query.result);
    }
    if (query?.round_type) {
      q = q.eq('round_type', query.round_type);
    }
    if (query?.scheduled_after) {
      q = q.gte('scheduled_at', query.scheduled_after);
    }
    if (query?.scheduled_before) {
      q = q.lte('scheduled_at', query.scheduled_before);
    }

    q = q.order(sortBy, { ascending: sortOrder === 'asc' });

    const offset = (page - 1) * pageSize;
    q = q.range(offset, offset + pageSize - 1);

    const { data, count, error } = await q;
    if (error) {
      this.handleDbError(error, 'Failed to list career interviews');
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: (data || []).map((row) => this.mapInterviewRow(row)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async updateInterview(
    userId: string,
    interviewId: string,
    data: UpdateCareerInterviewInput
  ): Promise<CareerInterviewDto | null> {
    const existing = await this.getInterviewById(userId, interviewId);
    if (!existing) {
      return null;
    }

    const updatePayload: CareerInterviewUpdate = {};
    if (data.round_number !== undefined) updatePayload.round_number = data.round_number;
    if (data.round_type !== undefined) updatePayload.round_type = data.round_type;
    if (data.scheduled_at !== undefined) updatePayload.scheduled_at = data.scheduled_at;
    if (data.duration_minutes !== undefined) updatePayload.duration_minutes = data.duration_minutes;
    if (data.meeting_link !== undefined) updatePayload.meeting_link = data.meeting_link?.trim() ?? null;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.result !== undefined) updatePayload.result = data.result;
    if (data.interviewer_names !== undefined) updatePayload.interviewer_names = data.interviewer_names;
    if (data.notes !== undefined) updatePayload.notes = data.notes;

    const { data: updated, error } = await this.client
      .from('career_interviews')
      .update(updatePayload)
      .eq('id', interviewId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'Failed to update career interview');
    }
    return updated ? this.mapInterviewRow(updated) : null;
  }

  async deleteInterview(userId: string, interviewId: string): Promise<boolean> {
    const { error, count } = await this.client
      .from('career_interviews')
      .delete({ count: 'exact' })
      .eq('id', interviewId)
      .eq('user_id', userId);

    if (error) {
      this.handleDbError(error, 'Failed to delete career interview');
    }
    return (count ?? 0) > 0;
  }

  // ============================================================================
  // 9. Readiness & Preparation Integration
  // ============================================================================

  async getApplicationPreparation(
    userId: string,
    applicationId: string
  ): Promise<CareerApplicationPreparationDto | null> {
    const app = await this.getApplicationById(userId, applicationId);
    if (!app) return null;

    const opportunity = await this.getOpportunityById(userId, app.opportunity_id);
    if (!opportunity) return null;

    // 1. Target and Opportunity Skills
    const targetSkills = opportunity.target_id
      ? await this.listTargetSkills(userId, opportunity.target_id)
      : [];
    const oppSkills = await this.listOpportunitySkills(userId, app.opportunity_id);

    const importanceRank: Record<CareerSkillImportance, number> = {
      required: 3,
      preferred: 2,
      bonus: 1,
    };

    const mergedSkillsMap = new Map<
      string,
      {
        skill_id: string;
        skill_name: string;
        skill_slug: string;
        skill_category: string | null;
        importance: CareerSkillImportance;
        source: 'target' | 'opportunity' | 'both';
      }
    >();

    for (const ts of targetSkills) {
      mergedSkillsMap.set(ts.skill_id, {
        skill_id: ts.skill_id,
        skill_name: ts.skill_name || 'Unknown Skill',
        skill_slug: ts.skill_slug || '',
        skill_category: ts.skill_category ?? null,
        importance: ts.importance,
        source: 'target',
      });
    }

    for (const os of oppSkills) {
      const existing = mergedSkillsMap.get(os.skill_id);
      if (existing) {
        existing.source = 'both';
        if (importanceRank[os.importance] > importanceRank[existing.importance]) {
          existing.importance = os.importance;
        }
      } else {
        mergedSkillsMap.set(os.skill_id, {
          skill_id: os.skill_id,
          skill_name: os.skill_name || 'Unknown Skill',
          skill_slug: os.skill_slug || '',
          skill_category: os.skill_category ?? null,
          importance: os.importance,
          source: 'opportunity',
        });
      }
    }

    // 2. Query authoritative mastery directly from Skills domain table (read-only)
    const skillIds = Array.from(mergedSkillsMap.keys());
    const userSkillsMap = new Map<
      string,
      {
        level: string | null;
        mastery_score: number | null;
        confidence_score: number | null;
        status: string | null;
        is_verified: boolean | null;
      }
    >();

    if (skillIds.length > 0) {
      const { data: userSkills } = await this.client
        .from('skills')
        .select('id, level, mastery_score, confidence_score, status, verified')
        .in('id', skillIds)
        .eq('user_id', userId);

      if (userSkills) {
        for (const us of userSkills as unknown as Array<{
          id: string;
          level?: string | null;
          mastery_score?: number | null;
          confidence_score?: number | null;
          status?: string | null;
          verified?: boolean | null;
        }>) {
          userSkillsMap.set(us.id, {
            level: us.level ?? null,
            mastery_score: us.mastery_score ?? null,
            confidence_score: us.confidence_score ?? null,
            status: us.status ?? null,
            is_verified: us.verified ?? null,
          });
        }
      }
    }

    const readinessSkills: CareerSkillReadinessItem[] = Array.from(mergedSkillsMap.values()).map(
      (s) => {
        const mastery = userSkillsMap.get(s.skill_id);
        const isAcquired = Boolean(mastery && mastery.status && mastery.status !== 'untracked');
        return {
          skill_id: s.skill_id,
          skill_name: s.skill_name,
          skill_slug: s.skill_slug,
          skill_category: s.skill_category,
          importance: s.importance,
          source: s.source,
          current_level: mastery?.level ?? null,
          mastery_score: mastery?.mastery_score ?? null,
          confidence_score: mastery?.confidence_score ?? null,
          status: mastery?.status ?? null,
          is_verified: mastery?.is_verified ?? null,
          is_acquired: isAcquired,
        };
      }
    );

    const requiredSkills = readinessSkills.filter((s) => s.importance === 'required');
    const preferredSkills = readinessSkills.filter((s) => s.importance === 'preferred');
    const bonusSkills = readinessSkills.filter((s) => s.importance === 'bonus');

    const totalSkills = readinessSkills.length;
    const acquiredSkillsCount = readinessSkills.filter((s) => s.is_acquired).length;
    const requiredAcquiredCount = requiredSkills.filter((s) => s.is_acquired).length;

    // 3. Projects with Evidence
    const appProjects = await this.listApplicationProjects(userId, applicationId);
    const projectIds = appProjects.map((p) => p.project_id);

    const projectEvidenceMap = new Map<string, CareerProjectEvidenceItem[]>();
    for (const pId of projectIds) {
      projectEvidenceMap.set(pId, []);
    }

    if (projectIds.length > 0) {
      const { data: evidenceRows } = await this.client
        .from('evidence_links')
        .select(`
          entity_id,
          evidence:evidence!evidence_id (
            id,
            title,
            evidence_type,
            verification_status,
            occurred_at,
            external_url,
            user_id
          )
        `)
        .eq('entity_type', 'project')
        .in('entity_id', projectIds);

      if (evidenceRows) {
        for (const row of evidenceRows as unknown as Array<{
          entity_id: string;
          evidence: {
            id: string;
            title: string;
            evidence_type: string;
            verification_status: string;
            occurred_at: string;
            external_url: string | null;
            user_id: string;
          } | null;
        }>) {
          if (row.evidence && row.evidence.user_id === userId) {
            const list = projectEvidenceMap.get(row.entity_id) || [];
            list.push({
              id: row.evidence.id,
              title: row.evidence.title,
              evidence_type: row.evidence.evidence_type,
              verification_status: row.evidence.verification_status,
              occurred_at: row.evidence.occurred_at,
              external_url: row.evidence.external_url,
            });
            projectEvidenceMap.set(row.entity_id, list);
          }
        }
      }
    }

    const readinessProjects: CareerProjectReadinessItem[] = appProjects.map((ap) => ({
      project_id: ap.project_id,
      title: ap.project_title || 'Untitled Project',
      slug: ap.project_slug || '',
      status: ap.project_status || 'unknown',
      is_featured: ap.is_featured,
      talking_points: ap.talking_points,
      evidence: projectEvidenceMap.get(ap.project_id) || [],
    }));

    const featuredProjects = readinessProjects.filter((p) => p.is_featured);
    const supportingProjects = readinessProjects.filter((p) => !p.is_featured);

    // 4. Linked Tasks from Tasks module (authoritative task records)
    const { data: taskRows } = await this.client
      .from('tasks')
      .select('id, title, status, priority, due_at, scheduled_start, scheduled_end, completed_at')
      .eq('application_id', applicationId)
      .eq('user_id', userId);

    const taskItems: CareerTaskReadinessItem[] = (taskRows || []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_at: t.due_at,
      scheduled_start: t.scheduled_start,
      scheduled_end: t.scheduled_end,
      completed_at: t.completed_at,
      is_blocked: false,
    }));

    const openTasks = taskItems.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
    const completedTasks = taskItems.filter((t) => t.status === 'completed');

    // 5. Interviews
    const interviewsList = await this.listInterviews(userId, {
      application_id: applicationId,
      pageSize: 100,
    });

    return {
      application_id: app.id,
      company_name: opportunity.company_name,
      role_title: opportunity.role_title,
      current_stage: app.stage,
      target_id: opportunity.target_id,
      opportunity_id: app.opportunity_id,
      skills: {
        required: requiredSkills,
        preferred: preferredSkills,
        bonus: bonusSkills,
        summary: {
          total_skills: totalSkills,
          acquired_skills: acquiredSkillsCount,
          missing_skills: totalSkills - acquiredSkillsCount,
          required_total: requiredSkills.length,
          required_acquired: requiredAcquiredCount,
        },
      },
      projects: {
        featured: featuredProjects,
        supporting: supportingProjects,
      },
      tasks: {
        open: openTasks,
        completed: completedTasks,
        open_count: openTasks.length,
        completed_count: completedTasks.length,
      },
      interviews: interviewsList.data,
    };
  }
}

// ==============================================================================
// In-Memory Repository Implementation (for fast, isolated testing)
// ==============================================================================

export class InMemoryCareerRepository implements ICareerRepository {
  public targets: CareerTargetDto[] = [];
  public targetSkills: CareerTargetSkillDto[] = [];
  public opportunities: CareerOpportunityDto[] = [];
  public opportunitySkills: CareerOpportunitySkillDto[] = [];
  public applications: CareerApplicationDto[] = [];
  public applicationHistory: CareerApplicationHistoryDto[] = [];
  public applicationProjects: CareerApplicationProjectDto[] = [];
  public interviews: CareerInterviewDto[] = [];

  // External reference verification mocks
  public goals: Array<{ id: string; user_id: string; title: string }> = [];
  public skills: Array<{
    id: string;
    user_id: string;
    name: string;
    slug: string;
    category?: string | null;
    level?: string | null;
    mastery_score?: number | null;
    confidence_score?: number | null;
    status?: string | null;
    verified?: boolean | null;
  }> = [];
  public projects: Array<{ id: string; user_id: string; title: string; slug: string; status: string }> = [];
  public tasks: Array<{
    id: string;
    user_id: string;
    application_id?: string | null;
    title: string;
    status: string;
    priority: string;
    due_at?: string | null;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
    completed_at?: string | null;
    is_blocked?: boolean;
  }> = [];
  public evidence: Array<{
    id: string;
    user_id: string;
    title: string;
    evidence_type: string;
    verification_status: string;
    occurred_at: string;
    external_url?: string | null;
  }> = [];
  public evidenceLinks: Array<{
    evidence_id: string;
    entity_type: string;
    entity_id: string;
  }> = [];

  deleteGoal(goalId: string): boolean {
    const idx = this.goals.findIndex((g) => g.id === goalId);
    if (idx === -1) return false;
    this.goals.splice(idx, 1);
    for (const t of this.targets) {
      if (t.goal_id === goalId) {
        t.goal_id = null;
      }
    }
    return true;
  }

  deleteProject(projectId: string): boolean {
    const isReferenced = this.applicationProjects.some((ap) => ap.project_id === projectId);
    if (isReferenced) {
      throw new CareerConflictError('Cannot delete project referenced by career applications (ON DELETE RESTRICT)');
    }
    const idx = this.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) return false;
    this.projects.splice(idx, 1);
    return true;
  }

  private generateId(): string {
    return '00000000-0000-4000-8000-' + Math.random().toString(16).substring(2, 14).padStart(12, '0');
  }

  // --- Target CRUD ---
  async createTarget(userId: string, data: CreateCareerTargetInput): Promise<CareerTargetDto> {
    const snapshot = this.targets.map((t) => ({ ...t }));
    try {
      if (data.goal_id) {
        const goal = this.goals.find((g) => g.id === data.goal_id && g.user_id === userId);
        if (!goal) {
          throw new CareerNotFoundError('Referenced goal does not exist or belongs to another user');
        }
      }

      if (data.is_primary) {
        for (const t of this.targets) {
          if (t.user_id === userId) {
            t.is_primary = false;
          }
        }
      }

      const now = new Date().toISOString();
      const newTarget: CareerTargetDto = {
        id: this.generateId(),
        user_id: userId,
        goal_id: data.goal_id ?? null,
        title: data.title.trim(),
        target_role: data.target_role.trim(),
        target_locations: data.target_locations || [],
        employment_type: data.employment_type ?? null,
        target_date: data.target_date ?? null,
        min_compensation: data.min_compensation ?? null,
        currency: data.currency ? data.currency.toUpperCase() : null,
        is_primary: Boolean(data.is_primary),
        notes: data.notes ?? null,
        created_at: now,
        updated_at: now,
      };

      this.targets.push(newTarget);
      return { ...newTarget };
    } catch (err) {
      this.targets = snapshot;
      throw err;
    }
  }

  async getTargetById(userId: string, targetId: string): Promise<CareerTargetDto | null> {
    const found = this.targets.find((t) => t.id === targetId && t.user_id === userId);
    return found ? { ...found } : null;
  }

  async getTargetDetail(userId: string, targetId: string): Promise<CareerTargetDetailDto | null> {
    const target = await this.getTargetById(userId, targetId);
    if (!target) return null;

    const goal = target.goal_id ? this.goals.find((g) => g.id === target.goal_id && g.user_id === userId) : null;
    const skills = await this.listTargetSkills(userId, targetId);
    const oppCount = this.opportunities.filter((o) => o.target_id === targetId && o.user_id === userId).length;

    return {
      ...target,
      goal_title: goal?.title ?? null,
      skills,
      opportunity_count: oppCount,
    };
  }

  async listTargets(userId: string, query?: CareerTargetQueryInput): Promise<PaginatedList<CareerTargetDto>> {
    let filtered = this.targets.filter((t) => t.user_id === userId);

    if (query?.is_primary !== undefined) {
      filtered = filtered.filter((t) => t.is_primary === query.is_primary);
    }
    if (query?.employment_type) {
      filtered = filtered.filter((t) => t.employment_type === query.employment_type);
    }
    if (query?.search && query.search.trim()) {
      const term = query.search.trim().toLowerCase();
      filtered = filtered.filter((t) => t.title.toLowerCase().includes(term) || t.target_role.toLowerCase().includes(term));
    }

    const total = filtered.length;
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const data = filtered.slice(offset, offset + pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  async updateTarget(userId: string, targetId: string, data: UpdateCareerTargetInput): Promise<CareerTargetDto | null> {
    const existing = this.targets.find((t) => t.id === targetId && t.user_id === userId);
    if (!existing) return null;

    const snapshot = this.targets.map((t) => ({ ...t }));
    try {
      if (data.goal_id) {
        const goal = this.goals.find((g) => g.id === data.goal_id && g.user_id === userId);
        if (!goal) {
          throw new CareerNotFoundError('Referenced goal does not exist or belongs to another user');
        }
      }

      if (data.is_primary === true) {
        for (const t of this.targets) {
          if (t.user_id === userId && t.id !== targetId) {
            t.is_primary = false;
          }
        }
      }

      const targetToUpdate = this.targets.find((t) => t.id === targetId && t.user_id === userId)!;
      if (data.title !== undefined) targetToUpdate.title = data.title.trim();
      if (data.target_role !== undefined) targetToUpdate.target_role = data.target_role.trim();
      if (data.target_locations !== undefined) targetToUpdate.target_locations = data.target_locations;
      if (data.employment_type !== undefined) targetToUpdate.employment_type = data.employment_type;
      if (data.target_date !== undefined) targetToUpdate.target_date = data.target_date;
      if (data.min_compensation !== undefined) targetToUpdate.min_compensation = data.min_compensation;
      if (data.currency !== undefined) targetToUpdate.currency = data.currency ? data.currency.toUpperCase() : null;
      if (data.is_primary !== undefined) targetToUpdate.is_primary = data.is_primary;
      if (data.notes !== undefined) targetToUpdate.notes = data.notes;
      if (data.goal_id !== undefined) targetToUpdate.goal_id = data.goal_id;
      targetToUpdate.updated_at = new Date().toISOString();

      return { ...targetToUpdate };
    } catch (err) {
      this.targets = snapshot;
      throw err;
    }
  }

  async deleteTarget(userId: string, targetId: string): Promise<boolean> {
    const idx = this.targets.findIndex((t) => t.id === targetId && t.user_id === userId);
    if (idx === -1) return false;
    this.targets.splice(idx, 1);
    this.targetSkills = this.targetSkills.filter((ts) => ts.target_id !== targetId);
    return true;
  }

  async setPrimaryTarget(userId: string, targetId: string): Promise<CareerTargetDto | null> {
    const target = this.targets.find((t) => t.id === targetId && t.user_id === userId);
    if (!target) return null;

    const snapshot = this.targets.map((t) => ({ ...t }));
    try {
      for (const t of this.targets) {
        if (t.user_id === userId) {
          t.is_primary = t.id === targetId;
        }
      }
      target.updated_at = new Date().toISOString();
      return { ...target };
    } catch (err) {
      this.targets = snapshot;
      throw err;
    }
  }

  // --- Target Skills ---
  async addTargetSkill(userId: string, targetId: string, data: AddCareerTargetSkillInput): Promise<CareerTargetSkillDto> {
    const target = await this.getTargetById(userId, targetId);
    if (!target) throw new CareerNotFoundError('Career target not found');

    const skill = this.skills.find((s) => s.id === data.skill_id && s.user_id === userId);
    if (!skill) throw new CareerNotFoundError('Skill not found');

    const existing = this.targetSkills.find((ts) => ts.target_id === targetId && ts.skill_id === data.skill_id && ts.user_id === userId);
    if (existing) throw new CareerConflictError('Skill is already attached to this career target');

    const item: CareerTargetSkillDto = {
      id: this.generateId(),
      user_id: userId,
      target_id: targetId,
      skill_id: data.skill_id,
      importance: data.importance ?? 'required',
      created_at: new Date().toISOString(),
      skill_name: skill.name,
      skill_slug: skill.slug,
      skill_category: skill.category,
    };
    this.targetSkills.push(item);
    return { ...item };
  }

  async updateTargetSkill(userId: string, targetId: string, skillId: string, data: UpdateCareerTargetSkillInput): Promise<CareerTargetSkillDto | null> {
    const skill = this.targetSkills.find((ts) => ts.target_id === targetId && ts.skill_id === skillId && ts.user_id === userId);
    if (!skill) return null;
    skill.importance = data.importance;
    return { ...skill };
  }

  async removeTargetSkill(userId: string, targetId: string, skillId: string): Promise<boolean> {
    const idx = this.targetSkills.findIndex((ts) => ts.target_id === targetId && ts.skill_id === skillId && ts.user_id === userId);
    if (idx === -1) return false;
    this.targetSkills.splice(idx, 1);
    return true;
  }

  async listTargetSkills(userId: string, targetId: string): Promise<CareerTargetSkillDto[]> {
    return this.targetSkills
      .filter((ts) => ts.target_id === targetId && ts.user_id === userId)
      .map((ts) => ({ ...ts }));
  }

  // --- Opportunity CRUD ---
  async createOpportunity(userId: string, data: CreateCareerOpportunityInput): Promise<CareerOpportunityDto> {
    if (data.target_id) {
      const target = await this.getTargetById(userId, data.target_id);
      if (!target) throw new CareerNotFoundError('Career target not found');
    }

    const now = new Date().toISOString();
    const item: CareerOpportunityDto = {
      id: this.generateId(),
      user_id: userId,
      target_id: data.target_id ?? null,
      company_name: data.company_name.trim(),
      role_title: data.role_title.trim(),
      employment_type: data.employment_type ?? null,
      location_type: data.location_type ?? null,
      location: data.location?.trim() ?? null,
      source: data.source ?? 'other',
      job_url: data.job_url?.trim() ?? null,
      salary_min: data.salary_min ?? null,
      salary_max: data.salary_max ?? null,
      salary_currency: data.salary_currency ? data.salary_currency.toUpperCase() : null,
      deadline: data.deadline ?? null,
      description: data.description ?? null,
      status: data.status ?? 'active',
      created_at: now,
      updated_at: now,
    };
    this.opportunities.push(item);
    return { ...item };
  }

  async getOpportunityById(userId: string, opportunityId: string): Promise<CareerOpportunityDto | null> {
    const found = this.opportunities.find((o) => o.id === opportunityId && o.user_id === userId);
    return found ? { ...found } : null;
  }

  async getOpportunityDetail(userId: string, opportunityId: string): Promise<CareerOpportunityDetailDto | null> {
    const opp = await this.getOpportunityById(userId, opportunityId);
    if (!opp) return null;

    const target = opp.target_id ? await this.getTargetById(userId, opp.target_id) : null;
    const skills = await this.listOpportunitySkills(userId, opportunityId);
    const app = this.applications.find((a) => a.opportunity_id === opportunityId && a.user_id === userId);

    return {
      ...opp,
      target_title: target?.title ?? null,
      skills,
      application: app ? { ...app } : null,
    };
  }

  async listOpportunities(userId: string, query?: CareerOpportunityQueryInput): Promise<PaginatedList<CareerOpportunityDto>> {
    let filtered = this.opportunities.filter((o) => o.user_id === userId);

    if (query?.target_id) filtered = filtered.filter((o) => o.target_id === query.target_id);
    if (query?.status) filtered = filtered.filter((o) => o.status === query.status);
    if (query?.employment_type) filtered = filtered.filter((o) => o.employment_type === query.employment_type);
    if (query?.location_type) filtered = filtered.filter((o) => o.location_type === query.location_type);
    if (query?.source) filtered = filtered.filter((o) => o.source === query.source);
    if (query?.search && query.search.trim()) {
      const term = query.search.trim().toLowerCase();
      filtered = filtered.filter((o) => o.company_name.toLowerCase().includes(term) || o.role_title.toLowerCase().includes(term));
    }

    const total = filtered.length;
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const data = filtered.slice(offset, offset + pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  async updateOpportunity(userId: string, opportunityId: string, data: UpdateCareerOpportunityInput): Promise<CareerOpportunityDto | null> {
    const existing = this.opportunities.find((o) => o.id === opportunityId && o.user_id === userId);
    if (!existing) return null;

    if (data.target_id) {
      const target = await this.getTargetById(userId, data.target_id);
      if (!target) throw new CareerNotFoundError('Career target not found');
    }

    if (data.company_name !== undefined) existing.company_name = data.company_name.trim();
    if (data.role_title !== undefined) existing.role_title = data.role_title.trim();
    if (data.target_id !== undefined) existing.target_id = data.target_id;
    if (data.employment_type !== undefined) existing.employment_type = data.employment_type;
    if (data.location_type !== undefined) existing.location_type = data.location_type;
    if (data.location !== undefined) existing.location = data.location?.trim() ?? null;
    if (data.source !== undefined) existing.source = data.source;
    if (data.job_url !== undefined) existing.job_url = data.job_url?.trim() ?? null;
    if (data.salary_min !== undefined) existing.salary_min = data.salary_min;
    if (data.salary_max !== undefined) existing.salary_max = data.salary_max;
    if (data.salary_currency !== undefined) existing.salary_currency = data.salary_currency ? data.salary_currency.toUpperCase() : null;
    if (data.deadline !== undefined) existing.deadline = data.deadline;
    if (data.description !== undefined) existing.description = data.description;
    if (data.status !== undefined) existing.status = data.status;
    existing.updated_at = new Date().toISOString();

    return { ...existing };
  }

  async deleteOpportunity(userId: string, opportunityId: string): Promise<boolean> {
    const idx = this.opportunities.findIndex((o) => o.id === opportunityId && o.user_id === userId);
    if (idx === -1) return false;
    this.opportunities.splice(idx, 1);
    this.opportunitySkills = this.opportunitySkills.filter((os) => os.opportunity_id !== opportunityId);
    return true;
  }

  // --- Opportunity Skills ---
  async addOpportunitySkill(userId: string, opportunityId: string, data: AddCareerOpportunitySkillInput): Promise<CareerOpportunitySkillDto> {
    const opp = await this.getOpportunityById(userId, opportunityId);
    if (!opp) throw new CareerNotFoundError('Career opportunity not found');

    const skill = this.skills.find((s) => s.id === data.skill_id && s.user_id === userId);
    if (!skill) throw new CareerNotFoundError('Skill not found');

    const existing = this.opportunitySkills.find((os) => os.opportunity_id === opportunityId && os.skill_id === data.skill_id && os.user_id === userId);
    if (existing) throw new CareerConflictError('Skill is already attached to this career opportunity');

    const item: CareerOpportunitySkillDto = {
      id: this.generateId(),
      user_id: userId,
      opportunity_id: opportunityId,
      skill_id: data.skill_id,
      importance: data.importance ?? 'required',
      created_at: new Date().toISOString(),
      skill_name: skill.name,
      skill_slug: skill.slug,
      skill_category: skill.category,
    };
    this.opportunitySkills.push(item);
    return { ...item };
  }

  async updateOpportunitySkill(userId: string, opportunityId: string, skillId: string, data: UpdateCareerOpportunitySkillInput): Promise<CareerOpportunitySkillDto | null> {
    const skill = this.opportunitySkills.find((os) => os.opportunity_id === opportunityId && os.skill_id === skillId && os.user_id === userId);
    if (!skill) return null;
    skill.importance = data.importance;
    return { ...skill };
  }

  async removeOpportunitySkill(userId: string, opportunityId: string, skillId: string): Promise<boolean> {
    const idx = this.opportunitySkills.findIndex((os) => os.opportunity_id === opportunityId && os.skill_id === skillId && os.user_id === userId);
    if (idx === -1) return false;
    this.opportunitySkills.splice(idx, 1);
    return true;
  }

  async listOpportunitySkills(userId: string, opportunityId: string): Promise<CareerOpportunitySkillDto[]> {
    return this.opportunitySkills
      .filter((os) => os.opportunity_id === opportunityId && os.user_id === userId)
      .map((os) => ({ ...os }));
  }

  // --- Application CRUD ---
  async createApplication(userId: string, data: CreateCareerApplicationInput): Promise<CareerApplicationDto> {
    const opp = await this.getOpportunityById(userId, data.opportunity_id);
    if (!opp) throw new CareerNotFoundError('Career opportunity not found');

    const existing = this.applications.find((a) => a.opportunity_id === data.opportunity_id && a.user_id === userId);
    if (existing) throw new CareerConflictError('An application already exists for this opportunity');

    const appsSnapshot = this.applications.map((a) => ({ ...a }));
    const histSnapshot = this.applicationHistory.map((h) => ({ ...h }));

    try {
      const now = new Date().toISOString();
      const stage = data.stage ?? 'saved';
      const app: CareerApplicationDto = {
        id: this.generateId(),
        user_id: userId,
        opportunity_id: data.opportunity_id,
        stage,
        applied_at: data.applied_at ?? null,
        deadline: data.deadline ?? null,
        resume_file_url: data.resume_file_url?.trim() ?? null,
        cover_letter_url: data.cover_letter_url?.trim() ?? null,
        notes: data.notes ?? null,
        rejection_reason: data.rejection_reason ?? null,
        created_at: now,
        updated_at: now,
      };
      this.applications.push(app);

      this.applicationHistory.push({
        id: this.generateId(),
        user_id: userId,
        application_id: app.id,
        from_stage: null,
        to_stage: stage,
        changed_at: now,
        notes: 'Initial application entry created',
      });

      return { ...app };
    } catch (err) {
      this.applications = appsSnapshot;
      this.applicationHistory = histSnapshot;
      throw err;
    }
  }

  async getApplicationById(userId: string, applicationId: string): Promise<CareerApplicationDto | null> {
    const found = this.applications.find((a) => a.id === applicationId && a.user_id === userId);
    return found ? { ...found } : null;
  }

  async getApplicationDetail(userId: string, applicationId: string): Promise<CareerApplicationDetailDto | null> {
    const app = await this.getApplicationById(userId, applicationId);
    if (!app) return null;

    const opp = await this.getOpportunityById(userId, app.opportunity_id);
    const history = await this.listApplicationHistory(userId, applicationId);
    const projects = await this.listApplicationProjects(userId, applicationId);
    const interviewList = await this.listInterviews(userId, {
      application_id: applicationId,
      page: 1,
      pageSize: 100,
    });

    return {
      ...app,
      opportunity: opp ?? undefined,
      history,
      projects,
      interviews: interviewList.data,
    };
  }

  async listApplications(userId: string, query?: CareerApplicationQueryInput): Promise<PaginatedList<CareerApplicationDto>> {
    let filtered = this.applications.filter((a) => a.user_id === userId);

    if (query?.stage) filtered = filtered.filter((a) => a.stage === query.stage);
    if (query?.opportunity_id) filtered = filtered.filter((a) => a.opportunity_id === query.opportunity_id);

    const total = filtered.length;
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const data = filtered.slice(offset, offset + pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  async updateApplication(userId: string, applicationId: string, data: UpdateCareerApplicationInput): Promise<CareerApplicationDto | null> {
    const existing = this.applications.find((a) => a.id === applicationId && a.user_id === userId);
    if (!existing) return null;

    if (data.stage !== undefined) existing.stage = data.stage;
    if (data.applied_at !== undefined) existing.applied_at = data.applied_at;
    if (data.deadline !== undefined) existing.deadline = data.deadline;
    if (data.resume_file_url !== undefined) existing.resume_file_url = data.resume_file_url?.trim() ?? null;
    if (data.cover_letter_url !== undefined) existing.cover_letter_url = data.cover_letter_url?.trim() ?? null;
    if (data.notes !== undefined) existing.notes = data.notes;
    if (data.rejection_reason !== undefined) existing.rejection_reason = data.rejection_reason;
    existing.updated_at = new Date().toISOString();

    return { ...existing };
  }

  async deleteApplication(userId: string, applicationId: string): Promise<boolean> {
    const idx = this.applications.findIndex((a) => a.id === applicationId && a.user_id === userId);
    if (idx === -1) return false;
    this.applications.splice(idx, 1);
    this.applicationHistory = this.applicationHistory.filter((ah) => ah.application_id !== applicationId);
    this.applicationProjects = this.applicationProjects.filter((ap) => ap.application_id !== applicationId);
    this.interviews = this.interviews.filter((i) => i.application_id !== applicationId);
    // ON DELETE SET NULL on tasks
    for (const t of this.tasks) {
      if (t.application_id === applicationId) {
        t.application_id = null;
      }
    }
    return true;
  }

  // --- Application History ---
  async recordApplicationHistory(userId: string, applicationId: string, data: CreateCareerApplicationHistoryInput): Promise<CareerApplicationHistoryDto> {
    const app = await this.getApplicationById(userId, applicationId);
    if (!app) throw new CareerNotFoundError('Career application not found');

    const item: CareerApplicationHistoryDto = {
      id: this.generateId(),
      user_id: userId,
      application_id: applicationId,
      from_stage: data.from_stage ?? null,
      to_stage: data.to_stage,
      changed_at: data.changed_at ?? new Date().toISOString(),
      notes: data.notes ?? null,
    };
    this.applicationHistory.push(item);
    return { ...item };
  }

  async listApplicationHistory(userId: string, applicationId: string): Promise<CareerApplicationHistoryDto[]> {
    const list = this.applicationHistory.filter((ah) => ah.application_id === applicationId && ah.user_id === userId);
    return list
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const timeDiff = new Date(b.item.changed_at).getTime() - new Date(a.item.changed_at).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.index - a.index;
      })
      .map(({ item }) => ({ ...item }));
  }

  async updateApplicationStageWithHistory(
    userId: string,
    applicationId: string,
    newStage: CareerApplicationStage,
    notes?: string | null,
    expectedStage?: CareerApplicationStage | null
  ): Promise<{ application: CareerApplicationDto; history: CareerApplicationHistoryDto }> {
    const app = this.applications.find((a) => a.id === applicationId && a.user_id === userId);
    if (!app) throw new CareerNotFoundError('Career application not found');

    if (expectedStage && app.stage !== expectedStage) {
      throw new CareerConflictError(
        `Application stage conflict: current stage is ${app.stage}, expected ${expectedStage}`
      );
    }

    if (['accepted', 'declined', 'rejected', 'withdrawn', 'closed'].includes(app.stage)) {
      throw new CareerConflictError(
        `Cannot transition application from terminal stage ${app.stage}`
      );
    }

    const appsSnapshot = this.applications.map((a) => ({ ...a }));
    const histSnapshot = this.applicationHistory.map((h) => ({ ...h }));

    try {
      const fromStage = app.stage;
      const now = new Date().toISOString();

      app.stage = newStage;
      app.updated_at = now;
      if (newStage === 'applied' && !app.applied_at) {
        app.applied_at = now;
      }

      const history: CareerApplicationHistoryDto = {
        id: this.generateId(),
        user_id: userId,
        application_id: applicationId,
        from_stage: fromStage,
        to_stage: newStage,
        changed_at: now,
        notes: notes ?? null,
      };
      this.applicationHistory.push(history);

      return {
        application: { ...app },
        history: { ...history },
      };
    } catch (err) {
      this.applications = appsSnapshot;
      this.applicationHistory = histSnapshot;
      throw err;
    }
  }

  // --- Application Projects ---
  async attachApplicationProject(userId: string, applicationId: string, data: AttachCareerApplicationProjectInput): Promise<CareerApplicationProjectDto> {
    const app = await this.getApplicationById(userId, applicationId);
    if (!app) throw new CareerNotFoundError('Career application not found');

    const project = this.projects.find((p) => p.id === data.project_id && p.user_id === userId);
    if (!project) throw new CareerNotFoundError('Project not found');

    const existing = this.applicationProjects.find((ap) => ap.application_id === applicationId && ap.project_id === data.project_id && ap.user_id === userId);
    if (existing) throw new CareerConflictError('Project is already attached to this career application');

    const item: CareerApplicationProjectDto = {
      id: this.generateId(),
      user_id: userId,
      application_id: applicationId,
      project_id: data.project_id,
      is_featured: Boolean(data.is_featured),
      talking_points: data.talking_points ?? null,
      created_at: new Date().toISOString(),
      project_title: project.title,
      project_slug: project.slug,
      project_status: project.status,
    };
    this.applicationProjects.push(item);
    return { ...item };
  }

  async updateApplicationProject(userId: string, applicationId: string, projectId: string, data: UpdateCareerApplicationProjectInput): Promise<CareerApplicationProjectDto | null> {
    const ap = this.applicationProjects.find((p) => p.application_id === applicationId && p.project_id === projectId && p.user_id === userId);
    if (!ap) return null;

    if (data.is_featured !== undefined) ap.is_featured = data.is_featured;
    if (data.talking_points !== undefined) ap.talking_points = data.talking_points;

    return { ...ap };
  }

  async removeApplicationProject(userId: string, applicationId: string, projectId: string): Promise<boolean> {
    const idx = this.applicationProjects.findIndex((ap) => ap.application_id === applicationId && ap.project_id === projectId && ap.user_id === userId);
    if (idx === -1) return false;
    this.applicationProjects.splice(idx, 1);
    return true;
  }

  async listApplicationProjects(userId: string, applicationId: string): Promise<CareerApplicationProjectDto[]> {
    return this.applicationProjects
      .filter((ap) => ap.application_id === applicationId && ap.user_id === userId)
      .map((ap) => ({ ...ap }));
  }

  // --- Interview CRUD ---
  async createInterview(userId: string, applicationId: string, data: CreateCareerInterviewInput): Promise<CareerInterviewDto> {
    const app = await this.getApplicationById(userId, applicationId);
    if (!app) throw new CareerNotFoundError('Career application not found');

    const now = new Date().toISOString();
    const item: CareerInterviewDto = {
      id: this.generateId(),
      user_id: userId,
      application_id: applicationId,
      round_number: data.round_number ?? 1,
      round_type: data.round_type ?? 'recruiter_screen',
      scheduled_at: data.scheduled_at ?? null,
      duration_minutes: data.duration_minutes ?? 45,
      meeting_link: data.meeting_link?.trim() ?? null,
      status: data.status ?? 'scheduled',
      result: data.result ?? 'pending',
      interviewer_names: data.interviewer_names || [],
      notes: data.notes ?? null,
      created_at: now,
      updated_at: now,
    };
    this.interviews.push(item);
    return { ...item };
  }

  async getInterviewById(userId: string, interviewId: string): Promise<CareerInterviewDto | null> {
    const found = this.interviews.find((i) => i.id === interviewId && i.user_id === userId);
    return found ? { ...found } : null;
  }

  async listInterviews(userId: string, query?: CareerInterviewQueryInput): Promise<PaginatedList<CareerInterviewDto>> {
    let filtered = this.interviews.filter((i) => i.user_id === userId);

    if (query?.application_id) filtered = filtered.filter((i) => i.application_id === query.application_id);
    if (query?.status) filtered = filtered.filter((i) => i.status === query.status);
    if (query?.result) filtered = filtered.filter((i) => i.result === query.result);
    if (query?.round_type) filtered = filtered.filter((i) => i.round_type === query.round_type);
    if (query?.scheduled_after) filtered = filtered.filter((i) => i.scheduled_at != null && i.scheduled_at >= query.scheduled_after!);
    if (query?.scheduled_before) filtered = filtered.filter((i) => i.scheduled_at != null && i.scheduled_at <= query.scheduled_before!);

    const total = filtered.length;
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const data = filtered.slice(offset, offset + pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  async updateInterview(userId: string, interviewId: string, data: UpdateCareerInterviewInput): Promise<CareerInterviewDto | null> {
    const existing = this.interviews.find((i) => i.id === interviewId && i.user_id === userId);
    if (!existing) return null;

    if (data.round_number !== undefined) existing.round_number = data.round_number;
    if (data.round_type !== undefined) existing.round_type = data.round_type;
    if (data.scheduled_at !== undefined) existing.scheduled_at = data.scheduled_at;
    if (data.duration_minutes !== undefined) existing.duration_minutes = data.duration_minutes;
    if (data.meeting_link !== undefined) existing.meeting_link = data.meeting_link?.trim() ?? null;
    if (data.status !== undefined) existing.status = data.status;
    if (data.result !== undefined) existing.result = data.result;
    if (data.interviewer_names !== undefined) existing.interviewer_names = data.interviewer_names;
    if (data.notes !== undefined) existing.notes = data.notes;
    existing.updated_at = new Date().toISOString();

    return { ...existing };
  }


  async deleteInterview(userId: string, interviewId: string): Promise<boolean> {
    const idx = this.interviews.findIndex((i) => i.id === interviewId && i.user_id === userId);
    if (idx === -1) return false;
    this.interviews.splice(idx, 1);
    return true;
  }

  // --- Readiness & Preparation Integration ---
  async getApplicationPreparation(
    userId: string,
    applicationId: string
  ): Promise<CareerApplicationPreparationDto | null> {
    const app = await this.getApplicationById(userId, applicationId);
    if (!app) return null;

    const opportunity = await this.getOpportunityById(userId, app.opportunity_id);
    if (!opportunity) return null;

    const targetSkills = opportunity.target_id
      ? await this.listTargetSkills(userId, opportunity.target_id)
      : [];
    const oppSkills = await this.listOpportunitySkills(userId, app.opportunity_id);

    const importanceRank: Record<CareerSkillImportance, number> = {
      required: 3,
      preferred: 2,
      bonus: 1,
    };

    const mergedSkillsMap = new Map<
      string,
      {
        skill_id: string;
        skill_name: string;
        skill_slug: string;
        skill_category: string | null;
        importance: CareerSkillImportance;
        source: 'target' | 'opportunity' | 'both';
      }
    >();

    for (const ts of targetSkills) {
      mergedSkillsMap.set(ts.skill_id, {
        skill_id: ts.skill_id,
        skill_name: ts.skill_name || 'Unknown Skill',
        skill_slug: ts.skill_slug || '',
        skill_category: ts.skill_category ?? null,
        importance: ts.importance,
        source: 'target',
      });
    }

    for (const os of oppSkills) {
      const existing = mergedSkillsMap.get(os.skill_id);
      if (existing) {
        existing.source = 'both';
        if (importanceRank[os.importance] > importanceRank[existing.importance]) {
          existing.importance = os.importance;
        }
      } else {
        mergedSkillsMap.set(os.skill_id, {
          skill_id: os.skill_id,
          skill_name: os.skill_name || 'Unknown Skill',
          skill_slug: os.skill_slug || '',
          skill_category: os.skill_category ?? null,
          importance: os.importance,
          source: 'opportunity',
        });
      }
    }

    const readinessSkills: CareerSkillReadinessItem[] = Array.from(mergedSkillsMap.values()).map(
      (s) => {
        const userSkill = this.skills.find((usk) => usk.id === s.skill_id && usk.user_id === userId);
        const isAcquired = Boolean(userSkill && userSkill.status && userSkill.status !== 'untracked');
        return {
          skill_id: s.skill_id,
          skill_name: s.skill_name,
          skill_slug: s.skill_slug,
          skill_category: s.skill_category,
          importance: s.importance,
          source: s.source,
          current_level: userSkill?.level ?? null,
          mastery_score: userSkill?.mastery_score ?? null,
          confidence_score: userSkill?.confidence_score ?? null,
          status: userSkill?.status ?? null,
          is_verified: userSkill?.verified ?? null,
          is_acquired: isAcquired,
        };
      }
    );

    const requiredSkills = readinessSkills.filter((s) => s.importance === 'required');
    const preferredSkills = readinessSkills.filter((s) => s.importance === 'preferred');
    const bonusSkills = readinessSkills.filter((s) => s.importance === 'bonus');

    const totalSkills = readinessSkills.length;
    const acquiredSkillsCount = readinessSkills.filter((s) => s.is_acquired).length;
    const requiredAcquiredCount = requiredSkills.filter((s) => s.is_acquired).length;

    // Projects with Evidence
    const appProjects = await this.listApplicationProjects(userId, applicationId);
    const readinessProjects: CareerProjectReadinessItem[] = appProjects.map((ap) => {
      const linkedEvidenceIds = this.evidenceLinks
        .filter((el) => el.entity_type === 'project' && el.entity_id === ap.project_id)
        .map((el) => el.evidence_id);

      const projectEvidence: CareerProjectEvidenceItem[] = this.evidence
        .filter((ev) => linkedEvidenceIds.includes(ev.id) && ev.user_id === userId)
        .map((ev) => ({
          id: ev.id,
          title: ev.title,
          evidence_type: ev.evidence_type,
          verification_status: ev.verification_status,
          occurred_at: ev.occurred_at,
          external_url: ev.external_url ?? null,
        }));

      return {
        project_id: ap.project_id,
        title: ap.project_title || 'Untitled Project',
        slug: ap.project_slug || '',
        status: ap.project_status || 'unknown',
        is_featured: ap.is_featured,
        talking_points: ap.talking_points,
        evidence: projectEvidence,
      };
    });

    const featuredProjects = readinessProjects.filter((p) => p.is_featured);
    const supportingProjects = readinessProjects.filter((p) => !p.is_featured);

    // Tasks
    const userTasks = this.tasks.filter((t) => t.application_id === applicationId && t.user_id === userId);
    const taskItems: CareerTaskReadinessItem[] = userTasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_at: t.due_at ?? null,
      scheduled_start: t.scheduled_start ?? null,
      scheduled_end: t.scheduled_end ?? null,
      completed_at: t.completed_at ?? null,
      is_blocked: Boolean(t.is_blocked),
    }));

    const openTasks = taskItems.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
    const completedTasks = taskItems.filter((t) => t.status === 'completed');

    // Interviews
    const interviewsList = await this.listInterviews(userId, {
      application_id: applicationId,
      pageSize: 100,
    });

    return {
      application_id: app.id,
      company_name: opportunity.company_name,
      role_title: opportunity.role_title,
      current_stage: app.stage,
      target_id: opportunity.target_id,
      opportunity_id: app.opportunity_id,
      skills: {
        required: requiredSkills,
        preferred: preferredSkills,
        bonus: bonusSkills,
        summary: {
          total_skills: totalSkills,
          acquired_skills: acquiredSkillsCount,
          missing_skills: totalSkills - acquiredSkillsCount,
          required_total: requiredSkills.length,
          required_acquired: requiredAcquiredCount,
        },
      },
      projects: {
        featured: featuredProjects,
        supporting: supportingProjects,
      },
      tasks: {
        open: openTasks,
        completed: completedTasks,
        open_count: openTasks.length,
        completed_count: completedTasks.length,
      },
      interviews: interviewsList.data,
    };
  }
}
