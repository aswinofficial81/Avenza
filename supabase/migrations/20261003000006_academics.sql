-- ==============================================================================
-- AVENZA ACADEMICS DOMAIN MIGRATION
-- Phase 11: Foundational Academics Domain (Source of Truth) + RLS
-- ==============================================================================

-- 1. Academic Years (Optional Container)
CREATE TABLE IF NOT EXISTS public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key: strictly owned by profile with CASCADE on profile deletion
  CONSTRAINT fk_academic_years_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  -- Date constraint
  CONSTRAINT chk_academic_years_dates
    CHECK (start_date <= end_date)
);

-- 2. Terms (Core Academic Container)
CREATE TABLE IF NOT EXISTS public.terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  academic_year_id UUID NULL,
  name TEXT NOT NULL,
  code TEXT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  is_current BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key: profile
  CONSTRAINT fk_terms_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  -- Foreign Key: optional academic year
  CONSTRAINT fk_terms_academic_year_id
    FOREIGN KEY (academic_year_id)
    REFERENCES public.academic_years(id)
    ON DELETE SET NULL,

  -- Term Status
  CONSTRAINT chk_terms_status
    CHECK (status IN ('planned', 'active', 'completed', 'archived')),

  -- Date constraint
  CONSTRAINT chk_terms_dates
    CHECK (start_date <= end_date)
);

-- 3. Subjects (Belongs to a Term)
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  term_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT NULL,
  description TEXT NULL,
  instructor TEXT NULL,
  credits NUMERIC(4, 2) NULL,
  color TEXT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key: profile
  CONSTRAINT fk_subjects_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  -- Foreign Key: term
  CONSTRAINT fk_subjects_term_id
    FOREIGN KEY (term_id)
    REFERENCES public.terms(id)
    ON DELETE CASCADE,

  -- Subject Status
  CONSTRAINT chk_subjects_status
    CHECK (status IN ('planned', 'active', 'completed', 'archived')),

  -- Credits non-negative
  CONSTRAINT chk_subjects_credits
    CHECK (credits IS NULL OR credits >= 0)
);

-- 4. Subject Topics (Syllabus Structure: Subject -> Topic)
CREATE TABLE IF NOT EXISTS public.subject_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'not_started',
  importance TEXT NOT NULL DEFAULT 'medium',
  estimated_minutes INTEGER NULL,
  resources JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key: profile
  CONSTRAINT fk_subject_topics_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  -- Foreign Key: subject
  CONSTRAINT fk_subject_topics_subject_id
    FOREIGN KEY (subject_id)
    REFERENCES public.subjects(id)
    ON DELETE CASCADE,

  -- Topic Status (Coverage states)
  CONSTRAINT chk_subject_topics_status
    CHECK (status IN ('not_started', 'in_progress', 'covered', 'needs_review')),

  -- Topic Importance
  CONSTRAINT chk_subject_topics_importance
    CHECK (importance IN ('low', 'medium', 'high', 'critical')),

  -- Estimated minutes non-negative
  CONSTRAINT chk_subject_topics_estimated_minutes
    CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0)
);

