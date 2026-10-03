-- ==============================================================================
-- AVENZA UNIFIED SKILLS + MASTERY FOUNDATION MIGRATION
-- Phase 12: Unified Skills Domain + Relationships + RLS
-- ==============================================================================

-- 1. Skills Table
CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  parent_skill_id UUID NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NULL,
  category TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key: strictly owned by profile with CASCADE on profile deletion
  CONSTRAINT fk_skills_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  -- Foreign Key: parent skill (safe deletion -> SET NULL so children are preserved)
  CONSTRAINT fk_skills_parent_skill_id
    FOREIGN KEY (parent_skill_id)
    REFERENCES public.skills(id)
    ON DELETE SET NULL,

  -- Valid Statuses
  CONSTRAINT chk_skills_status
    CHECK (status IN ('active', 'archived')),

  -- Valid Sources
  CONSTRAINT chk_skills_source
    CHECK (source IN ('user', 'system', 'imported')),

  -- Constraints on lengths
  CONSTRAINT chk_skills_name_length
    CHECK (length(trim(name)) > 0 AND length(name) <= 100),

  CONSTRAINT chk_skills_slug_length
    CHECK (length(trim(slug)) > 0 AND length(slug) <= 120),

  CONSTRAINT chk_skills_description_length
    CHECK (description IS NULL OR length(description) <= 2000),

  CONSTRAINT chk_skills_category_length
    CHECK (category IS NULL OR length(category) <= 50),

  -- Prevent direct self-parenting
  CONSTRAINT chk_skills_no_self_parent
    CHECK (parent_skill_id IS NULL OR parent_skill_id <> id),

  -- Unique slug per user
  CONSTRAINT uq_skills_user_id_slug
    UNIQUE (user_id, slug)
);

-- Indexes for skill querying
CREATE INDEX IF NOT EXISTS idx_skills_user_status
  ON public.skills (user_id, status);

CREATE INDEX IF NOT EXISTS idx_skills_user_parent
  ON public.skills (user_id, parent_skill_id);

CREATE INDEX IF NOT EXISTS idx_skills_user_category
  ON public.skills (user_id, category);

-- 2. Hierarchy Cycle Detection & Same-User Parent Trigger
CREATE OR REPLACE FUNCTION public.check_skill_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  curr_parent_id UUID;
  curr_user_id UUID;
  depth INTEGER := 0;
  max_depth CONSTANT INTEGER := 25;
BEGIN
  IF NEW.parent_skill_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ensure not self-parenting
  IF NEW.id IS NOT NULL AND NEW.parent_skill_id = NEW.id THEN
    RAISE EXCEPTION 'A skill cannot be its own parent';
  END IF;

  -- Check parent ownership
  SELECT user_id INTO curr_user_id
  FROM public.skills
  WHERE id = NEW.parent_skill_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent skill does not exist';
  END IF;

  IF curr_user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Parent skill must belong to the same user';
  END IF;

  -- Cycle check: Traverse up from NEW.parent_skill_id
  curr_parent_id := NEW.parent_skill_id;
  WHILE curr_parent_id IS NOT NULL LOOP
    depth := depth + 1;
    IF depth > max_depth THEN
      RAISE EXCEPTION 'Skill hierarchy depth exceeds maximum allowed limit (% levels)', max_depth;
    END IF;

    IF NEW.id IS NOT NULL AND curr_parent_id = NEW.id THEN
      RAISE EXCEPTION 'Circular hierarchy detected in skills';
    END IF;

    SELECT parent_skill_id INTO curr_parent_id
    FROM public.skills
    WHERE id = curr_parent_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_skill_hierarchy ON public.skills;
CREATE TRIGGER trg_check_skill_hierarchy
  BEFORE INSERT OR UPDATE OF parent_skill_id, user_id
  ON public.skills
  FOR EACH ROW
  EXECUTE FUNCTION public.check_skill_hierarchy();

