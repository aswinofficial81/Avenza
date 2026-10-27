-- Phase 19C: Weekly Review
-- Stores user-authored reflections, not fabricated historical metrics.

CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',

  went_well TEXT NOT NULL DEFAULT '',
  challenges TEXT NOT NULL DEFAULT '',
  next_week_priority TEXT NOT NULL DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT weekly_reviews_unique_user_week
    UNIQUE (user_id, week_start),

  CONSTRAINT weekly_reviews_valid_week
    CHECK (week_end = week_start + 6),

  CONSTRAINT weekly_reviews_timezone_length
    CHECK (length(trim(timezone)) BETWEEN 1 AND 100),

  CONSTRAINT weekly_reviews_wins_length
    CHECK (length(went_well) <= 3000),

  CONSTRAINT weekly_reviews_challenges_length
    CHECK (length(challenges) <= 3000),

  CONSTRAINT weekly_reviews_priority_length
    CHECK (length(next_week_priority) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_week
  ON public.weekly_reviews (user_id, week_start DESC);

DROP TRIGGER IF EXISTS set_weekly_reviews_updated_at
  ON public.weekly_reviews;

CREATE TRIGGER set_weekly_reviews_updated_at
  BEFORE UPDATE ON public.weekly_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.weekly_reviews
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY weekly_reviews_select_policy
  ON public.weekly_reviews
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id
      FROM public.profiles p
      WHERE p.clerk_user_id = (SELECT auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY weekly_reviews_insert_policy
  ON public.weekly_reviews
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id
      FROM public.profiles p
      WHERE p.clerk_user_id = (SELECT auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY weekly_reviews_update_policy
  ON public.weekly_reviews
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id
      FROM public.profiles p
      WHERE p.clerk_user_id = (SELECT auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id
      FROM public.profiles p
      WHERE p.clerk_user_id = (SELECT auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY weekly_reviews_delete_policy
  ON public.weekly_reviews
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id
      FROM public.profiles p
      WHERE p.clerk_user_id = (SELECT auth.jwt() ->> 'sub')
    )
  );