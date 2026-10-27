-- ==============================================================================
-- AVENZA ACCOUNT DELETION RECOVERY & EXPORT CONCURRENCY LEASES
-- Phase 17B-2 Remediation: Durable recovery jobs and distributed export leases
-- ==============================================================================

-- 1. Account Deletion Recovery Jobs Table
-- Durable queue for retrying failed external OAuth revocations and storage purges
-- Profile ID has NO foreign key so jobs survive cascading profile deletion.
CREATE TABLE IF NOT EXISTS public.account_deletion_recovery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  clerk_user_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ NULL,
  locked_by TEXT NULL,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,

  CONSTRAINT chk_recovery_job_type
    CHECK (job_type IN ('PROVIDER_REVOCATION', 'STORAGE_PURGE')),

  CONSTRAINT chk_recovery_job_status
    CHECK (status IN ('PENDING', 'PROCESSING', 'RETRYING', 'COMPLETED', 'TERMINAL_FAILURE'))
);

CREATE INDEX IF NOT EXISTS idx_recovery_jobs_status_next_attempt
  ON public.account_deletion_recovery_jobs(status, next_attempt_at)
  WHERE status IN ('PENDING', 'RETRYING', 'PROCESSING');

CREATE INDEX IF NOT EXISTS idx_recovery_jobs_profile_id
  ON public.account_deletion_recovery_jobs(profile_id);

ALTER TABLE public.account_deletion_recovery_jobs ENABLE ROW LEVEL SECURITY;

-- Atomic job claim function using FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_deletion_recovery_jobs(
  p_worker_id TEXT,
  p_batch_size INT DEFAULT 10,
  p_lock_duration_seconds INT DEFAULT 300
)
RETURNS SETOF public.account_deletion_recovery_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM public.account_deletion_recovery_jobs
    WHERE (
      (status IN ('PENDING', 'RETRYING') AND next_attempt_at <= pg_catalog.now())
      OR (status = 'PROCESSING' AND locked_until IS NOT NULL AND locked_until < pg_catalog.now())
    )
    ORDER BY next_attempt_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.account_deletion_recovery_jobs j
  SET
    status = 'PROCESSING',
    locked_by = p_worker_id,
    locked_until = pg_catalog.now() + (p_lock_duration_seconds || ' seconds')::interval,
    attempt_count = j.attempt_count + 1,
    updated_at = pg_catalog.now()
  FROM claimable
  WHERE j.id = claimable.id
  RETURNING j.*;
END;
$$;

-- 2. Account Export Distributed Leases Table
-- Prevents concurrent export execution across multiple horizontal API instances
CREATE TABLE IF NOT EXISTS public.account_export_leases (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  lease_token UUID NOT NULL DEFAULT gen_random_uuid(),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_exported_at TIMESTAMPTZ NULL
);

ALTER TABLE public.account_export_leases ENABLE ROW LEVEL SECURITY;

-- Atomic export lease acquisition RPC
CREATE OR REPLACE FUNCTION public.acquire_account_export_lease(
  p_user_id UUID,
  p_lease_token UUID,
  p_lease_ttl_seconds INT DEFAULT 300,
  p_cooldown_seconds INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing RECORD;
  v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
  SELECT * INTO v_existing
  FROM public.account_export_leases
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF FOUND THEN
    -- Check if active unexpired lease exists
    IF v_existing.expires_at > v_now THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'CONCURRENT_EXPORT_IN_PROGRESS',
        'message', 'An account export is already currently in progress across API instances. Please wait.'
      );
    END IF;

    -- Check cooldown window
    IF v_existing.last_exported_at IS NOT NULL AND (v_now - v_existing.last_exported_at) < (p_cooldown_seconds || ' seconds')::interval THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'EXPORT_RATE_LIMITED',
        'message', 'Export rate limit reached. Please wait before generating a new export.',
        'retry_after_seconds', CEIL(EXTRACT(EPOCH FROM (v_existing.last_exported_at + (p_cooldown_seconds || ' seconds')::interval - v_now)))
      );
    END IF;

    -- Atomically update existing lease
    UPDATE public.account_export_leases
    SET
      lease_token = p_lease_token,
      acquired_at = v_now,
      expires_at = v_now + (p_lease_ttl_seconds || ' seconds')::interval
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('success', true);
  ELSE
    -- Atomically insert new lease
    INSERT INTO public.account_export_leases (user_id, lease_token, acquired_at, expires_at, last_exported_at)
    VALUES (p_user_id, p_lease_token, v_now, v_now + (p_lease_ttl_seconds || ' seconds')::interval, NULL);

    RETURN jsonb_build_object('success', true);
  END IF;
END;
$$;

-- Atomic export lease release RPC
CREATE OR REPLACE FUNCTION public.release_account_export_lease(
  p_user_id UUID,
  p_lease_token UUID,
  p_success BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
  UPDATE public.account_export_leases
  SET
    expires_at = v_now,
    last_exported_at = CASE WHEN p_success THEN v_now ELSE last_exported_at END
  WHERE user_id = p_user_id AND lease_token = p_lease_token;

  RETURN FOUND;
END;
$$;

-- Revoke execution from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public.claim_deletion_recovery_jobs(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acquire_account_export_lease(UUID, UUID, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_account_export_lease(UUID, UUID, BOOLEAN) FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.claim_deletion_recovery_jobs(TEXT, INT, INT) FROM anon;
    REVOKE ALL ON FUNCTION public.acquire_account_export_lease(UUID, UUID, INT, INT) FROM anon;
    REVOKE ALL ON FUNCTION public.release_account_export_lease(UUID, UUID, BOOLEAN) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.claim_deletion_recovery_jobs(TEXT, INT, INT) FROM authenticated;
    REVOKE ALL ON FUNCTION public.acquire_account_export_lease(UUID, UUID, INT, INT) FROM authenticated;
    REVOKE ALL ON FUNCTION public.release_account_export_lease(UUID, UUID, BOOLEAN) FROM authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.claim_deletion_recovery_jobs(TEXT, INT, INT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.acquire_account_export_lease(UUID, UUID, INT, INT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.release_account_export_lease(UUID, UUID, BOOLEAN) TO service_role;
  END IF;
END $$;
