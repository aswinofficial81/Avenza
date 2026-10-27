-- ==============================================================================
-- AVENZA EXTERNAL INTEGRATIONS MIGRATION - PHASE 14C: CODEFORCES
-- Extends provider check constraints to support 'codeforces' alongside 'github' and 'leetcode'
-- ==============================================================================

-- 1. Integration Connections
ALTER TABLE public.integration_connections
  DROP CONSTRAINT IF EXISTS chk_integration_connections_provider;

ALTER TABLE public.integration_connections
  ADD CONSTRAINT chk_integration_connections_provider
  CHECK (provider IN ('github', 'leetcode', 'codeforces'));

-- 2. OAuth States (for future parity if applicable)
ALTER TABLE public.integration_oauth_states
  DROP CONSTRAINT IF EXISTS chk_integration_oauth_states_provider;

ALTER TABLE public.integration_oauth_states
  ADD CONSTRAINT chk_integration_oauth_states_provider
  CHECK (provider IN ('github', 'leetcode', 'codeforces'));

-- 3. External Repositories (remains unused for Codeforces)
ALTER TABLE public.external_repositories
  DROP CONSTRAINT IF EXISTS chk_external_repositories_provider;

ALTER TABLE public.external_repositories
  ADD CONSTRAINT chk_external_repositories_provider
  CHECK (provider IN ('github', 'leetcode', 'codeforces'));

-- 4. External Activities (DSA solves, contest participations)
ALTER TABLE public.external_activities
  DROP CONSTRAINT IF EXISTS chk_external_activities_provider;

ALTER TABLE public.external_activities
  ADD CONSTRAINT chk_external_activities_provider
  CHECK (provider IN ('github', 'leetcode', 'codeforces'));

-- 5. Sync Jobs
ALTER TABLE public.sync_jobs
  DROP CONSTRAINT IF EXISTS chk_sync_jobs_provider;

ALTER TABLE public.sync_jobs
  ADD CONSTRAINT chk_sync_jobs_provider
  CHECK (provider IN ('github', 'leetcode', 'codeforces'));
