-- ==============================================================================
-- AVENZA ACCOUNT LIFECYCLE & DELETION CASCADES MIGRATION
-- Phase 17B-2: Fix restrictive foreign keys and introduce deletion tombstone audit log
-- ==============================================================================

-- 1. career_target_skills: change skill_id foreign key from RESTRICT to CASCADE
ALTER TABLE public.career_target_skills
  DROP CONSTRAINT IF EXISTS fk_career_target_skills_skill_id;

ALTER TABLE public.career_target_skills
  ADD CONSTRAINT fk_career_target_skills_skill_id
    FOREIGN KEY (skill_id)
    REFERENCES public.skills(id)
    ON DELETE CASCADE;

-- 2. career_opportunity_skills: change skill_id foreign key from RESTRICT to CASCADE
ALTER TABLE public.career_opportunity_skills
  DROP CONSTRAINT IF EXISTS fk_career_opp_skills_skill_id;

ALTER TABLE public.career_opportunity_skills
  ADD CONSTRAINT fk_career_opp_skills_skill_id
    FOREIGN KEY (skill_id)
    REFERENCES public.skills(id)
    ON DELETE CASCADE;

-- 3. career_application_projects: change project_id foreign key from RESTRICT to CASCADE
ALTER TABLE public.career_application_projects
  DROP CONSTRAINT IF EXISTS fk_career_app_projects_project_id;

ALTER TABLE public.career_application_projects
  ADD CONSTRAINT fk_career_app_projects_project_id
    FOREIGN KEY (project_id)
    REFERENCES public.projects(id)
    ON DELETE CASCADE;

-- 4. Account Deletion Tombstones Table
-- Audit log and recovery record for account deletions (contains zero tokens, PII, or credentials)
CREATE TABLE IF NOT EXISTS public.account_deletion_tombstones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  clerk_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DELETED', -- 'DELETION_PENDING', 'PURGING', 'DELETED', 'FAILED'
  revocation_errors JSONB NULL,
  storage_errors JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,

  CONSTRAINT chk_deletion_status
    CHECK (status IN ('DELETION_PENDING', 'PURGING', 'DELETED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_deletion_tombstones_clerk_id
  ON public.account_deletion_tombstones(clerk_user_id);

CREATE INDEX IF NOT EXISTS idx_deletion_tombstones_profile_id
  ON public.account_deletion_tombstones(profile_id);

-- Enable RLS: service-role only access
ALTER TABLE public.account_deletion_tombstones ENABLE ROW LEVEL SECURITY;
