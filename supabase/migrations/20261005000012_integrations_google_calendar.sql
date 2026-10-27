-- ==============================================================================
-- AVENZA EXTERNAL INTEGRATIONS MIGRATION - PHASE 14E: GOOGLE CALENDAR
-- Extends provider check constraints to support 'google_calendar'
-- Creates external_calendar_events table for read-only scheduling context
-- ==============================================================================

-- 1. Integration Connections
ALTER TABLE public.integration_connections
  DROP CONSTRAINT IF EXISTS chk_integration_connections_provider;

ALTER TABLE public.integration_connections
  ADD CONSTRAINT chk_integration_connections_provider
  CHECK (provider IN ('github', 'leetcode', 'codeforces', 'google_calendar'));

-- 2. OAuth States (for Google OAuth flow)
ALTER TABLE public.integration_oauth_states
  DROP CONSTRAINT IF EXISTS chk_integration_oauth_states_provider;

ALTER TABLE public.integration_oauth_states
  ADD CONSTRAINT chk_integration_oauth_states_provider
  CHECK (provider IN ('github', 'leetcode', 'codeforces', 'google_calendar'));

-- 3. Sync Jobs
ALTER TABLE public.sync_jobs
  DROP CONSTRAINT IF EXISTS chk_sync_jobs_provider;

ALTER TABLE public.sync_jobs
  ADD CONSTRAINT chk_sync_jobs_provider
  CHECK (provider IN ('github', 'leetcode', 'codeforces', 'google_calendar'));

-- 4. External Calendar Events Table
-- Dedicated scheduling/planning context model (NOT achievement evidence)
CREATE TABLE IF NOT EXISTS public.external_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '(No title)',
  status TEXT NOT NULL DEFAULT 'confirmed',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  time_zone TEXT NULL,
  is_busy BOOLEAN NOT NULL DEFAULT true,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_event_id TEXT NULL,
  html_link TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_external_calendar_events_status
    CHECK (status IN ('confirmed', 'tentative', 'cancelled')),

  CONSTRAINT uq_external_calendar_events_user_cal_event
    UNIQUE (user_id, calendar_id, external_event_id)
);

-- Indexes for performance & temporal interval queries
CREATE INDEX IF NOT EXISTS idx_external_calendar_events_user_range
  ON public.external_calendar_events (user_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_external_calendar_events_connection
  ON public.external_calendar_events (connection_id);

-- Row-Level Security
ALTER TABLE public.external_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only select their own calendar events" ON public.external_calendar_events;
CREATE POLICY "Users can only select their own calendar events"
  ON public.external_calendar_events
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can only insert their own calendar events" ON public.external_calendar_events;
CREATE POLICY "Users can only insert their own calendar events"
  ON public.external_calendar_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can only update their own calendar events" ON public.external_calendar_events;
CREATE POLICY "Users can only update their own calendar events"
  ON public.external_calendar_events
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can only delete their own calendar events" ON public.external_calendar_events;
CREATE POLICY "Users can only delete their own calendar events"
  ON public.external_calendar_events
  FOR DELETE
  USING (user_id = auth.uid());