-- 5. Assessments (Assignments, Quizzes, Labs, Projects, etc.)
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  term_id UUID NOT NULL,
  subject_id UUID NULL,
  title TEXT NOT NULL,
  assessment_type TEXT NOT NULL DEFAULT 'assignment',
  description TEXT NULL,
  due_at TIMESTAMPTZ NULL,
  max_marks NUMERIC(6, 2) NULL,
  obtained_marks NUMERIC(6, 2) NULL,
  weight_percent NUMERIC(5, 2) NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key: profile
  CONSTRAINT fk_assessments_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  -- Foreign Key: term
  CONSTRAINT fk_assessments_term_id
    FOREIGN KEY (term_id)
    REFERENCES public.terms(id)
    ON DELETE CASCADE,

  -- Foreign Key: subject (safe set null)
  CONSTRAINT fk_assessments_subject_id
    FOREIGN KEY (subject_id)
    REFERENCES public.subjects(id)
    ON DELETE SET NULL,

  -- Assessment Types
  CONSTRAINT chk_assessments_type
    CHECK (assessment_type IN ('assignment', 'quiz', 'lab', 'project', 'internal', 'presentation', 'mock', 'custom')),

  -- Assessment Statuses
  CONSTRAINT chk_assessments_status
    CHECK (status IN ('planned', 'in_progress', 'submitted', 'completed', 'cancelled')),

  -- Marks validation
  CONSTRAINT chk_assessments_max_marks
    CHECK (max_marks IS NULL OR max_marks > 0),
  CONSTRAINT chk_assessments_obtained_marks
    CHECK (obtained_marks IS NULL OR obtained_marks >= 0),
  CONSTRAINT chk_assessments_marks_range
    CHECK ((obtained_marks IS NULL OR max_marks IS NULL) OR (obtained_marks <= max_marks)),

  -- Weight validation
  CONSTRAINT chk_assessments_weight
    CHECK (weight_percent IS NULL OR (weight_percent >= 0 AND weight_percent <= 100))
);

-- 6. Assessment Topics Join Table
CREATE TABLE IF NOT EXISTS public.assessment_topics (
  assessment_id UUID NOT NULL,
  topic_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_assessment_topics
    PRIMARY KEY (assessment_id, topic_id),

  CONSTRAINT fk_assessment_topics_assessment
    FOREIGN KEY (assessment_id)
    REFERENCES public.assessments(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_assessment_topics_topic
    FOREIGN KEY (topic_id)
    REFERENCES public.subject_topics(id)
    ON DELETE CASCADE
);

-- 7. Exams
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  term_id UUID NOT NULL,
  subject_id UUID NULL,
  title TEXT NOT NULL,
  exam_type TEXT NOT NULL DEFAULT 'midterm',
  exam_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NULL,
  location TEXT NULL,
  weight_percent NUMERIC(5, 2) NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key: profile
  CONSTRAINT fk_exams_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  -- Foreign Key: term
  CONSTRAINT fk_exams_term_id
    FOREIGN KEY (term_id)
    REFERENCES public.terms(id)
    ON DELETE CASCADE,

  -- Foreign Key: subject (safe set null)
  CONSTRAINT fk_exams_subject_id
    FOREIGN KEY (subject_id)
    REFERENCES public.subjects(id)
    ON DELETE SET NULL,

  -- Exam Types
  CONSTRAINT chk_exams_type
    CHECK (exam_type IN ('midterm', 'endterm', 'final', 'mock', 'practical', 'viva', 'custom')),

  -- Exam Statuses
  CONSTRAINT chk_exams_status
    CHECK (status IN ('planned', 'completed', 'cancelled')),

  -- Duration positive
  CONSTRAINT chk_exams_duration
    CHECK (duration_minutes IS NULL OR duration_minutes > 0),

  -- Weight validation
  CONSTRAINT chk_exams_weight
    CHECK (weight_percent IS NULL OR (weight_percent >= 0 AND weight_percent <= 100))
);