-- Standard updated_at trigger for skills
DROP TRIGGER IF EXISTS set_skills_updated_at ON public.skills;
CREATE TRIGGER set_skills_updated_at
  BEFORE UPDATE ON public.skills
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- 3. Evidence Skills Relationship Table
CREATE TABLE IF NOT EXISTS public.evidence_skills (
  evidence_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_evidence_skills
    PRIMARY KEY (evidence_id, skill_id),

  CONSTRAINT fk_evidence_skills_evidence
    FOREIGN KEY (evidence_id)
    REFERENCES public.evidence(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_evidence_skills_skill
    FOREIGN KEY (skill_id)
    REFERENCES public.skills(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_evidence_skills_user
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_skills_skill
  ON public.evidence_skills (skill_id);

CREATE INDEX IF NOT EXISTS idx_evidence_skills_user
  ON public.evidence_skills (user_id);

-- Enforce Evidence-Skill user ownership match
CREATE OR REPLACE FUNCTION public.check_evidence_skill_user_match()
RETURNS TRIGGER AS $$
DECLARE
  evidence_owner UUID;
  skill_owner UUID;
BEGIN
  SELECT user_id INTO evidence_owner FROM public.evidence WHERE id = NEW.evidence_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced evidence does not exist';
  END IF;

  SELECT user_id INTO skill_owner FROM public.skills WHERE id = NEW.skill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced skill does not exist';
  END IF;

  IF NEW.user_id <> evidence_owner OR NEW.user_id <> skill_owner THEN
    RAISE EXCEPTION 'User ID must match across evidence and skill records';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_evidence_skill_user_match ON public.evidence_skills;
CREATE TRIGGER trg_check_evidence_skill_user_match
  BEFORE INSERT OR UPDATE
  ON public.evidence_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.check_evidence_skill_user_match();


-- 4. Goal Skills Relationship Table (with optional target mastery state)
CREATE TABLE IF NOT EXISTS public.goal_skills (
  goal_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  user_id UUID NOT NULL,
  target_mastery_state TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_goal_skills
    PRIMARY KEY (goal_id, skill_id),

  CONSTRAINT fk_goal_skills_goal
    FOREIGN KEY (goal_id)
    REFERENCES public.goals(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_goal_skills_skill
    FOREIGN KEY (skill_id)
    REFERENCES public.skills(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_goal_skills_user
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  CONSTRAINT chk_goal_skills_target_mastery
    CHECK (target_mastery_state IS NULL OR target_mastery_state IN (
      'unknown', 'exploring', 'learning', 'developing', 'proficient', 'strong', 'needs_review', 'inactive'
    ))
);

CREATE INDEX IF NOT EXISTS idx_goal_skills_skill
  ON public.goal_skills (skill_id);

CREATE INDEX IF NOT EXISTS idx_goal_skills_user
  ON public.goal_skills (user_id);

-- Enforce Goal-Skill user ownership match
CREATE OR REPLACE FUNCTION public.check_goal_skill_user_match()
RETURNS TRIGGER AS $$
DECLARE
  goal_owner UUID;
  skill_owner UUID;
BEGIN
  SELECT user_id INTO goal_owner FROM public.goals WHERE id = NEW.goal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced goal does not exist';
  END IF;

  SELECT user_id INTO skill_owner FROM public.skills WHERE id = NEW.skill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced skill does not exist';
  END IF;

  IF NEW.user_id <> goal_owner OR NEW.user_id <> skill_owner THEN
    RAISE EXCEPTION 'User ID must match across goal and skill records';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_goal_skill_user_match ON public.goal_skills;
CREATE TRIGGER trg_check_goal_skill_user_match
  BEFORE INSERT OR UPDATE
  ON public.goal_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.check_goal_skill_user_match();


-- 5. Task Skills Relationship Table
CREATE TABLE IF NOT EXISTS public.task_skills (
  task_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_task_skills
    PRIMARY KEY (task_id, skill_id),

  CONSTRAINT fk_task_skills_task
    FOREIGN KEY (task_id)
    REFERENCES public.tasks(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_task_skills_skill
    FOREIGN KEY (skill_id)
    REFERENCES public.skills(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_task_skills_user
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_skills_skill
  ON public.task_skills (skill_id);

CREATE INDEX IF NOT EXISTS idx_task_skills_user
  ON public.task_skills (user_id);

-- Enforce Task-Skill user ownership match
CREATE OR REPLACE FUNCTION public.check_task_skill_user_match()
RETURNS TRIGGER AS $$
DECLARE
  task_owner UUID;
  skill_owner UUID;
BEGIN
  SELECT user_id INTO task_owner FROM public.tasks WHERE id = NEW.task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced task does not exist';
  END IF;

  SELECT user_id INTO skill_owner FROM public.skills WHERE id = NEW.skill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced skill does not exist';
  END IF;

  IF NEW.user_id <> task_owner OR NEW.user_id <> skill_owner THEN
    RAISE EXCEPTION 'User ID must match across task and skill records';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_task_skill_user_match ON public.task_skills;
CREATE TRIGGER trg_check_task_skill_user_match
  BEFORE INSERT OR UPDATE
  ON public.task_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.check_task_skill_user_match();


-- 6. Topic Skills Relationship Table (Academics: subject_topics)
CREATE TABLE IF NOT EXISTS public.topic_skills (
  topic_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_topic_skills
    PRIMARY KEY (topic_id, skill_id),

  CONSTRAINT fk_topic_skills_topic
    FOREIGN KEY (topic_id)
    REFERENCES public.subject_topics(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_topic_skills_skill
    FOREIGN KEY (skill_id)
    REFERENCES public.skills(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_topic_skills_user
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_topic_skills_skill
  ON public.topic_skills (skill_id);

CREATE INDEX IF NOT EXISTS idx_topic_skills_user
  ON public.topic_skills (user_id);

-- Enforce Topic-Skill user ownership match
CREATE OR REPLACE FUNCTION public.check_topic_skill_user_match()
RETURNS TRIGGER AS $$
DECLARE
  topic_owner UUID;
  skill_owner UUID;
BEGIN
  SELECT user_id INTO topic_owner FROM public.subject_topics WHERE id = NEW.topic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced subject topic does not exist';
  END IF;

  SELECT user_id INTO skill_owner FROM public.skills WHERE id = NEW.skill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced skill does not exist';
  END IF;

  IF NEW.user_id <> topic_owner OR NEW.user_id <> skill_owner THEN
    RAISE EXCEPTION 'User ID must match across topic and skill records';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_topic_skill_user_match ON public.topic_skills;
CREATE TRIGGER trg_check_topic_skill_user_match
  BEFORE INSERT OR UPDATE
  ON public.topic_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.check_topic_skill_user_match();


-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict user isolation on all skills and relation tables
-- ==============================================================================

-- 1. Skills Table RLS
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own skills"
  ON public.skills
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own skills"
  ON public.skills
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own skills"
  ON public.skills
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own skills"
  ON public.skills
  FOR DELETE
  USING (auth.uid() = user_id);


-- 2. Evidence Skills RLS
ALTER TABLE public.evidence_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evidence_skills"
  ON public.evidence_skills
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own evidence_skills"
  ON public.evidence_skills
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own evidence_skills"
  ON public.evidence_skills
  FOR DELETE
  USING (auth.uid() = user_id);


-- 3. Goal Skills RLS
ALTER TABLE public.goal_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goal_skills"
  ON public.goal_skills
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goal_skills"
  ON public.goal_skills
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goal_skills"
  ON public.goal_skills
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goal_skills"
  ON public.goal_skills
  FOR DELETE
  USING (auth.uid() = user_id);


-- 4. Task Skills RLS
ALTER TABLE public.task_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task_skills"
  ON public.task_skills
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task_skills"
  ON public.task_skills
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own task_skills"
  ON public.task_skills
  FOR DELETE
  USING (auth.uid() = user_id);


-- 5. Topic Skills RLS
ALTER TABLE public.topic_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topic_skills"
  ON public.topic_skills
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own topic_skills"
  ON public.topic_skills
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own topic_skills"
  ON public.topic_skills
  FOR DELETE
  USING (auth.uid() = user_id);
