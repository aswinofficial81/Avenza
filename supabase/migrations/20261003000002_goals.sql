-- ==============================================================================
-- AVENZA GOALS & MILESTONES MIGRATION
-- Phase 5: Complete Foundational Goals System + RLS
-- ==============================================================================

-- 1. Goals Table
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  priority TEXT NOT NULL DEFAULT 'medium',
  start_date TIMESTAMPTZ,
  target_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  desired_outcome TEXT,
  completion_criteria TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key Constraint: strictly owned by profile with CASCADE on profile deletion
  CONSTRAINT fk_goals_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  -- Bounded non-empty title
  CONSTRAINT chk_goals_title_non_empty
    CHECK (length(trim(title)) > 0 AND length(title) <= 255),

  -- Bounded text descriptions
  CONSTRAINT chk_goals_description_length
    CHECK (description IS NULL OR length(description) <= 2000),

  CONSTRAINT chk_goals_desired_outcome_length
    CHECK (desired_outcome IS NULL OR length(desired_outcome) <= 2000),

  CONSTRAINT chk_goals_completion_criteria_length
    CHECK (completion_criteria IS NULL OR length(completion_criteria) <= 2000),

  CONSTRAINT chk_goals_notes_length
    CHECK (notes IS NULL OR length(notes) <= 5000),

  -- Valid Goal Types
  CONSTRAINT chk_goals_goal_type
    CHECK (goal_type IN ('academic', 'learning', 'career', 'project', 'personal', 'custom')),

  -- Valid Lifecycle Statuses
  CONSTRAINT chk_goals_status
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),

  -- Valid Priorities
  CONSTRAINT chk_goals_priority
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Date ordering: target_date >= start_date where both exist
  CONSTRAINT chk_goals_dates
    CHECK (target_date IS NULL OR start_date IS NULL OR target_date >= start_date)
);

-- Indexes for frequent query patterns
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON public.goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_goals_user_target_date ON public.goals(user_id, target_date);
CREATE INDEX IF NOT EXISTS idx_goals_user_priority ON public.goals(user_id, priority);

-- Attach updated_at trigger to goals
DROP TRIGGER IF EXISTS set_goals_updated_at ON public.goals;
CREATE TRIGGER set_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Goal Milestones Table
CREATE TABLE IF NOT EXISTS public.goal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  order_index INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ,
  target_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key Constraint: owned by parent goal with CASCADE on goal deletion
  CONSTRAINT fk_goal_milestones_goal_id
    FOREIGN KEY (goal_id)
    REFERENCES public.goals(id)
    ON DELETE CASCADE,

  -- Bounded non-empty title
  CONSTRAINT chk_milestones_title_non_empty
    CHECK (length(trim(title)) > 0 AND length(title) <= 255),

  -- Bounded description
  CONSTRAINT chk_milestones_description_length
    CHECK (description IS NULL OR length(description) <= 2000),

  -- Valid Milestone Statuses
  CONSTRAINT chk_milestones_status
    CHECK (status IN ('pending', 'active', 'completed', 'skipped')),

  -- Valid Priorities
  CONSTRAINT chk_milestones_priority
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Non-negative order index
  CONSTRAINT chk_milestones_order_index
    CHECK (order_index >= 0),

  -- Date ordering: target_date >= start_date where both exist
  CONSTRAINT chk_milestones_dates
    CHECK (target_date IS NULL OR start_date IS NULL OR target_date >= start_date)
);

-- Indexes for milestone lookups and ordering
CREATE INDEX IF NOT EXISTS idx_milestones_goal_id ON public.goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_goal_order ON public.goal_milestones(goal_id, order_index);

-- Attach updated_at trigger to goal_milestones
DROP TRIGGER IF EXISTS set_goal_milestones_updated_at ON public.goal_milestones;
CREATE TRIGGER set_goal_milestones_updated_at
  BEFORE UPDATE ON public.goal_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: public.goals
CREATE POLICY "goals_select_policy"
  ON public.goals
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "goals_insert_policy"
  ON public.goals
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "goals_update_policy"
  ON public.goals
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

CREATE POLICY "goals_delete_policy"
  ON public.goals
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

-- 5. RLS Policies: public.goal_milestones
CREATE POLICY "goal_milestones_select_policy"
  ON public.goal_milestones
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR goal_id IN (
      SELECT g.id FROM public.goals g
      JOIN public.profiles p ON p.id = g.user_id
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "goal_milestones_insert_policy"
  ON public.goal_milestones
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR goal_id IN (
      SELECT g.id FROM public.goals g
      JOIN public.profiles p ON p.id = g.user_id
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "goal_milestones_update_policy"
  ON public.goal_milestones
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR goal_id IN (
      SELECT g.id FROM public.goals g
      JOIN public.profiles p ON p.id = g.user_id
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR goal_id IN (
      SELECT g.id FROM public.goals g
      JOIN public.profiles p ON p.id = g.user_id
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "goal_milestones_delete_policy"
  ON public.goal_milestones
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR goal_id IN (
      SELECT g.id FROM public.goals g
      JOIN public.profiles p ON p.id = g.user_id
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );
