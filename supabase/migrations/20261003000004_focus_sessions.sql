-- ==============================================================================
-- AVENZA FOCUS SESSIONS MIGRATION
-- Phase 8: Foundational Focus Session System + RLS
-- ==============================================================================

-- 1. Focus Sessions Table
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_id UUID,
  session_type TEXT NOT NULL DEFAULT 'focus',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  planned_minutes INTEGER NOT NULL,
  actual_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key: strictly owned by profile with CASCADE on profile deletion
  CONSTRAINT fk_focus_sessions_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  -- Foreign Key: references task, preserved if task is deleted (historical execution preservation)
  CONSTRAINT fk_focus_sessions_task_id
    FOREIGN KEY (task_id)
    REFERENCES public.tasks(id)
    ON DELETE SET NULL,

  -- Valid Session Types
  CONSTRAINT chk_focus_sessions_session_type
    CHECK (session_type IN ('focus', 'pomodoro', 'deep_work', 'revision', 'practice', 'custom')),

  -- Valid Lifecycle Statuses
  CONSTRAINT chk_focus_sessions_status
    CHECK (status IN ('active', 'completed', 'cancelled')),

  -- Planned minutes must be positive and bounded (1 to 480 minutes / 8 hours)
  CONSTRAINT chk_focus_sessions_planned_minutes
    CHECK (planned_minutes > 0 AND planned_minutes <= 480),

  -- Actual minutes must be non-negative when provided
  CONSTRAINT chk_focus_sessions_actual_minutes
    CHECK (actual_minutes IS NULL OR actual_minutes >= 0),

  -- Chronological order: ended_at >= started_at when ended_at exists
  CONSTRAINT chk_focus_sessions_dates
    CHECK (ended_at IS NULL OR ended_at >= started_at),

  -- Bounded notes description
  CONSTRAINT chk_focus_sessions_notes_length
    CHECK (notes IS NULL OR length(notes) <= 2000),

  -- State consistency: active sessions have no ended_at; inactive sessions must have ended_at
  CONSTRAINT chk_focus_sessions_state_consistency
    CHECK (
      (status = 'active' AND ended_at IS NULL)
      OR
      (status != 'active' AND ended_at IS NOT NULL)
    )
);

-- 2. Partial Unique Index: Exactly one active session per user invariant
CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_sessions_user_active
  ON public.focus_sessions (user_id)
  WHERE status = 'active';

-- 3. Indexes for frequent query patterns
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_started
  ON public.focus_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_status
  ON public.focus_sessions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_started
  ON public.focus_sessions (task_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_ended
  ON public.focus_sessions (user_id, ended_at DESC);

-- 4. Attach updated_at trigger to focus_sessions
DROP TRIGGER IF EXISTS set_focus_sessions_updated_at ON public.focus_sessions;
CREATE TRIGGER set_focus_sessions_updated_at
  BEFORE UPDATE ON public.focus_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: public.focus_sessions
CREATE POLICY "focus_sessions_select_policy"
  ON public.focus_sessions
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "focus_sessions_insert_policy"
  ON public.focus_sessions
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "focus_sessions_update_policy"
  ON public.focus_sessions
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "focus_sessions_delete_policy"
  ON public.focus_sessions
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );
