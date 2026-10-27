import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@avenza/shared';
import { getSupabaseAdminClient } from '../../db/supabase.client';

export interface ExportMetadata {
  format: string;
  version: string;
  totalTables: number;
  totalRecords: number;
  omittedSensitiveFields: string[];
  unavailableTables: string[];
}

export interface AccountExportPayload {
  version: string;
  exportedAt: string;
  userId: string;
  metadata: ExportMetadata;
  data: Record<string, unknown[] | Record<string, unknown> | null>;
}

const EXPORT_PAGE_SIZE = 1000;
const SENSITIVE_INTEGRATION_FIELDS = new Set([
  'encrypted_access_token',
  'encrypted_refresh_token',
  'token_iv',
  'token_tag',
  'token_version',
  'access_token',
  'refresh_token',
]);

const TABLE_ORDER_COLUMNS: Record<string, string> = {
  project_goals: 'created_at',
  project_skills: 'created_at',
  assessment_topics: 'created_at',
  exam_topics: 'created_at',
};

export class AccountExportService {
  private activeExports = new Set<string>();
  private lastExportTimestamps = new Map<string, number>();

  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) {}

  /**
   * Generates a complete, paginated, sanitized export of all user-owned data.
   */
  async exportUserData(userId: string): Promise<AccountExportPayload> {
    if (!userId || !userId.trim()) {
      const err = new Error('A valid userId is required to generate an account export.');
      (err as unknown as { statusCode: number; code: string }).statusCode = 400;
      (err as unknown as { statusCode: number; code: string }).code = 'INVALID_USER_ID';
      throw err;
    }

    const trimmedUserId = userId.trim();

    // Acquire concurrency and rate-limiting lease (distributed + in-memory guard)
    await this.acquireExportLease(trimmedUserId);

    let exportSucceeded = false;
    try {
      const data: Record<string, unknown[] | Record<string, unknown> | null> = {};
      const unavailableTables: string[] = [];
      let totalRecords = 0;

      // 1. Profile & Preferences
      const profile = await this.fetchSingleRow('profiles', 'id', trimmedUserId);
      data.profile = profile;
      if (profile) totalRecords += 1;

      const userPreferences = await this.fetchTable('user_preferences', 'user_id', trimmedUserId, unavailableTables);
      data.userPreferences = userPreferences;
      totalRecords += userPreferences.length;

      // 2. Goals & Milestones
      const goals = await this.fetchTable('goals', 'user_id', trimmedUserId, unavailableTables);
      data.goals = goals;
      totalRecords += goals.length;

      const goalIds = goals.map((g) => (g as { id: string }).id).filter(Boolean);
      let goalMilestones: unknown[] = [];
      if (goalIds.length > 0) {
        goalMilestones = await this.fetchTableInChunks('goal_milestones', 'goal_id', goalIds, unavailableTables);
      }
      data.goalMilestones = goalMilestones;
      totalRecords += goalMilestones.length;

      // 3. Tasks & Dependencies
      const tasks = await this.fetchTable('tasks', 'user_id', trimmedUserId, unavailableTables);
      data.tasks = tasks;
      totalRecords += tasks.length;

      const taskIds = tasks.map((t) => (t as { id: string }).id).filter(Boolean);
      let taskDependencies: unknown[] = [];
      if (taskIds.length > 0) {
        taskDependencies = await this.fetchTableInChunks('task_dependencies', 'task_id', taskIds, unavailableTables);
      }
      data.taskDependencies = taskDependencies;
      totalRecords += taskDependencies.length;

      // 4. Focus Sessions
      const focusSessions = await this.fetchTable('focus_sessions', 'user_id', trimmedUserId, unavailableTables);
      data.focusSessions = focusSessions;
      totalRecords += focusSessions.length;

      // 5. Evidence & Links
      const evidence = await this.fetchTable('evidence', 'user_id', trimmedUserId, unavailableTables);
      data.evidence = evidence;
      totalRecords += evidence.length;

      const evidenceIds = evidence.map((e) => (e as { id: string }).id).filter(Boolean);
      let evidenceLinks: unknown[] = [];
      if (evidenceIds.length > 0) {
        evidenceLinks = await this.fetchTableInChunks('evidence_links', 'evidence_id', evidenceIds, unavailableTables);
      }
      data.evidenceLinks = evidenceLinks;
      totalRecords += evidenceLinks.length;

      // 6. Academics
      const academicYears = await this.fetchTable('academic_years', 'user_id', trimmedUserId, unavailableTables);
      data.academicYears = academicYears;
      totalRecords += academicYears.length;

      const yearIds = academicYears.map((y) => (y as { id: string }).id).filter(Boolean);
      let terms: unknown[] = [];
      if (yearIds.length > 0) {
        terms = await this.fetchTableInChunks('terms', 'academic_year_id', yearIds, unavailableTables);
      }
      data.terms = terms;
      totalRecords += terms.length;

      const subjects = await this.fetchTable('subjects', 'user_id', trimmedUserId, unavailableTables);
      data.subjects = subjects;
      totalRecords += subjects.length;

      const subjectIds = subjects.map((s) => (s as { id: string }).id).filter(Boolean);
      let subjectTopics: unknown[] = [];
      let assessments: unknown[] = [];
      let exams: unknown[] = [];

      if (subjectIds.length > 0) {
        subjectTopics = await this.fetchTableInChunks('subject_topics', 'subject_id', subjectIds, unavailableTables);
        assessments = await this.fetchTableInChunks('assessments', 'subject_id', subjectIds, unavailableTables);
        exams = await this.fetchTableInChunks('exams', 'subject_id', subjectIds, unavailableTables);
      }
      data.subjectTopics = subjectTopics;
      data.assessments = assessments;
      data.exams = exams;
      totalRecords += subjectTopics.length + assessments.length + exams.length;

      // Academic Topics Junction Tables (assessment_topics, exam_topics)
      const assessmentIds = assessments.map((a) => (a as { id: string }).id).filter(Boolean);
      let assessmentTopics: unknown[] = [];
      if (assessmentIds.length > 0) {
        assessmentTopics = await this.fetchTableInChunks('assessment_topics', 'assessment_id', assessmentIds, unavailableTables);
      }
      data.assessmentTopics = assessmentTopics;
      totalRecords += assessmentTopics.length;

      const examIds = exams.map((e) => (e as { id: string }).id).filter(Boolean);
      let examTopics: unknown[] = [];
      if (examIds.length > 0) {
        examTopics = await this.fetchTableInChunks('exam_topics', 'exam_id', examIds, unavailableTables);
      }
      data.examTopics = examTopics;
      totalRecords += examTopics.length;

      // 7. Skills & Relations
      const skills = await this.fetchTable('skills', 'user_id', trimmedUserId, unavailableTables);
      data.skills = skills;
      totalRecords += skills.length;

      const evidenceSkills = await this.fetchTable('evidence_skills', 'user_id', trimmedUserId, unavailableTables);
      const goalSkills = await this.fetchTable('goal_skills', 'user_id', trimmedUserId, unavailableTables);
      const taskSkills = await this.fetchTable('task_skills', 'user_id', trimmedUserId, unavailableTables);
      const topicSkills = await this.fetchTable('topic_skills', 'user_id', trimmedUserId, unavailableTables);

      data.evidenceSkills = evidenceSkills;
      data.goalSkills = goalSkills;
      data.taskSkills = taskSkills;
      data.topicSkills = topicSkills;
      totalRecords += evidenceSkills.length + goalSkills.length + taskSkills.length + topicSkills.length;

      // 8. DSA Attempts
      const dsaAttempts = await this.fetchTable('dsa_attempts', 'user_id', trimmedUserId, unavailableTables);
      data.dsaAttempts = dsaAttempts;
      totalRecords += dsaAttempts.length;

      // 9. Integrations (Sanitized)
      const rawConnections = await this.fetchTable('integration_connections', 'user_id', trimmedUserId, unavailableTables);
      const sanitizedConnections = rawConnections.map((conn) => {
        const row = { ...(conn as Record<string, unknown>) };
        for (const sensitiveField of SENSITIVE_INTEGRATION_FIELDS) {
          delete row[sensitiveField];
        }
        return row;
      });
      data.integrationConnections = sanitizedConnections;
      totalRecords += sanitizedConnections.length;

      const externalRepositories = await this.fetchTable('external_repositories', 'user_id', trimmedUserId, unavailableTables);
      const externalActivities = await this.fetchTable('external_activities', 'user_id', trimmedUserId, unavailableTables);
      const externalCalendarEvents = await this.fetchTable('external_calendar_events', 'user_id', trimmedUserId, unavailableTables);
      const syncJobs = await this.fetchTable('sync_jobs', 'user_id', trimmedUserId, unavailableTables);

      data.externalRepositories = externalRepositories;
      data.externalActivities = externalActivities;
      data.externalCalendarEvents = externalCalendarEvents;
      data.syncJobs = syncJobs;
      totalRecords += externalRepositories.length + externalActivities.length + externalCalendarEvents.length + syncJobs.length;

      // 10. Projects & Milestones
      const projects = await this.fetchTable('projects', 'user_id', trimmedUserId, unavailableTables);
      data.projects = projects;
      totalRecords += projects.length;

      const projectIds = projects.map((p) => (p as { id: string }).id).filter(Boolean);
      let projectMilestones: unknown[] = [];
      let projectGoals: unknown[] = [];
      let projectSkills: unknown[] = [];

      if (projectIds.length > 0) {
        projectMilestones = await this.fetchTableInChunks('project_milestones', 'project_id', projectIds, unavailableTables);
        projectGoals = await this.fetchTableInChunks('project_goals', 'project_id', projectIds, unavailableTables);
        projectSkills = await this.fetchTableInChunks('project_skills', 'project_id', projectIds, unavailableTables);
      }
      data.projectMilestones = projectMilestones;
      data.projectGoals = projectGoals;
      data.projectSkills = projectSkills;
      totalRecords += projectMilestones.length + projectGoals.length + projectSkills.length;

      // 11. Career
      const careerTargets = await this.fetchTable('career_targets', 'user_id', trimmedUserId, unavailableTables);
      const careerTargetSkills = await this.fetchTable('career_target_skills', 'user_id', trimmedUserId, unavailableTables);
      const careerOpportunities = await this.fetchTable('career_opportunities', 'user_id', trimmedUserId, unavailableTables);
      const careerOpportunitySkills = await this.fetchTable('career_opportunity_skills', 'user_id', trimmedUserId, unavailableTables);
      const careerApplications = await this.fetchTable('career_applications', 'user_id', trimmedUserId, unavailableTables);
      const careerApplicationHistory = await this.fetchTable('career_application_history', 'user_id', trimmedUserId, unavailableTables);
      const careerApplicationProjects = await this.fetchTable('career_application_projects', 'user_id', trimmedUserId, unavailableTables);
      const careerInterviews = await this.fetchTable('career_interviews', 'user_id', trimmedUserId, unavailableTables);

      data.careerTargets = careerTargets;
      data.careerTargetSkills = careerTargetSkills;
      data.careerOpportunities = careerOpportunities;
      data.careerOpportunitySkills = careerOpportunitySkills;
      data.careerApplications = careerApplications;
      data.careerApplicationHistory = careerApplicationHistory;
      data.careerApplicationProjects = careerApplicationProjects;
      data.careerInterviews = careerInterviews;
      totalRecords +=
        careerTargets.length +
        careerTargetSkills.length +
        careerOpportunities.length +
        careerOpportunitySkills.length +
        careerApplications.length +
        careerApplicationHistory.length +
        careerApplicationProjects.length +
        careerInterviews.length;

      exportSucceeded = true;

      return {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        userId: trimmedUserId,
        metadata: {
          format: 'AVENZA_ACCOUNT_DATA_EXPORT',
          version: '1.0.0',
          totalTables: Object.keys(data).length,
          totalRecords,
          omittedSensitiveFields: Array.from(SENSITIVE_INTEGRATION_FIELDS),
          unavailableTables,
        },
        data,
      };
    } finally {
      await this.releaseExportLease(trimmedUserId, exportSucceeded);
    }
  }

  private activeLeaseTokens = new Map<string, string>();

  private async acquireExportLease(userId: string): Promise<void> {
    const now = Date.now();
    const LEASE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
    const RATE_LIMIT_COOLDOWN_MS = 15 * 1000; // 15 seconds
    const leaseToken = crypto.randomUUID();

    // 1. Process-local fast guards
    if (this.activeExports.has(userId)) {
      const err = new Error('An account export is already currently in progress. Please wait.');
      (err as unknown as { statusCode: number; code: string }).statusCode = 429;
      (err as unknown as { statusCode: number; code: string }).code = 'CONCURRENT_EXPORT_IN_PROGRESS';
      throw err;
    }

    const lastExport = this.lastExportTimestamps.get(userId);
    if (lastExport && now - lastExport < RATE_LIMIT_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_COOLDOWN_MS - (now - lastExport)) / 1000);
      const err = new Error(`Export rate limit reached. Please wait ${waitSeconds}s before generating a new export.`);
      (err as unknown as { statusCode: number; code: string }).statusCode = 429;
      (err as unknown as { statusCode: number; code: string }).code = 'EXPORT_RATE_LIMITED';
      throw err;
    }

    // 2. Distributed atomic lease coordination via database
    if (typeof (this.client as { rpc?: unknown }).rpc === 'function') {
      type RpcFn = (
        name: string,
        params: Record<string, unknown>
      ) => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
      const rpcClient = this.client as unknown as { rpc: RpcFn };
      const { data: rpcRes, error: rpcErr } = await rpcClient.rpc('acquire_account_export_lease', {
        p_user_id: userId,
        p_lease_token: leaseToken,
        p_lease_ttl_seconds: 300,
        p_cooldown_seconds: 15,
      });

      if (rpcErr) {
        const err = new Error(
          `Export coordination service unavailable: ${rpcErr instanceof Error ? rpcErr.message : JSON.stringify(rpcErr)}`
        );
        (err as unknown as { statusCode: number; code: string }).statusCode = 503;
        (err as unknown as { statusCode: number; code: string }).code = 'EXPORT_COORDINATION_UNAVAILABLE';
        throw err;
      }

      if (rpcRes && rpcRes.success === false) {
        const statusCode =
          (rpcRes.code as string) === 'CONCURRENT_EXPORT_IN_PROGRESS' ||
          (rpcRes.code as string) === 'EXPORT_RATE_LIMITED'
            ? 429
            : 400;
        const err = new Error((rpcRes.message as string) || 'Export lease acquisition rejected.');
        (err as unknown as { statusCode: number; code: string }).statusCode = statusCode;
        (err as unknown as { statusCode: number; code: string }).code = (rpcRes.code as string) || 'EXPORT_LEASE_FAILED';
        throw err;
      }
    } else {
      // Table-level coordination fallback for environments without RPC
      type LeaseFrom = (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: {
                user_id: string;
                lease_token?: string;
                leased_at?: string;
                acquired_at?: string;
                expires_at: string;
                last_exported_at: string | null;
              } | null;
              error: unknown;
            }>;
          };
        };
        upsert: (payload: Record<string, unknown>) => Promise<{ error: unknown }>;
      };

      const queryTable = this.client.from as unknown as LeaseFrom;
      const { data: existingLease, error } = await queryTable('account_export_leases')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        const err = new Error(
          `Export coordination database unavailable: ${error instanceof Error ? error.message : JSON.stringify(error)}`
        );
        (err as unknown as { statusCode: number; code: string }).statusCode = 503;
        (err as unknown as { statusCode: number; code: string }).code = 'EXPORT_COORDINATION_UNAVAILABLE';
        throw err;
      }

      if (existingLease) {
        const expiresAt = new Date(existingLease.expires_at).getTime();
        if (expiresAt > now) {
          const err = new Error('An account export is already currently in progress across API instances. Please wait.');
          (err as unknown as { statusCode: number; code: string }).statusCode = 429;
          (err as unknown as { statusCode: number; code: string }).code = 'CONCURRENT_EXPORT_IN_PROGRESS';
          throw err;
        }

        if (existingLease.last_exported_at) {
          const lastExportedAt = new Date(existingLease.last_exported_at).getTime();
          if (now - lastExportedAt < RATE_LIMIT_COOLDOWN_MS) {
            const waitSeconds = Math.ceil((RATE_LIMIT_COOLDOWN_MS - (now - lastExportedAt)) / 1000);
            const err = new Error(`Export rate limit reached. Please wait ${waitSeconds}s before generating a new export.`);
            (err as unknown as { statusCode: number; code: string }).statusCode = 429;
            (err as unknown as { statusCode: number; code: string }).code = 'EXPORT_RATE_LIMITED';
            throw err;
          }
        }
      }

      const expiresAtIso = new Date(now + LEASE_DURATION_MS).toISOString();
      const acquiredAtIso = new Date(now).toISOString();
      const { error: upsertErr } = await queryTable('account_export_leases').upsert({
        user_id: userId,
        lease_token: leaseToken,
        acquired_at: acquiredAtIso,
        expires_at: expiresAtIso,
        last_exported_at: existingLease?.last_exported_at || null,
      });

      if (upsertErr) {
        const err = new Error(
          `Export coordination database unavailable: ${upsertErr instanceof Error ? upsertErr.message : JSON.stringify(upsertErr)}`
        );
        (err as unknown as { statusCode: number; code: string }).statusCode = 503;
        (err as unknown as { statusCode: number; code: string }).code = 'EXPORT_COORDINATION_UNAVAILABLE';
        throw err;
      }
    }

    this.activeLeaseTokens.set(userId, leaseToken);
    this.activeExports.add(userId);
  }

  private async releaseExportLease(userId: string, success: boolean): Promise<void> {
    const now = Date.now();
    const leaseToken = this.activeLeaseTokens.get(userId);
    this.activeLeaseTokens.delete(userId);
    this.activeExports.delete(userId);

    if (success) {
      this.lastExportTimestamps.set(userId, now);
    }

    if (!leaseToken) {
      return;
    }

    try {
      if (typeof (this.client as { rpc?: unknown }).rpc === 'function') {
        type RpcFn = (name: string, params: Record<string, unknown>) => Promise<{ error: unknown }>;
        const rpcClient = this.client as unknown as { rpc: RpcFn };
        await rpcClient.rpc('release_account_export_lease', {
          p_user_id: userId,
          p_lease_token: leaseToken,
          p_success: success,
        });
      } else {
        type LeaseFrom = (table: string) => {
          update: (record: Record<string, unknown>) => {
            eq: (col: string, val: string) => Promise<{ error: unknown }>;
          };
        };
        const queryTable = this.client.from as unknown as LeaseFrom;
        const nowIso = new Date(now).toISOString();

        await queryTable('account_export_leases')
          .update({
            expires_at: nowIso,
            ...(success ? { last_exported_at: nowIso } : {}),
          })
          .eq('user_id', userId);
      }
    } catch {
      // Safe best-effort lease cleanup
    }
  }

  private async fetchSingleRow(tableName: string, idColumn: string, idValue: string): Promise<Record<string, unknown> | null> {
    type SingleFrom = (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
        };
      };
    };
    const queryTable = this.client.from as unknown as SingleFrom;
    const { data, error } = await queryTable(tableName).select('*').eq(idColumn, idValue).maybeSingle();
    if (error) {
      throw new Error(`Failed to export data from table ${tableName}: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
    return data;
  }

  private async fetchTable(
    tableName: string,
    filterColumn: string,
    filterValue: string,
    _unavailableTables: string[]
  ): Promise<unknown[]> {
    const results: unknown[] = [];
    let offset = 0;
    const orderColumn = TABLE_ORDER_COLUMNS[tableName] || 'id';

    while (true) {
      type PagedFrom = (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            order: (col: string, opts: { ascending: boolean }) => {
              range: (start: number, end: number) => Promise<{ data: unknown[] | null; error: unknown }>;
            };
          };
        };
      };
      const queryTable = this.client.from as unknown as PagedFrom;
      const { data, error } = await queryTable(tableName)
        .select('*')
        .eq(filterColumn, filterValue)
        .order(orderColumn, { ascending: true })
        .range(offset, offset + EXPORT_PAGE_SIZE - 1);

      if (error) {
        throw new Error(
          `Failed to export data from table ${tableName}: ${error instanceof Error ? error.message : JSON.stringify(error)}`
        );
      }

      if (!data || data.length === 0) {
        break;
      }

      results.push(...data);

      if (data.length < EXPORT_PAGE_SIZE) {
        break;
      }

      offset += EXPORT_PAGE_SIZE;
    }

    return results;
  }

  private async fetchTableInChunks(
    tableName: string,
    inColumn: string,
    idValues: string[],
    _unavailableTables: string[]
  ): Promise<unknown[]> {
    const results: unknown[] = [];
    const BATCH_SIZE = 200;
    const orderColumn = TABLE_ORDER_COLUMNS[tableName] || 'id';

    for (let i = 0; i < idValues.length; i += BATCH_SIZE) {
      const batch = idValues.slice(i, i + BATCH_SIZE);
      let offset = 0;

      while (true) {
        type InPagedFrom = (table: string) => {
          select: (cols: string) => {
            in: (col: string, vals: string[]) => {
              order: (col: string, opts: { ascending: boolean }) => {
                range: (start: number, end: number) => Promise<{ data: unknown[] | null; error: unknown }>;
              };
            };
          };
        };
        const queryTable = this.client.from as unknown as InPagedFrom;
        const { data, error } = await queryTable(tableName)
          .select('*')
          .in(inColumn, batch)
          .order(orderColumn, { ascending: true })
          .range(offset, offset + EXPORT_PAGE_SIZE - 1);

        if (error) {
          throw new Error(
            `Failed to export data from table ${tableName}: ${error instanceof Error ? error.message : JSON.stringify(error)}`
          );
        }

        if (!data || data.length === 0) {
          break;
        }

        results.push(...data);

        if (data.length < EXPORT_PAGE_SIZE) {
          break;
        }

        offset += EXPORT_PAGE_SIZE;
      }
    }

    return results;
  }
}

export const defaultAccountExportService = new AccountExportService();
