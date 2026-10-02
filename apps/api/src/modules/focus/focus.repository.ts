import type { PaginatedList, Database } from '@avenza/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import type {
  FocusSessionCreateData,
  FocusSessionFindOptions,
  FocusSessionRow,
  IFocusRepository,
} from './focus.types';

export class SupabaseFocusRepository implements IFocusRepository {
  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) {}

  async createSession(data: FocusSessionCreateData): Promise<FocusSessionRow> {
    const insertPayload: Record<string, unknown> = {
      user_id: data.user_id,
      task_id: data.task_id,
      session_type: data.session_type,
      status: data.status || 'active',
      planned_minutes: data.planned_minutes,
      notes: data.notes || null,
    };

    if (data.started_at) {
      insertPayload.started_at = data.started_at;
    }
    if (data.ended_at !== undefined) {
      insertPayload.ended_at = data.ended_at;
    }
    if (data.actual_minutes !== undefined) {
      insertPayload.actual_minutes = data.actual_minutes;
    }

    const { data: created, error } = await this.client
      .from('focus_sessions')
      .insert(insertPayload as unknown as Database['public']['Tables']['focus_sessions']['Insert'])
      .select('*')
      .single();

    if (error || !created) {
      throw new Error(`Failed to create focus session: ${error?.message || 'Unknown error'}`);
    }

    return created as FocusSessionRow;
  }

  async findActiveSessionByUserId(userId: string): Promise<FocusSessionRow | null> {
    const { data, error } = await this.client
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch active focus session: ${error.message}`);
    }

    return (data as FocusSessionRow) || null;
  }

  async findSessionById(id: string, userId: string): Promise<FocusSessionRow | null> {
    const { data, error } = await this.client
      .from('focus_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch focus session: ${error.message}`);
    }

    return (data as FocusSessionRow) || null;
  }

  async findSessions(options: FocusSessionFindOptions): Promise<PaginatedList<FocusSessionRow>> {
    const { userId, taskId, status, from, to } = options;
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const offset = (page - 1) * limit;

    let query = this.client
      .from('focus_sessions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (taskId) {
      query = query.eq('task_id', taskId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (from) {
      query = query.gte('started_at', from);
    }
    if (to) {
      query = query.lte('started_at', to);
    }

    query = query.order('started_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) {
      throw new Error(`Failed to list focus sessions: ${error.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: (data || []) as FocusSessionRow[],
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages,
      },
    };
  }

  async findCompletedSessionsBetween(
    userId: string,
    startIso: string,
    endIso: string
  ): Promise<FocusSessionRow[]> {
    const { data, error } = await this.client
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('started_at', startIso)
      .lte('started_at', endIso)
      .order('started_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to query completed focus sessions: ${error.message}`);
    }

    return (data || []) as FocusSessionRow[];
  }

  async completeSession(
    id: string,
    userId: string,
    endedAt: string,
    actualMinutes: number,
    notes?: string | null
  ): Promise<FocusSessionRow | null> {
    const updatePayload: Record<string, unknown> = {
      status: 'completed',
      ended_at: endedAt,
      actual_minutes: actualMinutes,
    };
    if (notes !== undefined && notes !== null) {
      updatePayload.notes = notes;
    }

    const { data, error } = await this.client
      .from('focus_sessions')
      .update(updatePayload as unknown as Database['public']['Tables']['focus_sessions']['Update'])
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to complete focus session: ${error.message}`);
    }

    return (data as FocusSessionRow) || null;
  }

  async cancelSession(
    id: string,
    userId: string,
    endedAt: string,
    notes?: string | null
  ): Promise<FocusSessionRow | null> {
    const updatePayload: Record<string, unknown> = {
      status: 'cancelled',
      ended_at: endedAt,
      actual_minutes: 0,
    };
    if (notes !== undefined && notes !== null) {
      updatePayload.notes = notes;
    }

    const { data, error } = await this.client
      .from('focus_sessions')
      .update(updatePayload as unknown as Database['public']['Tables']['focus_sessions']['Update'])
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to cancel focus session: ${error.message}`);
    }

    return (data as FocusSessionRow) || null;
  }
}

export class InMemoryFocusRepository implements IFocusRepository {
  private sessions: FocusSessionRow[] = [];

