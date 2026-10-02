import type {
  FocusSessionDto,
  FocusSessionStatus,
  FocusSessionType,
  PaginatedList,
} from '@avenza/shared';

export interface FocusSessionRow {
  id: string;
  user_id: string;
  task_id: string | null;
  session_type: FocusSessionType;
  status: FocusSessionStatus;
  started_at: string;
  ended_at: string | null;
  planned_minutes: number;
  actual_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FocusSessionCreateData {
  id?: string;
  user_id: string;
  task_id: string;
  session_type: FocusSessionType;
  status?: FocusSessionStatus;
  started_at?: string;
  ended_at?: string | null;
  planned_minutes: number;
  actual_minutes?: number | null;
  notes?: string | null;
}

export interface FocusSessionFindOptions {
  userId: string;
  taskId?: string;
  status?: FocusSessionStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface IFocusRepository {
  createSession(data: FocusSessionCreateData): Promise<FocusSessionRow>;
  findActiveSessionByUserId(userId: string): Promise<FocusSessionRow | null>;
  findSessionById(id: string, userId: string): Promise<FocusSessionRow | null>;
  findSessions(options: FocusSessionFindOptions): Promise<PaginatedList<FocusSessionRow>>;
  findCompletedSessionsBetween(
    userId: string,
    startIso: string,
    endIso: string
  ): Promise<FocusSessionRow[]>;
  completeSession(
    id: string,
    userId: string,
    endedAt: string,
    actualMinutes: number,
    notes?: string | null
  ): Promise<FocusSessionRow | null>;
  cancelSession(
    id: string,
    userId: string,
    endedAt: string,
    notes?: string | null
  ): Promise<FocusSessionRow | null>;
}

export interface IFocusService {
  startSession(
    userId: string,
    input: {
      taskId: string;
      sessionType?: FocusSessionType;
      plannedMinutes: number;
      notes?: string | null;
    }
  ): Promise<FocusSessionDto>;
  getActiveSession(userId: string): Promise<FocusSessionDto | null>;
  getSessionById(id: string, userId: string): Promise<FocusSessionDto | null>;
  listSessions(
    userId: string,
    options: {
      taskId?: string;
      status?: FocusSessionStatus;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedList<FocusSessionDto>>;
  completeSession(id: string, userId: string, notes?: string | null): Promise<FocusSessionDto>;
  cancelSession(id: string, userId: string, notes?: string | null): Promise<FocusSessionDto>;
}
