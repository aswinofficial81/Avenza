-- ==============================================================================
-- AVENZA DATABASE FOUNDATION MIGRATION
-- Phase 2: Supabase PostgreSQL + Database Foundation + RLS
-- ==============================================================================

-- 1. Reusable trigger function for automatic updated_at timestamp tracking
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Profiles Table
-- Stores Avenza application-level user identity tied to Clerk user ID
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_profiles_clerk_user_id UNIQUE (clerk_user_id),
  CONSTRAINT chk_profiles_clerk_user_id_non_empty CHECK (length(trim(clerk_user_id)) > 0)
);

-- Index for fast lookup by Clerk User ID
CREATE INDEX IF NOT EXISTS idx_profiles_clerk_user_id ON public.profiles(clerk_user_id);

-- Attach updated_at trigger to profiles
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. User Preferences Table
-- Stores foundational user configurations and study scheduling targets
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  theme TEXT NOT NULL DEFAULT 'system',
  timezone TEXT,
  preferred_study_start TIME,
  preferred_study_end TIME,
  daily_minimum_minutes INTEGER NOT NULL DEFAULT 30,
  daily_target_minutes INTEGER NOT NULL DEFAULT 120,
  max_daily_study_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key Constraint: strictly owned 1:1 by profile with CASCADE on profile deletion
  CONSTRAINT fk_user_preferences_user_id 
    FOREIGN KEY (user_id) 
    REFERENCES public.profiles(id) 
    ON DELETE CASCADE,

  -- 1:1 Preference row per user
  CONSTRAINT uq_user_preferences_user_id UNIQUE (user_id),

  -- Theme validation
  CONSTRAINT chk_user_preferences_theme 
    CHECK (theme IN ('system', 'light', 'dark')),

  -- Non-negative minute constraints
  CONSTRAINT chk_daily_minimum_minutes_non_negative 
    CHECK (daily_minimum_minutes >= 0),

  CONSTRAINT chk_daily_target_minutes_non_negative 
    CHECK (daily_target_minutes >= 0),

  CONSTRAINT chk_max_daily_study_minutes_non_negative 
    CHECK (max_daily_study_minutes IS NULL OR max_daily_study_minutes >= 0),

  -- Target must be greater than or equal to minimum
  CONSTRAINT chk_target_gte_minimum 
    CHECK (daily_target_minutes >= daily_minimum_minutes),

  -- Max daily study must be greater than or equal to target if specified
  CONSTRAINT chk_max_gte_target 
    CHECK (max_daily_study_minutes IS NULL OR max_daily_study_minutes >= daily_target_minutes)
);

-- Index for foreign key lookup on user_preferences(user_id)
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Attach updated_at trigger to user_preferences
DROP TRIGGER IF EXISTS set_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER set_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: public.profiles
-- Supports authenticated Clerk JWT context (auth.jwt() ->> 'sub') and service_role fallback

CREATE POLICY "profiles_select_policy"
  ON public.profiles
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (select auth.jwt() ->> 'sub') = clerk_user_id
  );

CREATE POLICY "profiles_insert_policy"
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (select auth.jwt() ->> 'sub') = clerk_user_id
  );

CREATE POLICY "profiles_update_policy"
  ON public.profiles
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (select auth.jwt() ->> 'sub') = clerk_user_id
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (select auth.jwt() ->> 'sub') = clerk_user_id
  );

CREATE POLICY "profiles_delete_policy"
  ON public.profiles
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR (select auth.jwt() ->> 'sub') = clerk_user_id
  );

-- 6. RLS Policies: public.user_preferences
-- Enforces data isolation via parent profile ownership

CREATE POLICY "user_preferences_select_policy"
  ON public.user_preferences
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "user_preferences_insert_policy"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "user_preferences_update_policy"
  ON public.user_preferences
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

CREATE POLICY "user_preferences_delete_policy"
  ON public.user_preferences
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );
