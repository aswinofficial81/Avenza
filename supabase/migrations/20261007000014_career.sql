-- ==============================================================================
-- AVENZA CAREER DOMAIN MIGRATION
-- Phase 16A: Career Database Foundation, Relationships, Integrity & RLS
-- ==============================================================================

-- 1. Create Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'career_employment_type') THEN
    CREATE TYPE public.career_employment_type AS ENUM (
      'internship',
      'full_time',
      'contract',
      'part_time',
      'co_op'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'career_location_type') THEN
    CREATE TYPE public.career_location_type AS ENUM (
      'remote',
      'hybrid',
      'onsite'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'career_opportunity_source') THEN
    CREATE TYPE public.career_opportunity_source AS ENUM (
      'linkedin',
      'indeed',
      'company_website',
      'referral',
      'career_fair',
      'cold_outreach',
      'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'career_opportunity_status') THEN
    CREATE TYPE public.career_opportunity_status AS ENUM (
      'active',
      'archived',
      'expired'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'career_application_stage') THEN
    CREATE TYPE public.career_application_stage AS ENUM (
      'saved',
      'applied',
      'screening',
      'assessment',
      'interview',
      'offer',
      'accepted',
      'declined',
      'rejected',
      'withdrawn',
      'closed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'career_interview_type') THEN
    CREATE TYPE public.career_interview_type AS ENUM (
      'recruiter_screen',
      'technical_dsa',
      'system_design',
      'take_home_review',
      'hiring_manager',
      'behavioral',
      'executive',
      'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'career_interview_status') THEN
    CREATE TYPE public.career_interview_status AS ENUM (
      'scheduled',
      'completed',
      'cancelled',
      'rescheduled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'career_interview_result') THEN
    CREATE TYPE public.career_interview_result AS ENUM (
      'pending',
      'passed',
      'failed',
      'neutral'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'career_skill_importance') THEN
    CREATE TYPE public.career_skill_importance AS ENUM (
      'required',
      'preferred',
      'bonus'
    );
  END IF;
END $$;


-- 2. Career Targets Table
CREATE TABLE IF NOT EXISTS public.career_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal_id UUID NULL,
  title VARCHAR(150) NOT NULL,
  target_role VARCHAR(100) NOT NULL,
  target_locations TEXT[] NOT NULL DEFAULT '{}',
  employment_type public.career_employment_type NULL,
  target_date DATE NULL,
  min_compensation NUMERIC(12,2) NULL,
  currency VARCHAR(3) NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Keys
  CONSTRAINT fk_career_targets_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_career_targets_goal_id
    FOREIGN KEY (goal_id)
    REFERENCES public.goals(id)
    ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT chk_career_targets_title
    CHECK (length(trim(title)) > 0 AND length(title) <= 150),

  CONSTRAINT chk_career_targets_target_role
    CHECK (length(trim(target_role)) > 0 AND length(target_role) <= 100),

  CONSTRAINT chk_career_targets_min_compensation
    CHECK (min_compensation IS NULL OR min_compensation >= 0),

  CONSTRAINT chk_career_targets_currency
    CHECK (currency IS NULL OR (length(currency) = 3 AND currency ~* '^[a-z]{3}$')),

  CONSTRAINT chk_career_targets_notes
    CHECK (notes IS NULL OR length(notes) <= 10000)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_career_targets_user_id ON public.career_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_career_targets_user_primary ON public.career_targets(user_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_career_targets_goal_id ON public.career_targets(goal_id);

-- Enforce primary Career Target invariant: at most one primary target per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_career_targets_user_primary
  ON public.career_targets (user_id)
  WHERE is_primary = TRUE;

-- Attach updated_at trigger
DROP TRIGGER IF EXISTS set_career_targets_updated_at ON public.career_targets;
CREATE TRIGGER set_career_targets_updated_at
  BEFORE UPDATE ON public.career_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- 3. Career Target Skills Table
CREATE TABLE IF NOT EXISTS public.career_target_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  importance public.career_skill_importance NOT NULL DEFAULT 'required',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Keys
  CONSTRAINT fk_career_target_skills_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_career_target_skills_target_id
    FOREIGN KEY (target_id)
    REFERENCES public.career_targets(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_career_target_skills_skill_id
    FOREIGN KEY (skill_id)
    REFERENCES public.skills(id)
    ON DELETE RESTRICT,

  -- Unique Constraint
  CONSTRAINT uq_career_target_skills_target_skill
    UNIQUE (target_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_career_target_skills_user_id ON public.career_target_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_career_target_skills_user_target ON public.career_target_skills(user_id, target_id);
CREATE INDEX IF NOT EXISTS idx_career_target_skills_user_skill ON public.career_target_skills(user_id, skill_id);


-- 4. Career Opportunities Table
CREATE TABLE IF NOT EXISTS public.career_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_id UUID NULL,
  company_name VARCHAR(150) NOT NULL,
  role_title VARCHAR(150) NOT NULL,
  employment_type public.career_employment_type NULL,
  location_type public.career_location_type NULL,
  location VARCHAR(200) NULL,
  source public.career_opportunity_source NOT NULL DEFAULT 'other',
  job_url TEXT NULL,
  salary_min NUMERIC(12,2) NULL,
  salary_max NUMERIC(12,2) NULL,
  salary_currency VARCHAR(3) NULL,
  deadline TIMESTAMPTZ NULL,
  description TEXT NULL,
  status public.career_opportunity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Keys
  CONSTRAINT fk_career_opportunities_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_career_opportunities_target_id
    FOREIGN KEY (target_id)
    REFERENCES public.career_targets(id)
    ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT chk_career_opportunities_company_name
    CHECK (length(trim(company_name)) > 0 AND length(company_name) <= 150),

  CONSTRAINT chk_career_opportunities_role_title
    CHECK (length(trim(role_title)) > 0 AND length(role_title) <= 150),

  CONSTRAINT chk_career_opportunities_location
    CHECK (location IS NULL OR length(location) <= 200),

  CONSTRAINT chk_career_opportunities_salary_min
    CHECK (salary_min IS NULL OR salary_min >= 0),

  CONSTRAINT chk_career_opportunities_salary_max
    CHECK (salary_max IS NULL OR salary_max >= 0),

  CONSTRAINT chk_career_opportunities_salary_range
    CHECK (salary_max IS NULL OR salary_min IS NULL OR salary_max >= salary_min),

  CONSTRAINT chk_career_opportunities_salary_currency
    CHECK (salary_currency IS NULL OR (length(salary_currency) = 3 AND salary_currency ~* '^[a-z]{3}$')),

  CONSTRAINT chk_career_opportunities_job_url
    CHECK (job_url IS NULL OR (job_url ~* '^https?://' AND length(job_url) <= 2048)),

  CONSTRAINT chk_career_opportunities_description
    CHECK (description IS NULL OR length(description) <= 10000)
);

CREATE INDEX IF NOT EXISTS idx_career_opportunities_user_id ON public.career_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_career_opportunities_user_status ON public.career_opportunities(user_id, status);
CREATE INDEX IF NOT EXISTS idx_career_opportunities_user_company ON public.career_opportunities(user_id, company_name);
CREATE INDEX IF NOT EXISTS idx_career_opportunities_user_target ON public.career_opportunities(user_id, target_id);

-- Attach updated_at trigger
DROP TRIGGER IF EXISTS set_career_opportunities_updated_at ON public.career_opportunities;
CREATE TRIGGER set_career_opportunities_updated_at
  BEFORE UPDATE ON public.career_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- 5. Career Opportunity Skills Table
CREATE TABLE IF NOT EXISTS public.career_opportunity_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  opportunity_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  importance public.career_skill_importance NOT NULL DEFAULT 'required',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Keys
  CONSTRAINT fk_career_opp_skills_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_career_opp_skills_opportunity_id
    FOREIGN KEY (opportunity_id)
    REFERENCES public.career_opportunities(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_career_opp_skills_skill_id
    FOREIGN KEY (skill_id)
    REFERENCES public.skills(id)
    ON DELETE RESTRICT,

  -- Unique Constraint
  CONSTRAINT uq_career_opportunity_skills_opp_skill
    UNIQUE (opportunity_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_career_opp_skills_user_opp ON public.career_opportunity_skills(user_id, opportunity_id);
CREATE INDEX IF NOT EXISTS idx_career_opp_skills_user_skill ON public.career_opportunity_skills(user_id, skill_id);


-- 6. Career Applications Table
CREATE TABLE IF NOT EXISTS public.career_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  opportunity_id UUID NOT NULL,
  stage public.career_application_stage NOT NULL DEFAULT 'saved',
  applied_at TIMESTAMPTZ NULL,
  deadline TIMESTAMPTZ NULL,
  resume_file_url TEXT NULL,
  cover_letter_url TEXT NULL,
  notes TEXT NULL,
  rejection_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Keys
  CONSTRAINT fk_career_applications_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_career_applications_opportunity_id
    FOREIGN KEY (opportunity_id)
    REFERENCES public.career_opportunities(id)
    ON DELETE CASCADE,

  -- Unique Constraint: one application per opportunity per user
  CONSTRAINT uq_career_applications_user_opportunity
    UNIQUE (user_id, opportunity_id),

  -- Constraints
  CONSTRAINT chk_career_applications_resume_url
    CHECK (resume_file_url IS NULL OR (resume_file_url ~* '^https?://' AND length(resume_file_url) <= 2048)),

  CONSTRAINT chk_career_applications_cover_letter_url
    CHECK (cover_letter_url IS NULL OR (cover_letter_url ~* '^https?://' AND length(cover_letter_url) <= 2048)),

  CONSTRAINT chk_career_applications_notes
    CHECK (notes IS NULL OR length(notes) <= 10000),

  CONSTRAINT chk_career_applications_rejection_reason
    CHECK (rejection_reason IS NULL OR length(rejection_reason) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_career_applications_user_stage ON public.career_applications(user_id, stage);
CREATE INDEX IF NOT EXISTS idx_career_applications_user_deadline ON public.career_applications(user_id, deadline);
CREATE INDEX IF NOT EXISTS idx_career_applications_user_opportunity ON public.career_applications(user_id, opportunity_id);
CREATE INDEX IF NOT EXISTS idx_career_applications_opportunity_id ON public.career_applications(opportunity_id);

-- Attach updated_at trigger
DROP TRIGGER IF EXISTS set_career_applications_updated_at ON public.career_applications;
CREATE TRIGGER set_career_applications_updated_at
  BEFORE UPDATE ON public.career_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- 7. Career Application History Table (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS public.career_application_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  application_id UUID NOT NULL,
  from_stage public.career_application_stage NULL,
  to_stage public.career_application_stage NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT NULL,

  -- Foreign Keys
  CONSTRAINT fk_career_app_history_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_career_app_history_application_id
    FOREIGN KEY (application_id)
    REFERENCES public.career_applications(id)
    ON DELETE CASCADE,

  CONSTRAINT chk_career_app_history_notes
    CHECK (notes IS NULL OR length(notes) <= 5000)
);

CREATE INDEX IF NOT EXISTS idx_career_app_history_user_app ON public.career_application_history(user_id, application_id);
CREATE INDEX IF NOT EXISTS idx_career_app_history_user_changed ON public.career_application_history(user_id, changed_at DESC);

-- Trigger to prevent direct UPDATE mutations on history (preserving immutable audit trail)
CREATE OR REPLACE FUNCTION public.prevent_career_app_history_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'career_application_history records are immutable and cannot be updated';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_career_app_history_mutation ON public.career_application_history;
CREATE TRIGGER trg_prevent_career_app_history_mutation
  BEFORE UPDATE ON public.career_application_history
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_career_app_history_mutation();


-- 8. Career Application Projects Relationship Table
CREATE TABLE IF NOT EXISTS public.career_application_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  application_id UUID NOT NULL,
  project_id UUID NOT NULL,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  talking_points TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Keys
  CONSTRAINT fk_career_app_projects_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_career_app_projects_application_id
    FOREIGN KEY (application_id)
    REFERENCES public.career_applications(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_career_app_projects_project_id
    FOREIGN KEY (project_id)
    REFERENCES public.projects(id)
    ON DELETE RESTRICT,

  -- Unique Constraint
  CONSTRAINT uq_career_app_projects_app_proj
    UNIQUE (application_id, project_id),

  CONSTRAINT chk_career_app_projects_talking_points
    CHECK (talking_points IS NULL OR length(talking_points) <= 5000)
);

CREATE INDEX IF NOT EXISTS idx_career_app_projects_user_app ON public.career_application_projects(user_id, application_id);
CREATE INDEX IF NOT EXISTS idx_career_app_projects_user_proj ON public.career_application_projects(user_id, project_id);


-- 9. Career Interviews Table
CREATE TABLE IF NOT EXISTS public.career_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  application_id UUID NOT NULL,
  round_number INTEGER NOT NULL DEFAULT 1,
  round_type public.career_interview_type NOT NULL DEFAULT 'recruiter_screen',
  scheduled_at TIMESTAMPTZ NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 45,
  meeting_link TEXT NULL,
  status public.career_interview_status NOT NULL DEFAULT 'scheduled',
  result public.career_interview_result NOT NULL DEFAULT 'pending',
  interviewer_names TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Keys
  CONSTRAINT fk_career_interviews_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_career_interviews_application_id
    FOREIGN KEY (application_id)
    REFERENCES public.career_applications(id)
    ON DELETE CASCADE,

  -- Constraints
  CONSTRAINT chk_career_interviews_round_number
    CHECK (round_number > 0),

  CONSTRAINT chk_career_interviews_duration_minutes
    CHECK (duration_minutes > 0),

  CONSTRAINT chk_career_interviews_meeting_link
    CHECK (meeting_link IS NULL OR (meeting_link ~* '^https?://' AND length(meeting_link) <= 2048)),

  CONSTRAINT chk_career_interviews_notes
    CHECK (notes IS NULL OR length(notes) <= 10000)
);

CREATE INDEX IF NOT EXISTS idx_career_interviews_user_scheduled ON public.career_interviews(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_career_interviews_user_app ON public.career_interviews(user_id, application_id);

-- Attach updated_at trigger
DROP TRIGGER IF EXISTS set_career_interviews_updated_at ON public.career_interviews;
CREATE TRIGGER set_career_interviews_updated_at
  BEFORE UPDATE ON public.career_interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- 10. Tasks Integration (Career Applications Link)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS application_id UUID NULL REFERENCES public.career_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_user_application_id ON public.tasks(user_id, application_id);


-- ==============================================================================
-- 11. Same-User Ownership Triggers
-- ==============================================================================

-- 11a. Career Target -> Goal ownership match
CREATE OR REPLACE FUNCTION public.check_career_target_goal_user_match()
RETURNS TRIGGER AS $$
DECLARE
  goal_owner UUID;
BEGIN
  IF NEW.goal_id IS NOT NULL THEN
    SELECT user_id INTO goal_owner FROM public.goals WHERE id = NEW.goal_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced goal does not exist';
    END IF;

    IF goal_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'Referenced goal must belong to the same user as the career target';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_career_target_goal_user_match ON public.career_targets;
CREATE TRIGGER trg_check_career_target_goal_user_match
  BEFORE INSERT OR UPDATE OF goal_id, user_id
  ON public.career_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.check_career_target_goal_user_match();


-- 11b. Career Target Skill -> Target & Skill ownership match
CREATE OR REPLACE FUNCTION public.check_career_target_skill_user_match()
RETURNS TRIGGER AS $$
DECLARE
  target_owner UUID;
  skill_owner UUID;
BEGIN
  SELECT user_id INTO target_owner FROM public.career_targets WHERE id = NEW.target_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced career target does not exist';
  END IF;

  SELECT user_id INTO skill_owner FROM public.skills WHERE id = NEW.skill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced skill does not exist';
  END IF;

  IF NEW.user_id <> target_owner OR NEW.user_id <> skill_owner THEN
    RAISE EXCEPTION 'User ID must match across career target, skill, and relationship record';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_career_target_skill_user_match ON public.career_target_skills;
CREATE TRIGGER trg_check_career_target_skill_user_match
  BEFORE INSERT OR UPDATE
  ON public.career_target_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.check_career_target_skill_user_match();


-- 11c. Career Opportunity -> Target ownership match
CREATE OR REPLACE FUNCTION public.check_career_opportunity_target_user_match()
RETURNS TRIGGER AS $$
DECLARE
  target_owner UUID;
BEGIN
  IF NEW.target_id IS NOT NULL THEN
    SELECT user_id INTO target_owner FROM public.career_targets WHERE id = NEW.target_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced career target does not exist';
    END IF;

    IF target_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'Referenced career target must belong to the same user as the career opportunity';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_career_opportunity_target_user_match ON public.career_opportunities;
CREATE TRIGGER trg_check_career_opportunity_target_user_match
  BEFORE INSERT OR UPDATE OF target_id, user_id
  ON public.career_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.check_career_opportunity_target_user_match();


-- 11d. Career Opportunity Skill -> Opportunity & Skill ownership match
CREATE OR REPLACE FUNCTION public.check_career_opportunity_skill_user_match()
RETURNS TRIGGER AS $$
DECLARE
  opp_owner UUID;
  skill_owner UUID;
BEGIN
  SELECT user_id INTO opp_owner FROM public.career_opportunities WHERE id = NEW.opportunity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced career opportunity does not exist';
  END IF;

  SELECT user_id INTO skill_owner FROM public.skills WHERE id = NEW.skill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced skill does not exist';
  END IF;

  IF NEW.user_id <> opp_owner OR NEW.user_id <> skill_owner THEN
    RAISE EXCEPTION 'User ID must match across career opportunity, skill, and relationship record';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_career_opportunity_skill_user_match ON public.career_opportunity_skills;
CREATE TRIGGER trg_check_career_opportunity_skill_user_match
  BEFORE INSERT OR UPDATE
  ON public.career_opportunity_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.check_career_opportunity_skill_user_match();


-- 11e. Career Application -> Opportunity ownership match
CREATE OR REPLACE FUNCTION public.check_career_application_opportunity_user_match()
RETURNS TRIGGER AS $$
DECLARE
  opp_owner UUID;
BEGIN
  SELECT user_id INTO opp_owner FROM public.career_opportunities WHERE id = NEW.opportunity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced career opportunity does not exist';
  END IF;

  IF opp_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'Career application must belong to the same user as the opportunity';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_career_application_opportunity_user_match ON public.career_applications;
CREATE TRIGGER trg_check_career_application_opportunity_user_match
  BEFORE INSERT OR UPDATE OF opportunity_id, user_id
  ON public.career_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.check_career_application_opportunity_user_match();


-- 11f. Career Application History -> Application ownership match
CREATE OR REPLACE FUNCTION public.check_career_app_history_user_match()
RETURNS TRIGGER AS $$
DECLARE
  app_owner UUID;
BEGIN
  SELECT user_id INTO app_owner FROM public.career_applications WHERE id = NEW.application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced career application does not exist';
  END IF;

  IF app_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'Career application history must belong to the same user as the application';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_career_app_history_user_match ON public.career_application_history;
CREATE TRIGGER trg_check_career_app_history_user_match
  BEFORE INSERT OR UPDATE OF application_id, user_id
  ON public.career_application_history
  FOR EACH ROW
  EXECUTE FUNCTION public.check_career_app_history_user_match();


-- 11g. Career Application Project -> Application & Project ownership match
CREATE OR REPLACE FUNCTION public.check_career_application_project_user_match()
RETURNS TRIGGER AS $$
DECLARE
  app_owner UUID;
  proj_owner UUID;
BEGIN
  SELECT user_id INTO app_owner FROM public.career_applications WHERE id = NEW.application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced career application does not exist';
  END IF;

  SELECT user_id INTO proj_owner FROM public.projects WHERE id = NEW.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced project does not exist';
  END IF;

  IF NEW.user_id <> app_owner OR NEW.user_id <> proj_owner THEN
    RAISE EXCEPTION 'User ID must match across career application, project, and relationship record';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_career_application_project_user_match ON public.career_application_projects;
CREATE TRIGGER trg_check_career_application_project_user_match
  BEFORE INSERT OR UPDATE
  ON public.career_application_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.check_career_application_project_user_match();


-- 11h. Career Interview -> Application ownership match
CREATE OR REPLACE FUNCTION public.check_career_interview_user_match()
RETURNS TRIGGER AS $$
DECLARE
  app_owner UUID;
BEGIN
  SELECT user_id INTO app_owner FROM public.career_applications WHERE id = NEW.application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced career application does not exist';
  END IF;

  IF app_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'Career interview must belong to the same user as the application';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_career_interview_user_match ON public.career_interviews;
CREATE TRIGGER trg_check_career_interview_user_match
  BEFORE INSERT OR UPDATE OF application_id, user_id
  ON public.career_interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.check_career_interview_user_match();


-- 11i. Task -> Career Application ownership match
CREATE OR REPLACE FUNCTION public.check_task_career_application_match()
RETURNS TRIGGER AS $$
DECLARE
  app_owner UUID;
BEGIN
  IF NEW.application_id IS NOT NULL THEN
    SELECT user_id INTO app_owner FROM public.career_applications WHERE id = NEW.application_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced career application does not exist';
    END IF;

    IF app_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'Referenced career application must belong to the same user as the task';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_task_career_application_match ON public.tasks;
CREATE TRIGGER trg_check_task_career_application_match
  BEFORE INSERT OR UPDATE OF application_id, user_id
  ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_task_career_application_match();


-- ==============================================================================
-- 12. Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.career_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_target_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_opportunity_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_application_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_application_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_interviews ENABLE ROW LEVEL SECURITY;

-- 12a. RLS Policies: public.career_targets
CREATE POLICY "career_targets_select_policy"
  ON public.career_targets
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_targets_insert_policy"
  ON public.career_targets
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_targets_update_policy"
  ON public.career_targets
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

CREATE POLICY "career_targets_delete_policy"
  ON public.career_targets
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );


-- 12b. RLS Policies: public.career_target_skills
CREATE POLICY "career_target_skills_select_policy"
  ON public.career_target_skills
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_target_skills_insert_policy"
  ON public.career_target_skills
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_target_skills_update_policy"
  ON public.career_target_skills
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

CREATE POLICY "career_target_skills_delete_policy"
  ON public.career_target_skills
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );


-- 12c. RLS Policies: public.career_opportunities
CREATE POLICY "career_opportunities_select_policy"
  ON public.career_opportunities
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_opportunities_insert_policy"
  ON public.career_opportunities
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_opportunities_update_policy"
  ON public.career_opportunities
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

CREATE POLICY "career_opportunities_delete_policy"
  ON public.career_opportunities
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );


-- 12d. RLS Policies: public.career_opportunity_skills
CREATE POLICY "career_opportunity_skills_select_policy"
  ON public.career_opportunity_skills
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_opportunity_skills_insert_policy"
  ON public.career_opportunity_skills
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_opportunity_skills_update_policy"
  ON public.career_opportunity_skills
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

CREATE POLICY "career_opportunity_skills_delete_policy"
  ON public.career_opportunity_skills
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );


-- 12e. RLS Policies: public.career_applications
CREATE POLICY "career_applications_select_policy"
  ON public.career_applications
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_applications_insert_policy"
  ON public.career_applications
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_applications_update_policy"
  ON public.career_applications
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

CREATE POLICY "career_applications_delete_policy"
  ON public.career_applications
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );


-- 12f. RLS Policies: public.career_application_history (Immutable audit trail)
CREATE POLICY "career_application_history_select_policy"
  ON public.career_application_history
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_application_history_insert_policy"
  ON public.career_application_history
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

-- Direct UPDATE and DELETE by ordinary users are prohibited to protect audit trail
CREATE POLICY "career_application_history_update_policy"
  ON public.career_application_history
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "career_application_history_delete_policy"
  ON public.career_application_history
  FOR DELETE
  USING (auth.role() = 'service_role');


-- 12g. RLS Policies: public.career_application_projects
CREATE POLICY "career_application_projects_select_policy"
  ON public.career_application_projects
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_application_projects_insert_policy"
  ON public.career_application_projects
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_application_projects_update_policy"
  ON public.career_application_projects
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

CREATE POLICY "career_application_projects_delete_policy"
  ON public.career_application_projects
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );


-- 12h. RLS Policies: public.career_interviews
CREATE POLICY "career_interviews_select_policy"
  ON public.career_interviews
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_interviews_insert_policy"
  ON public.career_interviews
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "career_interviews_update_policy"
  ON public.career_interviews
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

CREATE POLICY "career_interviews_delete_policy"
  ON public.career_interviews
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );
