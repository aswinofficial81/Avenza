-- ==============================================================================
-- AVENZA EVIDENCE DOMAIN MIGRATION
-- Phase 9: Foundational Evidence Domain + Links + RLS
-- ==============================================================================

-- 1. Evidence Table
CREATE TABLE IF NOT EXISTS public.evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  evidence_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT,
  source_reference TEXT,
  external_url TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  evidence_strength TEXT NOT NULL DEFAULT 'medium',
  reliability TEXT NOT NULL DEFAULT 'medium',
  directness TEXT NOT NULL DEFAULT 'direct',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key: strictly owned by profile with CASCADE on profile deletion
  CONSTRAINT fk_evidence_user_id
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  -- Valid Evidence Types
  CONSTRAINT chk_evidence_type
    CHECK (evidence_type IN (
      'task_completion',
      'focus_session',
      'manual',
      'artifact',
      'assessment',
      'external_activity',
      'external_result',
      'project_activity',
      'custom'
    )),

  -- Valid Source Types
  CONSTRAINT chk_evidence_source_type
    CHECK (source_type IN (
      'task',
      'focus_session',
      'user',
      'assessment',
      'project',
      'external_provider',
      'system'
    )),

  -- Valid Verification Statuses
  CONSTRAINT chk_evidence_verification_status
    CHECK (verification_status IN ('unverified', 'verified', 'rejected')),

  -- Quality Attributes
  CONSTRAINT chk_evidence_strength
    CHECK (evidence_strength IN ('low', 'medium', 'high')),

  CONSTRAINT chk_evidence_reliability
    CHECK (reliability IN ('low', 'medium', 'high')),

  CONSTRAINT chk_evidence_directness
    CHECK (directness IN ('indirect', 'direct')),

  -- Field Constraints
  CONSTRAINT chk_evidence_title_length
    CHECK (length(title) > 0 AND length(title) <= 255),

  CONSTRAINT chk_evidence_description_length
    CHECK (description IS NULL OR length(description) <= 2000),

  CONSTRAINT chk_evidence_notes_length
    CHECK (notes IS NULL OR length(notes) <= 2000),

  CONSTRAINT chk_evidence_external_url_length
    CHECK (external_url IS NULL OR length(external_url) <= 1000)
);

-- 2. Partial Unique Index: Duplicate source protection
-- Prevents duplicate evidence for the exact same underlying entity/source
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_user_source_unique
  ON public.evidence (user_id, source_type, source_id)
  WHERE source_id IS NOT NULL;

-- 3. Indexes for evidence querying & filtering
CREATE INDEX IF NOT EXISTS idx_evidence_user_occurred
  ON public.evidence (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_user_type
  ON public.evidence (user_id, evidence_type);

CREATE INDEX IF NOT EXISTS idx_evidence_user_source
  ON public.evidence (user_id, source_type);

CREATE INDEX IF NOT EXISTS idx_evidence_user_verification
  ON public.evidence (user_id, verification_status);

-- 4. Evidence Links Table
-- Relates a single evidence item to multiple entities (goal, milestone, task)
CREATE TABLE IF NOT EXISTS public.evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key: deleted if evidence is deleted
  CONSTRAINT fk_evidence_links_evidence_id
    FOREIGN KEY (evidence_id)
    REFERENCES public.evidence(id)
    ON DELETE CASCADE,

  -- Supported Entity Types
  CONSTRAINT chk_evidence_links_entity_type
    CHECK (entity_type IN ('goal', 'milestone', 'task')),

  -- Unique link per evidence and entity
  CONSTRAINT uq_evidence_links_evidence_entity
    UNIQUE (evidence_id, entity_type, entity_id)
);

-- 5. Indexes for evidence links
CREATE INDEX IF NOT EXISTS idx_evidence_links_evidence_id
  ON public.evidence_links (evidence_id);

CREATE INDEX IF NOT EXISTS idx_evidence_links_entity
  ON public.evidence_links (entity_type, entity_id);

-- 6. Attach updated_at trigger to evidence
DROP TRIGGER IF EXISTS set_evidence_updated_at ON public.evidence;
CREATE TRIGGER set_evidence_updated_at
  BEFORE UPDATE ON public.evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_links ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies: public.evidence
CREATE POLICY "evidence_select_policy"
  ON public.evidence
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "evidence_insert_policy"
  ON public.evidence
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "evidence_update_policy"
  ON public.evidence
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

CREATE POLICY "evidence_delete_policy"
  ON public.evidence
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

-- 9. RLS Policies: public.evidence_links
CREATE POLICY "evidence_links_select_policy"
  ON public.evidence_links
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR evidence_id IN (
      SELECT e.id FROM public.evidence e
      WHERE e.user_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
    )
  );

CREATE POLICY "evidence_links_insert_policy"
  ON public.evidence_links
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR evidence_id IN (
      SELECT e.id FROM public.evidence e
      WHERE e.user_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
    )
  );

CREATE POLICY "evidence_links_update_policy"
  ON public.evidence_links
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR evidence_id IN (
      SELECT e.id FROM public.evidence e
      WHERE e.user_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR evidence_id IN (
      SELECT e.id FROM public.evidence e
      WHERE e.user_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
    )
  );

CREATE POLICY "evidence_links_delete_policy"
  ON public.evidence_links
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR evidence_id IN (
      SELECT e.id FROM public.evidence e
      WHERE e.user_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
      )
    )
  );
