-- ==============================================================================
-- AVENZA EXTERNAL INTEGRATIONS MIGRATION
-- Phase 14: Integrations Foundation, Provider Connections, Normalized Repositories & Activities + RLS
--
-- Security:
-- 1. Tokens are encrypted at rest using AES-256-GCM.
-- 2. Tokens are NEVER exposed to the frontend.
-- 3. Strict RLS ensures complete isolation between users.
-- ==============================================================================

-- 1. Integration Connections
CREATE TABLE IF NOT EXISTS public.integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  external_account_id TEXT NOT NULL,
  external_username TEXT NULL,
  external_display_name TEXT NULL,
  external_avatar_url TEXT NULL,
  external_email TEXT NULL,
  status TEXT NOT NULL DEFAULT 'CONNECTED',
  scopes TEXT[] NOT NULL DEFAULT '{}',

  -- Sensitive tokens encrypted at rest (AES-256-GCM)
  encrypted_access_token TEXT NULL,
  encrypted_refresh_token TEXT NULL,
  token_expires_at TIMESTAMPTZ NULL,

  -- Sync state & cursors
  sync_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  sync_cursor TEXT NULL,
  last_sync_started_at TIMESTAMPTZ NULL,
  last_sync_completed_at TIMESTAMPTZ NULL,
  last_synced_at TIMESTAMPTZ NULL,
  last_error_code TEXT NULL,
  last_error_message TEXT NULL,

  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_integration_connections_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,

  CONSTRAINT chk_integration_connections_provider
    CHECK (provider IN ('github')),

  CONSTRAINT chk_integration_connections_status
    CHECK (status IN (
      'CONNECTED',
      'SYNCING',
      'SYNCED',
      'NEEDS_REAUTHORIZATION',
      'PERMISSION_ERROR',
      'RATE_LIMITED',
      'TEMPORARILY_UNAVAILABLE',
      'DISCONNECTED'
    )),

  CONSTRAINT uq_integration_connections_user_provider
    UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_user_status
  ON public.integration_connections (user_id, status);

CREATE INDEX IF NOT EXISTS idx_integration_connections_provider_account
  ON public.integration_connections (provider, external_account_id);


-- 2. OAuth States (Short-lived CSRF state tracking)
CREATE TABLE IF NOT EXISTS public.integration_oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  redirect_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),

  CONSTRAINT fk_integration_oauth_states_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,

  CONSTRAINT chk_integration_oauth_states_provider
    CHECK (provider IN ('github'))
);

CREATE INDEX IF NOT EXISTS idx_integration_oauth_states_user
  ON public.integration_oauth_states (user_id);


-- 3. Normalized External Repositories
CREATE TABLE IF NOT EXISTS public.external_repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  owner TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  html_url TEXT NOT NULL,
  description TEXT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  primary_language TEXT NULL,
  languages JSONB NOT NULL DEFAULT '{}'::jsonb,
  stars_count INTEGER NOT NULL DEFAULT 0,
  forks_count INTEGER NOT NULL DEFAULT 0,
  open_issues_count INTEGER NOT NULL DEFAULT 0,
  pushed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_external_repositories_connection_id
    FOREIGN KEY (connection_id) REFERENCES public.integration_connections(id) ON DELETE CASCADE,

  CONSTRAINT fk_external_repositories_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,

  CONSTRAINT chk_external_repositories_provider
    CHECK (provider IN ('github')),

  CONSTRAINT uq_external_repositories_user_provider_ext
    UNIQUE (user_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_external_repositories_user_provider
  ON public.external_repositories (user_id, provider);

CREATE INDEX IF NOT EXISTS idx_external_repositories_connection
  ON public.external_repositories (connection_id);


-- 4. Normalized External Activities
CREATE TABLE IF NOT EXISTS public.external_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL,
  user_id UUID NOT NULL,
  repository_id UUID NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NULL,
  external_url TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_external_activities_connection_id
    FOREIGN KEY (connection_id) REFERENCES public.integration_connections(id) ON DELETE CASCADE,

  CONSTRAINT fk_external_activities_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,

  CONSTRAINT fk_external_activities_repository_id
    FOREIGN KEY (repository_id) REFERENCES public.external_repositories(id) ON DELETE SET NULL,

  CONSTRAINT chk_external_activities_provider
    CHECK (provider IN ('github')),

  CONSTRAINT uq_external_activities_user_provider_ext
    UNIQUE (user_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_external_activities_user_occurred
  ON public.external_activities (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_activities_repository
  ON public.external_activities (repository_id);


-- 5. Sync Jobs
CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'QUEUED',
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  records_synced INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_sync_jobs_connection_id
    FOREIGN KEY (connection_id) REFERENCES public.integration_connections(id) ON DELETE CASCADE,

  CONSTRAINT fk_sync_jobs_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,

  CONSTRAINT chk_sync_jobs_provider
    CHECK (provider IN ('github')),

  CONSTRAINT chk_sync_jobs_job_type
    CHECK (job_type IN ('initial', 'incremental', 'manual')),

  CONSTRAINT chk_sync_jobs_status
    CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'RATE_LIMITED'))
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_connection
  ON public.sync_jobs (connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_user
  ON public.sync_jobs (user_id, status);


-- ==============================================================================
-- ROW LEVEL SECURITY (Strict Clerk-aware user isolation)
-- ==============================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'integration_connections',
    'integration_oauth_states',
    'external_repositories',
    'external_activities',
    'sync_jobs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- SELECT
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR SELECT USING (
        auth.role() = 'service_role'
        OR user_id IN (SELECT p.id FROM public.profiles p WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub'))
      )$p$, t || '_select_policy', t);

    -- INSERT
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (
        auth.role() = 'service_role'
        OR user_id IN (SELECT p.id FROM public.profiles p WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub'))
      )$p$, t || '_insert_policy', t);

    -- UPDATE
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR UPDATE USING (
        auth.role() = 'service_role'
        OR user_id IN (SELECT p.id FROM public.profiles p WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub'))
      ) WITH CHECK (
        auth.role() = 'service_role'
        OR user_id IN (SELECT p.id FROM public.profiles p WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub'))
      )$p$, t || '_update_policy', t);

    -- DELETE
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR DELETE USING (
        auth.role() = 'service_role'
        OR user_id IN (SELECT p.id FROM public.profiles p WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub'))
      )$p$, t || '_delete_policy', t);
  END LOOP;
END
$$;
