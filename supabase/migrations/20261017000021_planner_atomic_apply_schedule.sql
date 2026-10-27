-- ==============================================================================
-- Migration: 20261017000021_planner_atomic_apply_schedule.sql
-- Description: Atomic PostgreSQL RPC for applying planned schedules in Phase 18D.
--              Guarantees ACID transaction semantics: locks affected tasks,
--              validates ownership, prevents stale concurrent overwrites,
--              enforces dependency prerequisites, prevents internal and external
--              schedule overlap, updates schedule fields, and rolls back
--              completely on any failure.
-- ==============================================================================

-- 1. Create atomic schedule application function
CREATE OR REPLACE FUNCTION public.planner_apply_schedule(
  p_user_id UUID,
  p_blocks JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_block RECORD;
  v_task RECORD;
  v_task_id UUID;
  v_scheduled_start TIMESTAMPTZ;
  v_scheduled_end TIMESTAMPTZ;
  v_expected_updated_at TIMESTAMPTZ;
  v_applied_count INT := 0;
  v_task_ids UUID[] := ARRAY[]::UUID[];
  v_incomplete_prereq_count INT;
  v_conflict_count INT;
  v_expected_duration_minutes INT;
  v_actual_duration_minutes INT;
BEGIN
  -- 1. Input Validation
  IF p_blocks IS NULL OR pg_catalog.jsonb_typeof(p_blocks) <> 'array' THEN
    RAISE EXCEPTION 'p_blocks must be a valid JSONB array' USING ERRCODE = '22023';
  END IF;

  IF pg_catalog.jsonb_array_length(p_blocks) = 0 THEN
    RETURN pg_catalog.json_build_object(
      'applied_count', 0,
      'task_ids', '[]'::jsonb
    );
  END IF;

  -- 1.5. Acquire per-user coordination lock on the user's profile row
  -- Serializes simultaneous schedule applications for the same user, preventing concurrent schedule overlaps
  PERFORM 1
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile % not found', p_user_id USING ERRCODE = 'P0002';
  END IF;

  -- 2. Verify no internal overlaps between proposed blocks in the payload
  SELECT pg_catalog.count(*)
  INTO v_conflict_count
  FROM (
    SELECT
      (b1.value->>'task_id')::UUID AS task_id_1,
      (b1.value->>'scheduled_start')::TIMESTAMPTZ AS start_1,
      (b1.value->>'scheduled_end')::TIMESTAMPTZ AS end_1,
      (b2.value->>'task_id')::UUID AS task_id_2,
      (b2.value->>'scheduled_start')::TIMESTAMPTZ AS start_2,
      (b2.value->>'scheduled_end')::TIMESTAMPTZ AS end_2
    FROM pg_catalog.jsonb_array_elements(p_blocks) WITH ORDINALITY AS b1(value, idx1)
    JOIN pg_catalog.jsonb_array_elements(p_blocks) WITH ORDINALITY AS b2(value, idx2)
      ON b1.idx1 < b2.idx2
  ) pairs
  WHERE pairs.start_1 < pairs.end_2 AND pairs.end_1 > pairs.start_2;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Payload contains overlapping schedule blocks' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Lock and validate all tasks in deterministic order (by task_id) to prevent deadlocks
  FOR v_block IN
    SELECT
      (elem->>'task_id')::UUID AS task_id,
      (elem->>'scheduled_start')::TIMESTAMPTZ AS scheduled_start,
      (elem->>'scheduled_end')::TIMESTAMPTZ AS scheduled_end,
      CASE
        WHEN elem ? 'expected_updated_at' AND elem->>'expected_updated_at' IS NOT NULL
        THEN (elem->>'expected_updated_at')::TIMESTAMPTZ
        ELSE NULL
      END AS expected_updated_at
    FROM pg_catalog.jsonb_array_elements(p_blocks) AS elem
    ORDER BY (elem->>'task_id')::UUID ASC
  LOOP
    v_task_id := v_block.task_id;
    v_scheduled_start := v_block.scheduled_start;
    v_scheduled_end := v_block.scheduled_end;
    v_expected_updated_at := v_block.expected_updated_at;

    IF v_scheduled_start >= v_scheduled_end THEN
      RAISE EXCEPTION 'Invalid block: scheduled_start must be before scheduled_end for task %', v_task_id
        USING ERRCODE = 'P0001';
    END IF;

    -- Invariant: Timestamps must be strictly aligned to whole-minute boundaries (zero seconds and fractional seconds)
    IF EXTRACT(SECOND FROM v_scheduled_start) <> 0 OR EXTRACT(SECOND FROM v_scheduled_end) <> 0 THEN
      RAISE EXCEPTION 'Schedule block timestamps for task % must be aligned to whole-minute boundaries (zero seconds and fractional seconds)',
        v_task_id
        USING ERRCODE = '22023';
    END IF;

    -- Acquire exclusive row lock on the task row
    SELECT * INTO v_task
    FROM public.tasks
    WHERE id = v_task_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Task % not found or belongs to another user', v_task_id
        USING ERRCODE = 'P0002';
    END IF;

    -- Invariant: Tasks in terminal or in-progress status cannot be scheduled
    IF v_task.status IN ('completed', 'cancelled', 'skipped', 'in_progress') THEN
      RAISE EXCEPTION 'Task % is in non-schedulable status (%) and cannot be scheduled', v_task_id, v_task.status
        USING ERRCODE = 'P0001';
    END IF;

    -- Invariant: Block duration must match task estimate (or canonical 30m default)
    v_expected_duration_minutes := COALESCE(NULLIF(v_task.estimated_minutes, 0), 30);
    v_actual_duration_minutes := (EXTRACT(EPOCH FROM (v_scheduled_end - v_scheduled_start)) / 60)::INT;

    IF v_actual_duration_minutes <> v_expected_duration_minutes THEN
      RAISE EXCEPTION 'Invalid block duration for task %: scheduled duration (%m) does not match task estimate (%m)',
        v_task_id, v_actual_duration_minutes, v_expected_duration_minutes
        USING ERRCODE = 'P0001';
    END IF;

    -- Concurrency guard: Stale proposal validation
    IF v_expected_updated_at IS NOT NULL AND v_task.updated_at <> v_expected_updated_at THEN
      RAISE EXCEPTION 'Stale proposal: task % was modified at % (expected %)',
        v_task_id, v_task.updated_at, v_expected_updated_at
        USING ERRCODE = 'P0001';
    END IF;

    -- Dependency guard: Incomplete prerequisites cannot be bypassed
    SELECT pg_catalog.count(*)
    INTO v_incomplete_prereq_count
    FROM public.task_dependencies d
    JOIN public.tasks prereq ON d.depends_on_task_id = prereq.id
    WHERE d.task_id = v_task_id
      AND prereq.status <> 'completed';

    IF v_incomplete_prereq_count > 0 THEN
      RAISE EXCEPTION 'Task % is blocked by % incomplete prerequisite(s)',
        v_task_id, v_incomplete_prereq_count
        USING ERRCODE = 'P0001';
    END IF;

    -- Conflict guard A: Check overlap against existing scheduled tasks (not in this batch)
    SELECT pg_catalog.count(*)
    INTO v_conflict_count
    FROM public.tasks other
    WHERE other.user_id = p_user_id
      AND other.id <> v_task_id
      AND other.scheduled_start IS NOT NULL
      AND other.scheduled_end IS NOT NULL
      AND other.status NOT IN ('completed', 'cancelled', 'skipped')
      AND other.scheduled_start < v_scheduled_end
      AND other.scheduled_end > v_scheduled_start
      AND other.id NOT IN (
        SELECT (b->>'task_id')::UUID
        FROM pg_catalog.jsonb_array_elements(p_blocks) b
      );

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Schedule conflict: task % overlaps with another scheduled task', v_task_id
        USING ERRCODE = 'P0001';
    END IF;

    -- Conflict guard B: Check overlap against confirmed busy external calendar events
    SELECT pg_catalog.count(*)
    INTO v_conflict_count
    FROM public.external_calendar_events cal
    WHERE cal.user_id = p_user_id
      AND cal.status = 'confirmed'
      AND cal.is_busy = TRUE
      AND cal.start_time < v_scheduled_end
      AND cal.end_time > v_scheduled_start;

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Schedule conflict: task % overlaps with an external busy calendar event', v_task_id
        USING ERRCODE = 'P0001';
    END IF;

    -- Apply update to this task
    UPDATE public.tasks
    SET
      scheduled_start = v_scheduled_start,
      scheduled_end = v_scheduled_end,
      status = 'scheduled',
      updated_at = pg_catalog.now()
    WHERE id = v_task_id;

    v_applied_count := v_applied_count + 1;
    v_task_ids := pg_catalog.array_append(v_task_ids, v_task_id);
  END LOOP;

  RETURN pg_catalog.json_build_object(
    'applied_count', v_applied_count,
    'task_ids', pg_catalog.to_jsonb(v_task_ids)
  );
END;
$$;

-- 2. Revoke execute privileges from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public.planner_apply_schedule(UUID, JSONB) FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.planner_apply_schedule(UUID, JSONB) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.planner_apply_schedule(UUID, JSONB) FROM authenticated;
  END IF;

  -- 3. Grant execution strictly to service_role (backend client)
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.planner_apply_schedule(UUID, JSONB) TO service_role;
  END IF;
END $$;