  constructor(initialSessions: FocusSessionRow[] = []) {
    this.sessions = [...initialSessions];
  }

  async createSession(data: FocusSessionCreateData): Promise<FocusSessionRow> {
    // Check if user already has an active session
    if ((data.status || 'active') === 'active') {
      const existingActive = this.sessions.find(
        (s) => s.user_id === data.user_id && s.status === 'active'
      );
      if (existingActive) {
        throw new Error('User already has an active focus session.');
      }
    }

    const now = new Date().toISOString();
    const newSession: FocusSessionRow = {
      id: data.id || crypto.randomUUID(),
      user_id: data.user_id,
      task_id: data.task_id,
      session_type: data.session_type,
      status: data.status || 'active',
      started_at: data.started_at || now,
      ended_at: data.ended_at !== undefined ? data.ended_at : null,
      planned_minutes: data.planned_minutes,
      actual_minutes: data.actual_minutes !== undefined ? data.actual_minutes : null,
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
    };

    this.sessions.push(newSession);
    return newSession;
  }

  async findActiveSessionByUserId(userId: string): Promise<FocusSessionRow | null> {
    const active = this.sessions.find((s) => s.user_id === userId && s.status === 'active');
    return active ? { ...active } : null;
  }

  async findSessionById(id: string, userId: string): Promise<FocusSessionRow | null> {
    const session = this.sessions.find((s) => s.id === id && s.user_id === userId);
    return session ? { ...session } : null;
  }

  async findSessions(options: FocusSessionFindOptions): Promise<PaginatedList<FocusSessionRow>> {
    let filtered = this.sessions.filter((s) => s.user_id === options.userId);

    if (options.taskId) {
      filtered = filtered.filter((s) => s.task_id === options.taskId);
    }
    if (options.status) {
      filtered = filtered.filter((s) => s.status === options.status);
    }
    if (options.from) {
      filtered = filtered.filter((s) => new Date(s.started_at) >= new Date(options.from!));
    }
    if (options.to) {
      filtered = filtered.filter((s) => new Date(s.started_at) <= new Date(options.to!));
    }

    filtered.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const paged = filtered.slice(offset, offset + limit);
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    return {
      data: paged.map((s) => ({ ...s })),
      pagination: {
        page,
        pageSize: limit,
        total: totalCount,
        totalPages,
      },
    };
  }

  async findCompletedSessionsBetween(
    userId: string,
    startIso: string,
    endIso: string
  ): Promise<FocusSessionRow[]> {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();

    return this.sessions
      .filter((s) => {
        if (s.user_id !== userId || s.status !== 'completed') return false;
        const sTime = new Date(s.started_at).getTime();
        return sTime >= start && sTime <= end;
      })
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .map((s) => ({ ...s }));
  }

  async completeSession(
    id: string,
    userId: string,
    endedAt: string,
    actualMinutes: number,
    notes?: string | null
  ): Promise<FocusSessionRow | null> {
    const index = this.sessions.findIndex(
      (s) => s.id === id && s.user_id === userId && s.status === 'active'
    );
    if (index === -1) return null;

    const existing = this.sessions[index]!;
    const updated: FocusSessionRow = {
      ...existing,
      status: 'completed',
      ended_at: endedAt,
      actual_minutes: actualMinutes,
      notes: notes !== undefined && notes !== null ? notes : existing.notes,
      updated_at: new Date().toISOString(),
    };
    this.sessions[index] = updated;
    return { ...updated };
  }

  async cancelSession(
    id: string,
    userId: string,
    endedAt: string,
    notes?: string | null
  ): Promise<FocusSessionRow | null> {
    const index = this.sessions.findIndex(
      (s) => s.id === id && s.user_id === userId && s.status === 'active'
    );
    if (index === -1) return null;

    const existing = this.sessions[index]!;
    const updated: FocusSessionRow = {
      ...existing,
      status: 'cancelled',
      ended_at: endedAt,
      actual_minutes: 0,
      notes: notes !== undefined && notes !== null ? notes : existing.notes,
      updated_at: new Date().toISOString(),
    };
    this.sessions[index] = updated;
    return { ...updated };
  }
}

export const defaultFocusRepository = new SupabaseFocusRepository();
