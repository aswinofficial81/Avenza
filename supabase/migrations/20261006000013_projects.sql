-- ==============================================================================
-- AVENZA PROJECTS DOMAIN MIGRATION
-- Phase 15A: Projects Foundation, Milestones, Relationships & Integrity + RLS
-- ==============================================================================

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'backlog',
  priority TEXT NOT NULL DEFAULT 'medium',
  project_type TEXT NOT NULL DEFAULT 'software',

  -- Optional link to Phase 14 GitHub synced external repository
  repository_id UUID NULL,

  -- Timeline and lifecycle
  start_date TIMESTAMPTZ NULL,
  target_date TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,

  -- Artifact metadata
  live_url TEXT NULL,
  architecture_notes TEXT NULL,
  tech_stack TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key: strictly owned by profile with CASCADE on profile deletion
  CONSTRAINT fk_projects_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  -- Foreign Key: linked external repository (preserves project if repository is deleted/disconnected)
  CONSTRAINT fk_projects_repository_id
    FOREIGN KEY (repository_id)
    REFERENCES public.external_repositories(id)
    ON DELETE SET NULL,

  -- Bounded title
  CONSTRAINT chk_projects_title_length
    CHECK (length(trim(title)) > 0 AND length(title) <= 255),

  -- Lowercase kebab-case slug
  CONSTRAINT chk_projects_slug_format
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND length(slug) <= 120),

  -- Bounded text descriptions
  CONSTRAINT chk_projects_description_length
    CHECK (description IS NULL OR length(description) <= 3000),

  CONSTRAINT chk_projects_notes_length
    CHECK (architecture_notes IS NULL OR length(architecture_notes) <= 10000),

  -- Protocol & length constraints for live URL
  CONSTRAINT chk_projects_live_url_protocol
    CHECK (live_url IS NULL OR live_url ~* '^https?://'),

  CONSTRAINT chk_projects_live_url_length
    CHECK (live_url IS NULL OR length(live_url) <= 1000),

  -- Valid Lifecycle Statuses
  CONSTRAINT chk_projects_status
    CHECK (status IN ('backlog', 'planning', 'in_progress', 'paused', 'completed', 'archived')),

  -- Valid Priorities
  CONSTRAINT chk_projects_priority
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Valid Project Types
  CONSTRAINT chk_projects_type
    CHECK (project_type IN ('software', 'research', 'open_source', 'hardware', 'content', 'custom')),

  -- Date ordering: target_date >= start_date where both exist
  CONSTRAINT chk_projects_dates
    CHECK (target_date IS NULL OR start_date IS NULL OR target_date >= start_date),

  -- Unique slug per user
  CONSTRAINT uq_projects_user_slug
    UNIQUE (user_id, slug)
);