-- 8. Exam Topics Join Table
CREATE TABLE IF NOT EXISTS public.exam_topics (
  exam_id UUID NOT NULL,
  topic_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_exam_topics
    PRIMARY KEY (exam_id, topic_id),

  CONSTRAINT fk_exam_topics_exam
    FOREIGN KEY (exam_id)
    REFERENCES public.exams(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_exam_topics_topic
    FOREIGN KEY (topic_id)
    REFERENCES public.subject_topics(id)
    ON DELETE CASCADE
);

-- 9. Add Academic Foreign Keys to Existing Tasks Table (Safe, Backward Compatible)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'academic_term_id'
  ) THEN
    ALTER TABLE public.tasks
      ADD COLUMN academic_term_id UUID NULL REFERENCES public.terms(id) ON DELETE SET NULL,
      ADD COLUMN academic_subject_id UUID NULL REFERENCES public.subjects(id) ON DELETE SET NULL,
      ADD COLUMN academic_topic_id UUID NULL REFERENCES public.subject_topics(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 10. Add Academic Foreign Keys to Existing Goals Table (Optional Context)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'goals' AND column_name = 'academic_term_id'
  ) THEN
    ALTER TABLE public.goals
      ADD COLUMN academic_term_id UUID NULL REFERENCES public.terms(id) ON DELETE SET NULL,
      ADD COLUMN academic_subject_id UUID NULL REFERENCES public.subjects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 11. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_academic_years_user ON public.academic_years(user_id);
CREATE INDEX IF NOT EXISTS idx_terms_user ON public.terms(user_id);
CREATE INDEX IF NOT EXISTS idx_terms_academic_year ON public.terms(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_terms_status ON public.terms(status);
CREATE INDEX IF NOT EXISTS idx_subjects_user ON public.subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_term ON public.subjects(term_id);
CREATE INDEX IF NOT EXISTS idx_subjects_status ON public.subjects(status);
CREATE INDEX IF NOT EXISTS idx_subject_topics_user ON public.subject_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_subject_topics_subject ON public.subject_topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_topics_order ON public.subject_topics(subject_id, order_index);
CREATE INDEX IF NOT EXISTS idx_assessments_user ON public.assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_term ON public.assessments(term_id);
CREATE INDEX IF NOT EXISTS idx_assessments_subject ON public.assessments(subject_id);
CREATE INDEX IF NOT EXISTS idx_assessments_due ON public.assessments(due_at);
CREATE INDEX IF NOT EXISTS idx_exams_user ON public.exams(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_term ON public.exams(term_id);
CREATE INDEX IF NOT EXISTS idx_exams_subject ON public.exams(subject_id);
CREATE INDEX IF NOT EXISTS idx_exams_date ON public.exams(exam_date);
CREATE INDEX IF NOT EXISTS idx_tasks_academic_subject ON public.tasks(academic_subject_id);
CREATE INDEX IF NOT EXISTS idx_tasks_academic_topic ON public.tasks(academic_topic_id);

-- 12. Updated_At Triggers
CREATE TRIGGER set_academic_years_updated_at
  BEFORE UPDATE ON public.academic_years
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_terms_updated_at
  BEFORE UPDATE ON public.terms
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_subject_topics_updated_at
  BEFORE UPDATE ON public.subject_topics
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 13. Enable Row Level Security (RLS)
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_topics ENABLE ROW LEVEL SECURITY;

-- 14. RLS Policies: public.academic_years
CREATE POLICY "academic_years_select_policy"
  ON public.academic_years FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "academic_years_insert_policy"
  ON public.academic_years FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "academic_years_update_policy"
  ON public.academic_years FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "academic_years_delete_policy"
  ON public.academic_years FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

-- 15. RLS Policies: public.terms
CREATE POLICY "terms_select_policy"
  ON public.terms FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "terms_insert_policy"
  ON public.terms FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "terms_update_policy"
  ON public.terms FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "terms_delete_policy"
  ON public.terms FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

-- 16. RLS Policies: public.subjects
CREATE POLICY "subjects_select_policy"
  ON public.subjects FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "subjects_insert_policy"
  ON public.subjects FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      user_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
      AND term_id IN (
        SELECT t.id FROM public.terms t
        WHERE t.user_id = subjects.user_id
      )
    )
  );

CREATE POLICY "subjects_update_policy"
  ON public.subjects FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      user_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
      AND term_id IN (
        SELECT t.id FROM public.terms t
        WHERE t.user_id = subjects.user_id
      )
    )
  );

CREATE POLICY "subjects_delete_policy"
  ON public.subjects FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

