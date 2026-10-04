-- ==============================================================================
-- AVENZA DSA FOUNDATION MIGRATION
-- Phase 13: Problems, Topics, Attempts, Links, Evidence extension + RLS
--
-- Source of truth: dsa_attempts (append-only history).
-- dsa_problems.{attempt_count, solved_count, failed_count, last_attempt_at,
--   last_solved_at, next_review_at, revision_count, review_stage} are a
--   PROJECTION recomputed deterministically from dsa_attempts by the API
--   (see apps/api/src/modules/dsa/dsa.revision.ts). They exist so list/overview
--   queries never need to load attempt histories.
-- ==============================================================================

-- 1. DSA Problems
CREATE TABLE IF NOT EXISTS public.dsa_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NULL,
  difficulty TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  external_url TEXT NULL,
  estimated_minutes INTEGER NULL,

  -- Derived projection (recomputed from dsa_attempts)
  attempt_count INTEGER NOT NULL DEFAULT 0,
  solved_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ NULL,
  last_solved_at TIMESTAMPTZ NULL,
  next_review_at TIMESTAMPTZ NULL,
  revision_count INTEGER NOT NULL DEFAULT 0,
  review_stage SMALLINT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_dsa_problems_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,

  CONSTRAINT chk_dsa_problems_difficulty CHECK (difficulty IN ('easy', 'medium', 'hard')),
  CONSTRAINT chk_dsa_problems_source CHECK (source IN ('user', 'system', 'imported')),
  CONSTRAINT chk_dsa_problems_status CHECK (status IN ('active', 'archived')),
  CONSTRAINT chk_dsa_problems_title_length CHECK (length(trim(title)) > 0 AND length(title) <= 200),
  CONSTRAINT chk_dsa_problems_slug_length CHECK (length(trim(slug)) > 0 AND length(slug) <= 120),
  CONSTRAINT chk_dsa_problems_description_length CHECK (description IS NULL OR length(description) <= 5000),
  CONSTRAINT chk_dsa_problems_url_length CHECK (external_url IS NULL OR length(external_url) <= 1000),
  CONSTRAINT chk_dsa_problems_estimated_minutes
    CHECK (estimated_minutes IS NULL OR (estimated_minutes > 0 AND estimated_minutes <= 1440)),
  CONSTRAINT chk_dsa_problems_counts_non_negative
    CHECK (attempt_count >= 0 AND solved_count >= 0 AND failed_count >= 0 AND revision_count >= 0),
  CONSTRAINT chk_dsa_problems_review_stage CHECK (review_stage BETWEEN 0 AND 3),
  CONSTRAINT uq_dsa_problems_user_slug UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_dsa_problems_user_status ON public.dsa_problems (user_id, status);
CREATE INDEX IF NOT EXISTS idx_dsa_problems_user_difficulty ON public.dsa_problems (user_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_dsa_problems_user_next_review
  ON public.dsa_problems (user_id, next_review_at) WHERE next_review_at IS NOT NULL;

DROP TRIGGER IF EXISTS set_dsa_problems_updated_at ON public.dsa_problems;
CREATE TRIGGER set_dsa_problems_updated_at
  BEFORE UPDATE ON public.dsa_problems
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 2. DSA Topics (normalized, optional hierarchy)
CREATE TABLE IF NOT EXISTS public.dsa_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  parent_topic_id UUID NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_dsa_topics_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Deleting a parent preserves children (they become roots)
  CONSTRAINT fk_dsa_topics_parent
    FOREIGN KEY (parent_topic_id) REFERENCES public.dsa_topics(id) ON DELETE SET NULL,

  CONSTRAINT chk_dsa_topics_status CHECK (status IN ('active', 'archived')),
  CONSTRAINT chk_dsa_topics_name_length CHECK (length(trim(name)) > 0 AND length(name) <= 100),
  CONSTRAINT chk_dsa_topics_slug_length CHECK (length(trim(slug)) > 0 AND length(slug) <= 120),
  CONSTRAINT chk_dsa_topics_no_self_parent CHECK (parent_topic_id IS NULL OR parent_topic_id <> id),
  CONSTRAINT uq_dsa_topics_user_slug UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_dsa_topics_user_parent ON public.dsa_topics (user_id, parent_topic_id);

CREATE OR REPLACE FUNCTION public.check_dsa_topic_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  curr_parent_id UUID;
  parent_owner UUID;
  depth INTEGER := 0;
  max_depth CONSTANT INTEGER := 25;
BEGIN
  IF NEW.parent_topic_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS NOT NULL AND NEW.parent_topic_id = NEW.id THEN
    RAISE EXCEPTION 'A topic cannot be its own parent';
  END IF;

  SELECT user_id INTO parent_owner FROM public.dsa_topics WHERE id = NEW.parent_topic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent topic does not exist';
  END IF;
  IF parent_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'Parent topic must belong to the same user';
  END IF;

  curr_parent_id := NEW.parent_topic_id;
  WHILE curr_parent_id IS NOT NULL LOOP
    depth := depth + 1;
    IF depth > max_depth THEN
      RAISE EXCEPTION 'Topic hierarchy depth exceeds maximum allowed limit (% levels)', max_depth;
    END IF;
    IF NEW.id IS NOT NULL AND curr_parent_id = NEW.id THEN
      RAISE EXCEPTION 'Circular hierarchy detected in topics';
    END IF;
    SELECT parent_topic_id INTO curr_parent_id FROM public.dsa_topics WHERE id = curr_parent_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_dsa_topic_hierarchy ON public.dsa_topics;
CREATE TRIGGER trg_check_dsa_topic_hierarchy
  BEFORE INSERT OR UPDATE OF parent_topic_id, user_id ON public.dsa_topics
  FOR EACH ROW EXECUTE FUNCTION public.check_dsa_topic_hierarchy();

DROP TRIGGER IF EXISTS set_dsa_topics_updated_at ON public.dsa_topics;
CREATE TRIGGER set_dsa_topics_updated_at
  BEFORE UPDATE ON public.dsa_topics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 3. Relationship tables (problem <-> topic | skill | goal | task)
CREATE TABLE IF NOT EXISTS public.dsa_problem_topics (
  problem_id UUID NOT NULL,
  topic_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_dsa_problem_topics PRIMARY KEY (problem_id, topic_id),
  CONSTRAINT fk_dsa_problem_topics_problem FOREIGN KEY (problem_id) REFERENCES public.dsa_problems(id) ON DELETE CASCADE,
  CONSTRAINT fk_dsa_problem_topics_topic FOREIGN KEY (topic_id) REFERENCES public.dsa_topics(id) ON DELETE CASCADE,
  CONSTRAINT fk_dsa_problem_topics_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dsa_problem_topics_topic ON public.dsa_problem_topics (topic_id);
CREATE INDEX IF NOT EXISTS idx_dsa_problem_topics_user ON public.dsa_problem_topics (user_id);

CREATE TABLE IF NOT EXISTS public.dsa_problem_skills (
  problem_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_dsa_problem_skills PRIMARY KEY (problem_id, skill_id),
  CONSTRAINT fk_dsa_problem_skills_problem FOREIGN KEY (problem_id) REFERENCES public.dsa_problems(id) ON DELETE CASCADE,
  CONSTRAINT fk_dsa_problem_skills_skill FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE,
  CONSTRAINT fk_dsa_problem_skills_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dsa_problem_skills_skill ON public.dsa_problem_skills (skill_id);
CREATE INDEX IF NOT EXISTS idx_dsa_problem_skills_user ON public.dsa_problem_skills (user_id);

CREATE TABLE IF NOT EXISTS public.dsa_problem_goals (
  problem_id UUID NOT NULL,
  goal_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_dsa_problem_goals PRIMARY KEY (problem_id, goal_id),
  CONSTRAINT fk_dsa_problem_goals_problem FOREIGN KEY (problem_id) REFERENCES public.dsa_problems(id) ON DELETE CASCADE,
  CONSTRAINT fk_dsa_problem_goals_goal FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE,
  CONSTRAINT fk_dsa_problem_goals_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dsa_problem_goals_goal ON public.dsa_problem_goals (goal_id);
CREATE INDEX IF NOT EXISTS idx_dsa_problem_goals_user ON public.dsa_problem_goals (user_id);

CREATE TABLE IF NOT EXISTS public.dsa_problem_tasks (
  problem_id UUID NOT NULL,
  task_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_dsa_problem_tasks PRIMARY KEY (problem_id, task_id),
  CONSTRAINT fk_dsa_problem_tasks_problem FOREIGN KEY (problem_id) REFERENCES public.dsa_problems(id) ON DELETE CASCADE,
  CONSTRAINT fk_dsa_problem_tasks_task FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_dsa_problem_tasks_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dsa_problem_tasks_task ON public.dsa_problem_tasks (task_id);
CREATE INDEX IF NOT EXISTS idx_dsa_problem_tasks_user ON public.dsa_problem_tasks (user_id);

-- One ownership guard for all four link tables.
-- TG_ARGV[0] = other table name, TG_ARGV[1] = other table fk column on NEW
CREATE OR REPLACE FUNCTION public.check_dsa_link_ownership()
RETURNS TRIGGER AS $$
DECLARE
  other_table TEXT := TG_ARGV[0];
  other_col TEXT := TG_ARGV[1];
  other_id UUID;
  problem_owner UUID;
  other_owner UUID;
BEGIN
  SELECT user_id INTO problem_owner FROM public.dsa_problems WHERE id = NEW.problem_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced DSA problem does not exist';
  END IF;

  EXECUTE format('SELECT ($1).%I', other_col) INTO other_id USING NEW;
  EXECUTE format('SELECT user_id FROM public.%I WHERE id = $1', other_table) INTO other_owner USING other_id;
  IF other_owner IS NULL THEN
    RAISE EXCEPTION 'Referenced % does not exist', other_table;
  END IF;

  IF NEW.user_id <> problem_owner OR NEW.user_id <> other_owner THEN
    RAISE EXCEPTION 'User ID must match across DSA problem and % records', other_table;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_dsa_problem_topics_owner ON public.dsa_problem_topics;
CREATE TRIGGER trg_check_dsa_problem_topics_owner
  BEFORE INSERT OR UPDATE ON public.dsa_problem_topics
  FOR EACH ROW EXECUTE FUNCTION public.check_dsa_link_ownership('dsa_topics', 'topic_id');

DROP TRIGGER IF EXISTS trg_check_dsa_problem_skills_owner ON public.dsa_problem_skills;
CREATE TRIGGER trg_check_dsa_problem_skills_owner
  BEFORE INSERT OR UPDATE ON public.dsa_problem_skills
  FOR EACH ROW EXECUTE FUNCTION public.check_dsa_link_ownership('skills', 'skill_id');

DROP TRIGGER IF EXISTS trg_check_dsa_problem_goals_owner ON public.dsa_problem_goals;
CREATE TRIGGER trg_check_dsa_problem_goals_owner
  BEFORE INSERT OR UPDATE ON public.dsa_problem_goals
  FOR EACH ROW EXECUTE FUNCTION public.check_dsa_link_ownership('goals', 'goal_id');

DROP TRIGGER IF EXISTS trg_check_dsa_problem_tasks_owner ON public.dsa_problem_tasks;
CREATE TRIGGER trg_check_dsa_problem_tasks_owner
  BEFORE INSERT OR UPDATE ON public.dsa_problem_tasks
  FOR EACH ROW EXECUTE FUNCTION public.check_dsa_link_ownership('tasks', 'task_id');


-- 4. DSA Attempts (append-only execution history)
--    * occurred_at : when the attempt really happened (may be backdated by the user)
--    * recorded_at : when the server stored it (authoritative, never client-supplied)
--    * Problem FK is RESTRICT: a problem with history can only be archived, never deleted.
CREATE TABLE IF NOT EXISTS public.dsa_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  problem_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'attempted',
  started_at TIMESTAMPTZ NULL,
  submitted_at TIMESTAMPTZ NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  solve_time_minutes INTEGER NULL,
  language TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_dsa_attempts_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_dsa_attempts_problem_id
    FOREIGN KEY (problem_id) REFERENCES public.dsa_problems(id) ON DELETE RESTRICT,

  CONSTRAINT chk_dsa_attempts_status CHECK (status IN ('attempted', 'solved', 'failed', 'abandoned')),
  -- NULL means "unknown", never 0 by default; 0 minutes is rejected as meaningless
  CONSTRAINT chk_dsa_attempts_solve_time
    CHECK (solve_time_minutes IS NULL OR (solve_time_minutes > 0 AND solve_time_minutes <= 1440)),
  CONSTRAINT chk_dsa_attempts_solve_time_requires_result
    CHECK (solve_time_minutes IS NULL OR status <> 'attempted'),
  CONSTRAINT chk_dsa_attempts_submit_after_start
    CHECK (started_at IS NULL OR submitted_at IS NULL OR submitted_at >= started_at),
  CONSTRAINT chk_dsa_attempts_language_length CHECK (language IS NULL OR length(language) <= 40),
  CONSTRAINT chk_dsa_attempts_notes_length CHECK (notes IS NULL OR length(notes) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_dsa_attempts_user_problem
  ON public.dsa_attempts (user_id, problem_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_dsa_attempts_user_status
  ON public.dsa_attempts (user_id, status, occurred_at DESC);

-- At most one in-progress attempt per problem
CREATE UNIQUE INDEX IF NOT EXISTS uq_dsa_attempts_one_active_per_problem
  ON public.dsa_attempts (problem_id) WHERE status = 'attempted';

CREATE OR REPLACE FUNCTION public.check_dsa_attempt_integrity()
RETURNS TRIGGER AS $$
DECLARE
  problem_owner UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO problem_owner FROM public.dsa_problems WHERE id = NEW.problem_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced DSA problem does not exist';
    END IF;
    IF problem_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'User ID must match across DSA attempt and problem records';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: identity and server timestamps are immutable
  IF NEW.user_id <> OLD.user_id OR NEW.problem_id <> OLD.problem_id OR NEW.recorded_at <> OLD.recorded_at THEN
    RAISE EXCEPTION 'DSA attempt identity and recorded_at are immutable';
  END IF;

  -- Terminal attempts are historical facts and cannot be rewritten
  IF OLD.status <> 'attempted' THEN
    RAISE EXCEPTION 'A completed DSA attempt (%) is immutable', OLD.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_dsa_attempt_integrity ON public.dsa_attempts;
CREATE TRIGGER trg_check_dsa_attempt_integrity
  BEFORE INSERT OR UPDATE ON public.dsa_attempts
  FOR EACH ROW EXECUTE FUNCTION public.check_dsa_attempt_integrity();

DROP TRIGGER IF EXISTS set_dsa_attempts_updated_at ON public.dsa_attempts;
CREATE TRIGGER set_dsa_attempts_updated_at
  BEFORE UPDATE ON public.dsa_attempts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 5. Evidence integration: extend allowed evidence/source types
ALTER TABLE public.evidence DROP CONSTRAINT IF EXISTS chk_evidence_type;
ALTER TABLE public.evidence ADD CONSTRAINT chk_evidence_type
  CHECK (evidence_type IN (
    'task_completion', 'focus_session', 'manual', 'artifact', 'assessment',
    'external_activity', 'external_result', 'project_activity', 'custom',
    'dsa_problem_solved'
  ));

ALTER TABLE public.evidence DROP CONSTRAINT IF EXISTS chk_evidence_source_type;
ALTER TABLE public.evidence ADD CONSTRAINT chk_evidence_source_type
  CHECK (source_type IN (
    'task', 'focus_session', 'user', 'assessment', 'project',
    'external_provider', 'system', 'dsa_attempt'
  ));

-- Evidence sourced from a DSA attempt must point at a SOLVED attempt owned by the same user.
-- Idempotency comes from the existing unique index (user_id, source_type, source_id).
CREATE OR REPLACE FUNCTION public.check_dsa_attempt_evidence_source()
RETURNS TRIGGER AS $$
DECLARE
  attempt_owner UUID;
  attempt_status TEXT;
BEGIN
  IF NEW.source_type <> 'dsa_attempt' THEN
    RETURN NEW;
  END IF;

  IF NEW.source_id IS NULL THEN
    RAISE EXCEPTION 'DSA attempt evidence requires source_id';
  END IF;

  BEGIN
    SELECT user_id, status INTO attempt_owner, attempt_status
    FROM public.dsa_attempts WHERE id = NEW.source_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'DSA attempt evidence source_id must be a UUID';
  END;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced DSA attempt does not exist';
  END IF;
  IF attempt_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'DSA attempt evidence must belong to the attempt owner';
  END IF;
  IF attempt_status <> 'solved' THEN
    RAISE EXCEPTION 'Only a solved DSA attempt can produce solved evidence';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_dsa_attempt_evidence_source ON public.evidence;
CREATE TRIGGER trg_check_dsa_attempt_evidence_source
  BEFORE INSERT OR UPDATE OF source_type, source_id, user_id ON public.evidence
  FOR EACH ROW EXECUTE FUNCTION public.check_dsa_attempt_evidence_source();


-- ==============================================================================
-- ROW LEVEL SECURITY (Clerk-aware, same pattern as goals/evidence)
-- ==============================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'dsa_problems', 'dsa_topics', 'dsa_problem_topics', 'dsa_problem_skills',
    'dsa_problem_goals', 'dsa_problem_tasks', 'dsa_attempts'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR SELECT USING (
        auth.role() = 'service_role'
        OR user_id IN (SELECT p.id FROM public.profiles p WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub'))
      )$p$, t || '_select_policy', t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (
        auth.role() = 'service_role'
        OR user_id IN (SELECT p.id FROM public.profiles p WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub'))
      )$p$, t || '_insert_policy', t);
  END LOOP;

  -- UPDATE: all tables except link tables (links are insert/delete only)
  FOREACH t IN ARRAY ARRAY['dsa_problems', 'dsa_topics', 'dsa_attempts'] LOOP
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR UPDATE USING (
        auth.role() = 'service_role'
        OR user_id IN (SELECT p.id FROM public.profiles p WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub'))
      ) WITH CHECK (
        auth.role() = 'service_role'
        OR user_id IN (SELECT p.id FROM public.profiles p WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub'))
      )$p$, t || '_update_policy', t);
  END LOOP;

  -- DELETE: intentionally NOT granted on dsa_attempts to end users (history is preserved).
  FOREACH t IN ARRAY ARRAY[
    'dsa_problems', 'dsa_topics', 'dsa_problem_topics', 'dsa_problem_skills',
    'dsa_problem_goals', 'dsa_problem_tasks'
  ] LOOP
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR DELETE USING (
        auth.role() = 'service_role'
        OR user_id IN (SELECT p.id FROM public.profiles p WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub'))
      )$p$, t || '_delete_policy', t);
  END LOOP;
END
$$;
