-- ==============================================================================
-- AVENZA RPC SECURITY HARDENING & DURABLE REPLAY PROTECTION
-- Phase 17B-2 Remediation: Least-privilege grants, empty search_path, and
-- database-backed atomic token replay prevention.
-- ==============================================================================

-- 1. Hardened claim_deletion_recovery_jobs (search_path = '', schema-qualified)
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

-- 2. Hardened acquire_account_export_lease (search_path = '', schema-qualified)
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
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'code', 'CONCURRENT_EXPORT_IN_PROGRESS',
        'message', 'An account export is already currently in progress across API instances. Please wait.'
      );
    END IF;

    -- Check cooldown window
    IF v_existing.last_exported_at IS NOT NULL AND (v_now - v_existing.last_exported_at) < (p_cooldown_seconds || ' seconds')::interval THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'code', 'EXPORT_RATE_LIMITED',
        'message', 'Export rate limit reached. Please wait before generating a new export.',
        'retry_after_seconds', pg_catalog.ceil(EXTRACT(EPOCH FROM (v_existing.last_exported_at + (p_cooldown_seconds || ' seconds')::interval - v_now)))
      );
    END IF;

    -- Atomically update existing lease
    UPDATE public.account_export_leases
    SET
      lease_token = p_lease_token,
      acquired_at = v_now,
      expires_at = v_now + (p_lease_ttl_seconds || ' seconds')::interval
    WHERE user_id = p_user_id;

    RETURN pg_catalog.jsonb_build_object('success', true);
  ELSE
    -- Atomically insert new lease
    INSERT INTO public.account_export_leases (user_id, lease_token, acquired_at, expires_at, last_exported_at)
    VALUES (p_user_id, p_lease_token, v_now, v_now + (p_lease_ttl_seconds || ' seconds')::interval, NULL);

    RETURN pg_catalog.jsonb_build_object('success', true);
  END IF;
END;
$$;

-- 3. Hardened release_account_export_lease (search_path = '', schema-qualified)
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

-- 4. Durable consumed re-authentication token storage
CREATE TABLE IF NOT EXISTS public.consumed_reauth_tokens (
  token_digest TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_consumed_reauth_tokens_expires_at
  ON public.consumed_reauth_tokens(expires_at);

ALTER TABLE public.consumed_reauth_tokens ENABLE ROW LEVEL SECURITY;

-- Atomic token consumption function
CREATE OR REPLACE FUNCTION public.consume_reauth_token(
  p_token_digest TEXT,
  p_user_id UUID,
  p_expires_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted BOOLEAN := FALSE;
BEGIN
  -- Lazy cleanup of expired tokens
  DELETE FROM public.consumed_reauth_tokens
  WHERE expires_at < pg_catalog.now();

  -- Attempt atomic insert
  INSERT INTO public.consumed_reauth_tokens (token_digest, user_id, expires_at, created_at)
  VALUES (p_token_digest, p_user_id, p_expires_at, pg_catalog.now())
  ON CONFLICT (token_digest) DO NOTHING;

  IF FOUND THEN
    v_inserted := TRUE;
  END IF;

  RETURN v_inserted;
END;
$$;

-- 5. Revoke execution from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public.claim_deletion_recovery_jobs(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acquire_account_export_lease(UUID, UUID, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_account_export_lease(UUID, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_reauth_token(TEXT, UUID, TIMESTAMPTZ) FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.claim_deletion_recovery_jobs(TEXT, INT, INT) FROM anon;
    REVOKE ALL ON FUNCTION public.acquire_account_export_lease(UUID, UUID, INT, INT) FROM anon;
    REVOKE ALL ON FUNCTION public.release_account_export_lease(UUID, UUID, BOOLEAN) FROM anon;
    REVOKE ALL ON FUNCTION public.consume_reauth_token(TEXT, UUID, TIMESTAMPTZ) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.claim_deletion_recovery_jobs(TEXT, INT, INT) FROM authenticated;
    REVOKE ALL ON FUNCTION public.acquire_account_export_lease(UUID, UUID, INT, INT) FROM authenticated;
    REVOKE ALL ON FUNCTION public.release_account_export_lease(UUID, UUID, BOOLEAN) FROM authenticated;
    REVOKE ALL ON FUNCTION public.consume_reauth_token(TEXT, UUID, TIMESTAMPTZ) FROM authenticated;
  END IF;

  -- 6. Grant execution strictly to service_role
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.claim_deletion_recovery_jobs(TEXT, INT, INT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.acquire_account_export_lease(UUID, UUID, INT, INT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.release_account_export_lease(UUID, UUID, BOOLEAN) TO service_role;
    GRANT EXECUTE ON FUNCTION public.consume_reauth_token(TEXT, UUID, TIMESTAMPTZ) TO service_role;
  END IF;
END $$;