-- 17. RLS Policies: public.subject_topics
CREATE POLICY "subject_topics_select_policy"
  ON public.subject_topics FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "subject_topics_insert_policy"
  ON public.subject_topics FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      user_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
      AND subject_id IN (
        SELECT s.id FROM public.subjects s
        WHERE s.user_id = subject_topics.user_id
      )
    )
  );

CREATE POLICY "subject_topics_update_policy"
  ON public.subject_topics FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      user_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
      AND subject_id IN (
        SELECT s.id FROM public.subjects s
        WHERE s.user_id = subject_topics.user_id
      )
    )
  );

CREATE POLICY "subject_topics_delete_policy"
  ON public.subject_topics FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

-- 18. RLS Policies: public.assessments
CREATE POLICY "assessments_select_policy"
  ON public.assessments FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "assessments_insert_policy"
  ON public.assessments FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      user_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
      AND term_id IN (
        SELECT t.id FROM public.terms t
        WHERE t.user_id = assessments.user_id
      )
      AND (
        subject_id IS NULL OR subject_id IN (
          SELECT s.id FROM public.subjects s
          WHERE s.user_id = assessments.user_id
        )
      )
    )
  );

CREATE POLICY "assessments_update_policy"
  ON public.assessments FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      user_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
      AND term_id IN (
        SELECT t.id FROM public.terms t
        WHERE t.user_id = assessments.user_id
      )
      AND (
        subject_id IS NULL OR subject_id IN (
          SELECT s.id FROM public.subjects s
          WHERE s.user_id = assessments.user_id
        )
      )
    )
  );

CREATE POLICY "assessments_delete_policy"
  ON public.assessments FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

-- 19. RLS Policies: public.assessment_topics (Joins to assessment)
CREATE POLICY "assessment_topics_select_policy"
  ON public.assessment_topics FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.profiles p ON p.id = a.user_id
      WHERE a.id = assessment_topics.assessment_id
      AND p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "assessment_topics_insert_policy"
  ON public.assessment_topics FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.profiles p ON p.id = a.user_id
      WHERE a.id = assessment_topics.assessment_id
      AND p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "assessment_topics_delete_policy"
  ON public.assessment_topics FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.profiles p ON p.id = a.user_id
      WHERE a.id = assessment_topics.assessment_id
      AND p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

-- 20. RLS Policies: public.exams
CREATE POLICY "exams_select_policy"
  ON public.exams FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "exams_insert_policy"
  ON public.exams FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      user_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
      AND term_id IN (
        SELECT t.id FROM public.terms t
        WHERE t.user_id = exams.user_id
      )
      AND (
        subject_id IS NULL OR subject_id IN (
          SELECT s.id FROM public.subjects s
          WHERE s.user_id = exams.user_id
        )
      )
    )
  );

CREATE POLICY "exams_update_policy"
  ON public.exams FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      user_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
      AND term_id IN (
        SELECT t.id FROM public.terms t
        WHERE t.user_id = exams.user_id
      )
      AND (
        subject_id IS NULL OR subject_id IN (
          SELECT s.id FROM public.subjects s
          WHERE s.user_id = exams.user_id
        )
      )
    )
  );

CREATE POLICY "exams_delete_policy"
  ON public.exams FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

-- 21. RLS Policies: public.exam_topics (Joins to exam)
CREATE POLICY "exam_topics_select_policy"
  ON public.exam_topics FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.exams e
      JOIN public.profiles p ON p.id = e.user_id
      WHERE e.id = exam_topics.exam_id
      AND p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "exam_topics_insert_policy"
  ON public.exam_topics FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.exams e
      JOIN public.profiles p ON p.id = e.user_id
      WHERE e.id = exam_topics.exam_id
      AND p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "exam_topics_delete_policy"
  ON public.exam_topics FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.exams e
      JOIN public.profiles p ON p.id = e.user_id
      WHERE e.id = exam_topics.exam_id
      AND p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );
