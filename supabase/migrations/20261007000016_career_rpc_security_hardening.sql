-- ==============================================================================
-- AVENZA CAREER DOMAIN MIGRATION
-- Phase 16B Security Remediation: Search-Path Hardening & Least-Privilege Grants
-- ==============================================================================

-- 1. Hardened career_create_target (search_path = '', schema-qualified references)
CREATE OR REPLACE FUNCTION public.career_create_target(
  p_user_id UUID,
  p_title VARCHAR(150),
  p_target_role VARCHAR(100),
  p_target_locations TEXT[] DEFAULT '{}',
  p_employment_type public.career_employment_type DEFAULT NULL,
  p_target_date DATE DEFAULT NULL,
  p_min_compensation NUMERIC DEFAULT NULL,
  p_currency VARCHAR(3) DEFAULT NULL,
  p_is_primary BOOLEAN DEFAULT false,
  p_notes TEXT DEFAULT NULL,
  p_goal_id UUID DEFAULT NULL
)
RETURNS public.career_targets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_target public.career_targets;
BEGIN
  -- Validate goal ownership if goal_id is provided
  IF p_goal_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.goals
      WHERE id = p_goal_id AND user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'Referenced goal does not exist or belongs to another user';
    END IF;
  END IF;

  -- If setting is_primary = true, atomically unset any existing primary target
  -- within this transaction before inserting the new primary target.
  IF p_is_primary = TRUE THEN
    UPDATE public.career_targets
    SET is_primary = FALSE, updated_at = pg_catalog.now()
    WHERE user_id = p_user_id AND is_primary = TRUE;
  END IF;

  INSERT INTO public.career_targets (
    user_id,
    goal_id,
    title,
    target_role,
    target_locations,
    employment_type,
    target_date,
    min_compensation,
    currency,
    is_primary,
    notes
  ) VALUES (
    p_user_id,
    p_goal_id,
    pg_catalog.btrim(p_title),
    pg_catalog.btrim(p_target_role),
    COALESCE(p_target_locations, '{}'),
    p_employment_type,
    p_target_date,
    p_min_compensation,
    CASE WHEN p_currency IS NOT NULL THEN pg_catalog.upper(p_currency) ELSE NULL END,
    COALESCE(p_is_primary, FALSE),
    p_notes
  )
  RETURNING * INTO v_new_target;

  RETURN v_new_target;
END;
$$;


-- 2. Hardened career_set_target_primary (search_path = '', schema-qualified references)
CREATE OR REPLACE FUNCTION public.career_set_target_primary(
  p_user_id UUID,
  p_target_id UUID
)
RETURNS public.career_targets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target public.career_targets;
BEGIN
  -- Verify target exists and belongs to user
  SELECT * INTO v_target
  FROM public.career_targets
  WHERE id = p_target_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Career target not found';
  END IF;

  -- Unset previous primary for this user
  UPDATE public.career_targets
  SET is_primary = FALSE, updated_at = pg_catalog.now()
  WHERE user_id = p_user_id AND id != p_target_id AND is_primary = TRUE;

  -- Set target as primary
  UPDATE public.career_targets
  SET is_primary = TRUE, updated_at = pg_catalog.now()
  WHERE id = p_target_id AND user_id = p_user_id
  RETURNING * INTO v_target;

  RETURN v_target;
END;
$$;


