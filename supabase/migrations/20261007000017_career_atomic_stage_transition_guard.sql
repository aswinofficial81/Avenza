-- ==============================================================================
-- Migration: 20261007000017_career_atomic_stage_transition_guard.sql
-- Description: Hardens career_update_application_stage_with_history with atomic
--              row locking (FOR UPDATE), expected_stage concurrency guard, and
--              database-level lifecycle/terminal state validation.
-- ==============================================================================

-- 1. Drop existing overload so that no stale signature remains
DROP FUNCTION IF EXISTS public.career_update_application_stage_with_history(
  UUID,
  UUID,
  public.career_application_stage,
  TEXT
);

-- 2. Create updated career_update_application_stage_with_history with p_expected_stage and row locking
CREATE OR REPLACE FUNCTION public.career_update_application_stage_with_history(
  p_user_id UUID,
  p_application_id UUID,
  p_new_stage public.career_application_stage,
  p_notes TEXT DEFAULT NULL,
  p_expected_stage public.career_application_stage DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_app public.career_applications;
  v_hist public.career_application_history;
  v_from_stage public.career_application_stage;
BEGIN
  -- Acquire exclusive row lock on the target application row
  SELECT * INTO v_app
  FROM public.career_applications
  WHERE id = p_application_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Career application not found' USING ERRCODE = 'P0002';
  END IF;

  v_from_stage := v_app.stage;

  -- Atomic concurrency guard: verify persisted stage matches p_expected_stage
  IF p_expected_stage IS NOT NULL AND v_from_stage <> p_expected_stage THEN
    RAISE EXCEPTION 'Application stage conflict: current stage is %, expected %', v_from_stage, p_expected_stage
      USING ERRCODE = 'P0001';
  END IF;

  -- Atomic terminal state restriction: terminal states cannot transition
  IF v_from_stage IN ('accepted', 'declined', 'rejected', 'withdrawn', 'closed') THEN
    RAISE EXCEPTION 'Cannot transition application from terminal stage %', v_from_stage
      USING ERRCODE = 'P0001';
  END IF;

  -- Atomic lifecycle validation
  IF NOT (
    (v_from_stage = 'saved' AND p_new_stage IN ('applied', 'withdrawn', 'closed')) OR
    (v_from_stage = 'applied' AND p_new_stage IN ('screening', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn', 'closed')) OR
    (v_from_stage = 'screening' AND p_new_stage IN ('assessment', 'interview', 'offer', 'rejected', 'withdrawn', 'closed')) OR
    (v_from_stage = 'assessment' AND p_new_stage IN ('interview', 'offer', 'rejected', 'withdrawn', 'closed')) OR
    (v_from_stage = 'interview' AND p_new_stage IN ('assessment', 'interview', 'offer', 'rejected', 'withdrawn', 'closed')) OR
    (v_from_stage = 'offer' AND p_new_stage IN ('accepted', 'declined', 'withdrawn'))
  ) THEN
    RAISE EXCEPTION 'Illegal stage transition from % to %', v_from_stage, p_new_stage
      USING ERRCODE = 'P0001';
  END IF;

  -- Update application state and timestamp atomically
  UPDATE public.career_applications
  SET
    stage = p_new_stage,
    applied_at = CASE
      WHEN p_new_stage = 'applied' AND applied_at IS NULL THEN pg_catalog.now()
      ELSE applied_at
    END,
    updated_at = pg_catalog.now()
  WHERE id = p_application_id AND user_id = p_user_id
  RETURNING * INTO v_app;

  -- Insert immutable audit history record atomically
  INSERT INTO public.career_application_history (
    user_id,
    application_id,
    from_stage,
    to_stage,
    notes
  ) VALUES (
    p_user_id,
    p_application_id,
    v_from_stage,
    p_new_stage,
    p_notes
  )
  RETURNING * INTO v_hist;

  RETURN pg_catalog.jsonb_build_object(
    'application', pg_catalog.to_jsonb(v_app),
    'history', pg_catalog.to_jsonb(v_hist)
  );
END;
$$;

-- 3. Restrict permissions: Revoke from untrusted roles and grant only to service_role
REVOKE EXECUTE ON FUNCTION public.career_update_application_stage_with_history(
  UUID,
  UUID,
  public.career_application_stage,
  TEXT,
  public.career_application_stage
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.career_update_application_stage_with_history(
  UUID,
  UUID,
  public.career_application_stage,
  TEXT,
  public.career_application_stage
) TO service_role;
