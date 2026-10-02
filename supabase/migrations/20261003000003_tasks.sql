-- ==============================================================================
-- AVENZA TASKS & TASK DEPENDENCIES MIGRATION
-- Phase 6: Foundational Tasks System + Dependencies + RLS
-- ==============================================================================

-- 1. Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'inbox',
  priority TEXT NOT NULL DEFAULT 'medium',
  task_type TEXT NOT NULL DEFAULT 'study',
  goal_id UUID,
  milestone_id UUID,
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  due_at TIMESTAMPTZ,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key: strictly owned by profile with CASCADE on profile deletion
  CONSTRAINT fk_tasks_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  -- Foreign Key: optional association to goals, preserved if goal is deleted
  CONSTRAINT fk_tasks_goal_id
    FOREIGN KEY (goal_id)
    REFERENCES public.goals(id)
    ON DELETE SET NULL,

  -- Foreign Key: optional association to milestones, preserved if milestone is deleted
  CONSTRAINT fk_tasks_milestone_id
    FOREIGN KEY (milestone_id)
    REFERENCES public.goal_milestones(id)
    ON DELETE SET NULL,

  -- Bounded non-empty title
  CONSTRAINT chk_tasks_title_non_empty
    CHECK (length(trim(title)) > 0 AND length(title) <= 255),

  -- Bounded text descriptions
  CONSTRAINT chk_tasks_description_length
    CHECK (description IS NULL OR length(description) <= 2000),

  CONSTRAINT chk_tasks_notes_length
    CHECK (notes IS NULL OR length(notes) <= 5000),

  -- Valid Lifecycle Statuses
  CONSTRAINT chk_tasks_status
    CHECK (status IN ('inbox', 'planned', 'scheduled', 'in_progress', 'completed', 'skipped', 'deferred', 'cancelled')),

  -- Valid Priorities
  CONSTRAINT chk_tasks_priority
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Valid Task Types
  CONSTRAINT chk_tasks_task_type
    CHECK (task_type IN ('study', 'practice', 'revision', 'assignment', 'exam_preparation', 'dsa', 'project', 'career', 'administrative', 'personal', 'custom')),

  -- Estimated minutes must be positive when provided
  CONSTRAINT chk_tasks_estimated_minutes_positive
    CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),

  -- Actual minutes must be non-negative when provided
  CONSTRAINT chk_tasks_actual_minutes_non_negative
    CHECK (actual_minutes IS NULL OR actual_minutes >= 0),

  -- Schedule order: scheduled_end >= scheduled_start when both exist
  CONSTRAINT chk_tasks_schedule_dates
    CHECK (scheduled_end IS NULL OR scheduled_start IS NULL OR scheduled_end >= scheduled_start)
);

-- Indexes for frequent query patterns
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON public.tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_at ON public.tasks(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_user_scheduled_start ON public.tasks(user_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_tasks_user_priority ON public.tasks(user_id, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_user_task_type ON public.tasks(user_id, task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_user_goal_id ON public.tasks(user_id, goal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_milestone_id ON public.tasks(user_id, milestone_id);

-- Attach updated_at trigger to tasks
DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Task Dependencies Table
CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  depends_on_task_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key Constraint: CASCADE on either task deletion
  CONSTRAINT fk_task_dependencies_task_id
    FOREIGN KEY (task_id)
    REFERENCES public.tasks(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_task_dependencies_depends_on_task_id
    FOREIGN KEY (depends_on_task_id)
    REFERENCES public.tasks(id)
    ON DELETE CASCADE,

  -- Unique pair constraint: prevent duplicate dependency definitions
  CONSTRAINT uq_task_dependencies_pair
    UNIQUE (task_id, depends_on_task_id),

  -- Prevent self-dependency
  CONSTRAINT chk_task_dependencies_no_self
    CHECK (task_id != depends_on_task_id)
);

-- Indexes for dependency lookups
CREATE INDEX IF NOT EXISTS idx_task_deps_task_id ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on ON public.task_dependencies(depends_on_task_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: public.tasks
CREATE POLICY "tasks_select_policy"
  ON public.tasks
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "tasks_insert_policy"
  ON public.tasks
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "tasks_update_policy"
  ON public.tasks
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

CREATE POLICY "tasks_delete_policy"
  ON public.tasks
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

-- 5. RLS Policies: public.task_dependencies
-- Requires that BOTH the task and its prerequisite belong to the authenticated user
CREATE POLICY "task_dependencies_select_policy"
  ON public.task_dependencies
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (
      task_id IN (
        SELECT t.id FROM public.tasks t
        JOIN public.profiles p ON p.id = t.user_id
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
      AND depends_on_task_id IN (
        SELECT t2.id FROM public.tasks t2
        JOIN public.profiles p2 ON p2.id = t2.user_id
        WHERE p2.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
    )
  );

CREATE POLICY "task_dependencies_insert_policy"
  ON public.task_dependencies
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      task_id IN (
        SELECT t.id FROM public.tasks t
        JOIN public.profiles p ON p.id = t.user_id
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
      AND depends_on_task_id IN (
        SELECT t2.id FROM public.tasks t2
        JOIN public.profiles p2 ON p2.id = t2.user_id
        WHERE p2.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
    )
  );

CREATE POLICY "task_dependencies_update_policy"
  ON public.task_dependencies
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (
      task_id IN (
        SELECT t.id FROM public.tasks t
        JOIN public.profiles p ON p.id = t.user_id
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
      AND depends_on_task_id IN (
        SELECT t2.id FROM public.tasks t2
        JOIN public.profiles p2 ON p2.id = t2.user_id
        WHERE p2.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      task_id IN (
        SELECT t.id FROM public.tasks t
        JOIN public.profiles p ON p.id = t.user_id
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
      AND depends_on_task_id IN (
        SELECT t2.id FROM public.tasks t2
        JOIN public.profiles p2 ON p2.id = t2.user_id
        WHERE p2.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
    )
  );

CREATE POLICY "task_dependencies_delete_policy"
  ON public.task_dependencies
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR (
      task_id IN (
        SELECT t.id FROM public.tasks t
        JOIN public.profiles p ON p.id = t.user_id
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
      AND depends_on_task_id IN (
        SELECT t2.id FROM public.tasks t2
        JOIN public.profiles p2 ON p2.id = t2.user_id
        WHERE p2.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
    )
  );