-- 3. Hardened career_create_application (search_path = '', schema-qualified references)
CREATE OR REPLACE FUNCTION public.career_create_application(
  p_user_id UUID,
  p_opportunity_id UUID,
  p_stage public.career_application_stage DEFAULT 'saved',
  p_applied_at TIMESTAMPTZ DEFAULT NULL,
  p_deadline TIMESTAMPTZ DEFAULT NULL,
  p_resume_file_url TEXT DEFAULT NULL,
  p_cover_letter_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL,
  p_history_notes TEXT DEFAULT 'Initial application entry created'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_app public.career_applications;
  v_hist public.career_application_history;
  v_stage public.career_application_stage;
BEGIN
  -- Verify opportunity exists and belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM public.career_opportunities
    WHERE id = p_opportunity_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Career opportunity not found or belongs to another user';
  END IF;

  -- Check for existing application for this opportunity
  IF EXISTS (
    SELECT 1 FROM public.career_applications
    WHERE opportunity_id = p_opportunity_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'An application already exists for this opportunity';
  END IF;

  v_stage := COALESCE(p_stage, 'saved'::public.career_application_stage);

  INSERT INTO public.career_applications (
    user_id,
    opportunity_id,
    stage,
    applied_at,
    deadline,
    resume_file_url,
    cover_letter_url,
    notes,
    rejection_reason
  ) VALUES (
    p_user_id,
    p_opportunity_id,
    v_stage,
    p_applied_at,
    p_deadline,
    p_resume_file_url,
    p_cover_letter_url,
    p_notes,
    p_rejection_reason
  )
  RETURNING * INTO v_app;

  INSERT INTO public.career_application_history (
    user_id,
    application_id,
    from_stage,
    to_stage,
    notes
  ) VALUES (
    p_user_id,
    v_app.id,
    NULL,
    v_stage,
    COALESCE(p_history_notes, 'Initial application entry created')
  )
  RETURNING * INTO v_hist;

  RETURN pg_catalog.jsonb_build_object(
    'application', pg_catalog.to_jsonb(v_app),
    'history', pg_catalog.to_jsonb(v_hist)
  );
END;
$$;


-- 4. Hardened career_update_application_stage_with_history (search_path = '', schema-qualified references)
CREATE OR REPLACE FUNCTION public.career_update_application_stage_with_history(
  p_user_id UUID,
  p_application_id UUID,
  p_new_stage public.career_application_stage,
  p_notes TEXT DEFAULT NULL
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
  SELECT * INTO v_app
  FROM public.career_applications
  WHERE id = p_application_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Career application not found';
  END IF;

  v_from_stage := v_app.stage;

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


-- 5. Revoke execution from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public.career_create_target(UUID, VARCHAR, VARCHAR, TEXT[], public.career_employment_type, DATE, NUMERIC, VARCHAR, BOOLEAN, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.career_set_target_primary(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.career_create_application(UUID, UUID, public.career_application_stage, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.career_update_application_stage_with_history(UUID, UUID, public.career_application_stage, TEXT) FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.career_create_target(UUID, VARCHAR, VARCHAR, TEXT[], public.career_employment_type, DATE, NUMERIC, VARCHAR, BOOLEAN, TEXT, UUID) FROM anon;
    REVOKE ALL ON FUNCTION public.career_set_target_primary(UUID, UUID) FROM anon;
    REVOKE ALL ON FUNCTION public.career_create_application(UUID, UUID, public.career_application_stage, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
    REVOKE ALL ON FUNCTION public.career_update_application_stage_with_history(UUID, UUID, public.career_application_stage, TEXT) FROM anon;
  END IF;

  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.career_create_target(UUID, VARCHAR, VARCHAR, TEXT[], public.career_employment_type, DATE, NUMERIC, VARCHAR, BOOLEAN, TEXT, UUID) FROM authenticated;
    REVOKE ALL ON FUNCTION public.career_set_target_primary(UUID, UUID) FROM authenticated;
    REVOKE ALL ON FUNCTION public.career_create_application(UUID, UUID, public.career_application_stage, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT) FROM authenticated;
    REVOKE ALL ON FUNCTION public.career_update_application_stage_with_history(UUID, UUID, public.career_application_stage, TEXT) FROM authenticated;
  END IF;

  -- 6. Grant execution strictly to service_role
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.career_create_target(UUID, VARCHAR, VARCHAR, TEXT[], public.career_employment_type, DATE, NUMERIC, VARCHAR, BOOLEAN, TEXT, UUID) TO service_role;
    GRANT EXECUTE ON FUNCTION public.career_set_target_primary(UUID, UUID) TO service_role;
    GRANT EXECUTE ON FUNCTION public.career_create_application(UUID, UUID, public.career_application_stage, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.career_update_application_stage_with_history(UUID, UUID, public.career_application_stage, TEXT) TO service_role;
  END IF;
END $$;