-- Indexes for frequent query patterns
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_status ON public.projects(user_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_user_target_date ON public.projects(user_id, target_date);
CREATE INDEX IF NOT EXISTS idx_projects_user_priority ON public.projects(user_id, priority);
CREATE INDEX IF NOT EXISTS idx_projects_repository ON public.projects(repository_id);

-- Attach updated_at trigger to projects
DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- 2. Project Milestones Table
CREATE TABLE IF NOT EXISTS public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  order_index INTEGER NOT NULL DEFAULT 0,
  target_date TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key: owned by parent project with CASCADE on project deletion
  CONSTRAINT fk_project_milestones_project_id
    FOREIGN KEY (project_id)
    REFERENCES public.projects(id)
    ON DELETE CASCADE,

  -- Foreign Key: owned by profile with CASCADE on profile deletion
  CONSTRAINT fk_project_milestones_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  -- Bounded title and description
  CONSTRAINT chk_project_milestones_title_length
    CHECK (length(trim(title)) > 0 AND length(title) <= 255),

  CONSTRAINT chk_project_milestones_desc_length
    CHECK (description IS NULL OR length(description) <= 2000),

  -- Valid Milestone Statuses
  CONSTRAINT chk_project_milestones_status
    CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project_order ON public.project_milestones(project_id, order_index ASC);
CREATE INDEX IF NOT EXISTS idx_project_milestones_user ON public.project_milestones(user_id);

-- Attach updated_at trigger to project milestones
DROP TRIGGER IF EXISTS set_project_milestones_updated_at ON public.project_milestones;
CREATE TRIGGER set_project_milestones_updated_at
  BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- 3. Project Goals Relationship Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.project_goals (
  project_id UUID NOT NULL,
  goal_id UUID NOT NULL,
  user_id UUID NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_project_goals
    PRIMARY KEY (project_id, goal_id),

  CONSTRAINT fk_project_goals_project
    FOREIGN KEY (project_id)
    REFERENCES public.projects(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_project_goals_goal
    FOREIGN KEY (goal_id)
    REFERENCES public.goals(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_project_goals_user
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_goals_goal ON public.project_goals(goal_id);
CREATE INDEX IF NOT EXISTS idx_project_goals_user ON public.project_goals(user_id);


-- 4. Project Skills Relationship Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.project_skills (
  project_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'primary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_project_skills
    PRIMARY KEY (project_id, skill_id),

  CONSTRAINT fk_project_skills_project
    FOREIGN KEY (project_id)
    REFERENCES public.projects(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_project_skills_skill
    FOREIGN KEY (skill_id)
    REFERENCES public.skills(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_project_skills_user
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  CONSTRAINT chk_project_skills_role
    CHECK (role IN ('primary', 'supporting'))
);

CREATE INDEX IF NOT EXISTS idx_project_skills_skill ON public.project_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_project_skills_user ON public.project_skills(user_id);


-- 5. Extend Existing Tables
-- 5a. Extend public.tasks with project associations
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id UUID NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_milestone_id UUID NULL REFERENCES public.project_milestones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_user_project_id ON public.tasks(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_project_milestone_id ON public.tasks(user_id, project_milestone_id);

-- 5b. Extend public.evidence_links to allow linking evidence directly to projects and project milestones
ALTER TABLE public.evidence_links
  DROP CONSTRAINT IF EXISTS chk_evidence_links_entity_type;

ALTER TABLE public.evidence_links
  ADD CONSTRAINT chk_evidence_links_entity_type
  CHECK (entity_type IN ('goal', 'milestone', 'task', 'project', 'project_milestone'));


-- ==============================================================================
-- 6. Relationship Integrity & Same-User Triggers
-- ==============================================================================

-- 6a. Project Milestone ownership match: milestone must belong to same user as project
CREATE OR REPLACE FUNCTION public.check_project_milestone_user_match()
RETURNS TRIGGER AS $$
DECLARE
  proj_owner UUID;
BEGIN
  SELECT user_id INTO proj_owner FROM public.projects WHERE id = NEW.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced project does not exist';
  END IF;

  IF proj_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'Project milestone must belong to the same user as the project';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_project_milestone_user_match ON public.project_milestones;
CREATE TRIGGER trg_check_project_milestone_user_match
  BEFORE INSERT OR UPDATE
  ON public.project_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.check_project_milestone_user_match();


-- 6b. Project Repository ownership match: linked repository must belong to project owner
CREATE OR REPLACE FUNCTION public.check_project_repository_user_match()
RETURNS TRIGGER AS $$
DECLARE
  repo_owner UUID;
BEGIN
  IF NEW.repository_id IS NOT NULL THEN
    SELECT user_id INTO repo_owner FROM public.external_repositories WHERE id = NEW.repository_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced external repository does not exist';
    END IF;

    IF repo_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'Linked repository must belong to the same user as the project';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_project_repository_user_match ON public.projects;
CREATE TRIGGER trg_check_project_repository_user_match
  BEFORE INSERT OR UPDATE OF repository_id
  ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.check_project_repository_user_match();


-- 6c. Project-Goal ownership match: project, goal, and relationship row must all belong to same user
CREATE OR REPLACE FUNCTION public.check_project_goal_user_match()
RETURNS TRIGGER AS $$
DECLARE
  proj_owner UUID;
  goal_owner UUID;
BEGIN
  SELECT user_id INTO proj_owner FROM public.projects WHERE id = NEW.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced project does not exist';
  END IF;

  SELECT user_id INTO goal_owner FROM public.goals WHERE id = NEW.goal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced goal does not exist';
  END IF;

  IF NEW.user_id <> proj_owner OR NEW.user_id <> goal_owner THEN
    RAISE EXCEPTION 'User ID must match across project, goal, and relationship records';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_project_goal_user_match ON public.project_goals;
CREATE TRIGGER trg_check_project_goal_user_match
  BEFORE INSERT OR UPDATE
  ON public.project_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.check_project_goal_user_match();


-- 6d. Project-Skill ownership match: project, skill, and relationship row must all belong to same user
CREATE OR REPLACE FUNCTION public.check_project_skill_user_match()
RETURNS TRIGGER AS $$
DECLARE
  proj_owner UUID;
  skill_owner UUID;
BEGIN
  SELECT user_id INTO proj_owner FROM public.projects WHERE id = NEW.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced project does not exist';
  END IF;

  SELECT user_id INTO skill_owner FROM public.skills WHERE id = NEW.skill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced skill does not exist';
  END IF;

  IF NEW.user_id <> proj_owner OR NEW.user_id <> skill_owner THEN
    RAISE EXCEPTION 'User ID must match across project, skill, and relationship records';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_project_skill_user_match ON public.project_skills;
CREATE TRIGGER trg_check_project_skill_user_match
  BEFORE INSERT OR UPDATE
  ON public.project_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.check_project_skill_user_match();


-- 6e. Task Project & Milestone matching:
-- - If task has project_id, project must belong to task user
-- - If task has project_milestone_id, task must have project_id, milestone must belong to same user, and milestone must belong to that project
CREATE OR REPLACE FUNCTION public.check_task_project_match()
RETURNS TRIGGER AS $$
DECLARE
  proj_owner UUID;
  milestone_owner UUID;
  milestone_proj_id UUID;
BEGIN
  -- Verify project ownership if project_id is specified
  IF NEW.project_id IS NOT NULL THEN
    SELECT user_id INTO proj_owner FROM public.projects WHERE id = NEW.project_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced project does not exist';
    END IF;
    IF proj_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'Referenced project must belong to the same user as the task';
    END IF;
  END IF;

  -- On update, if project_id is being unlinked or cleared via cascade, auto-clear project_milestone_id
  IF TG_OP = 'UPDATE' AND OLD.project_id IS NOT NULL AND NEW.project_id IS NULL THEN
    NEW.project_milestone_id := NULL;
  END IF;

  -- Verify project_milestone_id integrity if specified
  IF NEW.project_milestone_id IS NOT NULL THEN
    IF NEW.project_id IS NULL THEN
      RAISE EXCEPTION 'Task cannot have a project milestone without a project_id';
    END IF;

    SELECT user_id, project_id INTO milestone_owner, milestone_proj_id
    FROM public.project_milestones
    WHERE id = NEW.project_milestone_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced project milestone does not exist';
    END IF;

    IF milestone_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'Referenced project milestone must belong to the same user as the task';
    END IF;

    IF milestone_proj_id <> NEW.project_id THEN
      RAISE EXCEPTION 'Task project milestone must belong to the specified project';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_task_project_match ON public.tasks;
CREATE TRIGGER trg_check_task_project_match
  BEFORE INSERT OR UPDATE OF project_id, project_milestone_id, user_id
  ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_task_project_match();


-- ==============================================================================
-- 7. Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_skills ENABLE ROW LEVEL SECURITY;

-- 7a. RLS Policies: public.projects
CREATE POLICY "projects_select_policy"
  ON public.projects
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "projects_insert_policy"
  ON public.projects
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "projects_update_policy"
  ON public.projects
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

CREATE POLICY "projects_delete_policy"
  ON public.projects
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );


-- 7b. RLS Policies: public.project_milestones
CREATE POLICY "project_milestones_select_policy"
  ON public.project_milestones
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "project_milestones_insert_policy"
  ON public.project_milestones
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "project_milestones_update_policy"
  ON public.project_milestones
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

CREATE POLICY "project_milestones_delete_policy"
  ON public.project_milestones
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );


-- 7c. RLS Policies: public.project_goals
CREATE POLICY "project_goals_select_policy"
  ON public.project_goals
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "project_goals_insert_policy"
  ON public.project_goals
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "project_goals_update_policy"
  ON public.project_goals
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

CREATE POLICY "project_goals_delete_policy"
  ON public.project_goals
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );


-- 7d. RLS Policies: public.project_skills
CREATE POLICY "project_skills_select_policy"
  ON public.project_skills
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "project_skills_insert_policy"
  ON public.project_skills
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "project_skills_update_policy"
  ON public.project_skills
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

CREATE POLICY "project_skills_delete_policy"
  ON public.project_skills
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );
