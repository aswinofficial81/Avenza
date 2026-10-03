# Phase 12 Completion Report — Unified Skills + Mastery Foundation

**Commit**: `031aa11`
**Date**: 2026-10-03

---

## 1. Objective

Build a unified skill system connecting Academics, Goals, Tasks, and Evidence into a common capability model that can answer:

- "What skills am I developing?"
- "What evidence supports those skills?"
- "What is my current demonstrated mastery?"
- "How confident is Avenza in that assessment?"
- "Which skills may need more development?"

Distinguish: SKILL vs EVIDENCE vs MASTERY vs CONFIDENCE.

---

## 2. Skill Architecture

User-owned skills with:
- Self-referencing parent hierarchy
- Slug uniqueness per user
- Deterministic mastery engine (pure function)
- Explicit relationship model to Evidence, Goals, Tasks, and Academic Topics

No global taxonomy. No automatic skill inference from titles. No AI.

---

## 3. Database Schema

**Migration**: `supabase/migrations/20261003000007_skills.sql`

### Tables Created

| Table | Purpose |
|---|---|
| `skills` | Core skill entity |
| `skill_evidence` | Skill ↔ Evidence links |
| `skill_goals` | Skill ↔ Goal links |
| `skill_tasks` | Skill ↔ Task links |
| `skill_topics` | Skill ↔ Academic Topic links |

### Custom Types

| Type | Values |
|---|---|
| `skill_status` | `active`, `archived` |
| `skill_source` | `user`, `system`, `imported` |
| `mastery_state_enum` | `unknown`, `exploring`, `learning`, `developing`, `proficient`, `strong`, `needs_review`, `inactive` |

---

## 4. Relationships

All relationships are user-scoped. Every relationship row enforces:
- `user_id` matching on both sides (DB trigger `check_skill_relationship_user_match`)
- Uniqueness constraint per pair
- Cascade delete on skill deletion

---

## 5. Evidence Integration

`skill_evidence` table connects skills to Phase 9 evidence records.
Evidence linking is always **explicit** — the system never fabricates associations.
Rejected evidence is excluded from mastery computation.

---

## 6. Mastery Model

Implemented in: `apps/api/src/modules/skills/skills.mastery.ts`

Mastery is:
- Derived — not user-entered
- Deterministic — identical inputs → identical outputs
- Pure — no `Date.now()`, no randomness, no network calls, no LLM
- Bounded — score in `[0, 100]`
- Explainable — every result includes a deterministic explanation string

The mastery calculation is included in `GET /api/v1/skills/:id` and `GET /api/v1/skills/:id/mastery`.

---

## 7. Confidence Model

| Level | Criteria |
|---|---|
| `high` | ≥4 items, ≥2 verified, ≥2 source types, within 120 days |
| `medium` | ≥2 items with verification or ≥3 items, within 180 days |
| `low` | All other cases |

---

## 8. Recency

Recency decay weights (by days since `occurred_at`):
- 0–30: 1.00 | 31–90: 0.90 | 91–180: 0.70 | 181–365: 0.45 | >365: 0.25

State overrides:
- >365 days inactive: `inactive`
- >180 days inactive: `needs_review`

---

## 9. Evidence Quality

Phase 9 attributes (`evidence_strength`, `verification_status`, `reliability`, `directness`) are used as multiplicative weights. No second quality system was introduced.

---

## 10. Skill States

8 mastery states: `unknown`, `exploring`, `learning`, `developing`, `proficient`, `strong`, `needs_review`, `inactive`

4 health states: `inactive`, `needs_attention`, `developing`, `healthy`

---

## 11. API

All routes registered at `/api/v1/skills`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/skills` | List all skills with derived mastery |
| POST | `/api/v1/skills` | Create a skill |
| GET | `/api/v1/skills/:id` | Full skill detail with mastery and all relations |
| PATCH | `/api/v1/skills/:id` | Update skill |
| POST | `/api/v1/skills/:id/archive` | Archive skill |
| DELETE | `/api/v1/skills/:id` | Delete skill |
| GET | `/api/v1/skills/:id/mastery` | Derived mastery for a skill |
| POST | `/api/v1/skills/:id/evidence` | Link evidence to skill |
| DELETE | `/api/v1/skills/:id/evidence/:evidenceId` | Unlink evidence |
| POST | `/api/v1/skills/:id/goals` | Link goal |
| DELETE | `/api/v1/skills/:id/goals/:goalId` | Unlink goal |
| POST | `/api/v1/skills/:id/tasks` | Link task |
| DELETE | `/api/v1/skills/:id/tasks/:taskId` | Unlink task |
| POST | `/api/v1/skills/:id/topics` | Link academic topic |
| DELETE | `/api/v1/skills/:id/topics/:topicId` | Unlink topic |

---

## 12. Frontend

### Pages

| Route | Component | Description |
|---|---|---|
| `/skills` | `SkillsPage` | Directory of all skills with mastery states |
| `/skills/:id` | `SkillDetailPage` | Full skill view with mastery card and relation tabs |

### Components

| Component | Description |
|---|---|
| `MasteryBadge` | Displays mastery state with color coding |
| `ConfidenceIndicator` | Shows low/medium/high confidence |
| `HealthBadge` | Displays skill health state |
| `CreateSkillModal` | Create new skill with optional parent/category |
| `EditSkillModal` | Edit existing skill |
| `LinkEvidenceModal` | Link evidence to a skill |
| `LinkGoalModal` | Link goal to a skill |
| `LinkTaskModal` | Link task to a skill |

### Query Hooks

- `useSkills()`, `useSkillDetail()`, `useCreateSkill()`, `useUpdateSkill()`, `useArchiveSkill()`
- `useLinkEvidenceToSkill()`, `useUnlinkEvidenceFromSkill()`
- `useLinkGoalToSkill()`, `useUnlinkGoalFromSkill()`
- `useLinkTaskToSkill()`, `useUnlinkTaskFromSkill()`
- `useLinkTopicToSkill()`, `useUnlinkTopicFromSkill()`

---

## 13. RLS

RLS enabled on all 5 new tables. All policies use `user_id = auth.uid()::text`.

DB-level triggers enforce:
- Self-parent prevention (`prevent_skill_self_parent`)
- Cycle detection (`prevent_skill_hierarchy_cycle`)
- Cross-user relationship guard (`check_skill_relationship_user_match`)

---

## 14. Security

- `user_id` always derived from Clerk JWT via `requireAuth` middleware.
- Never trusted from request body or query params.
- No frontend trust.
- Cross-user isolation at DB, API service, and RLS layers.

---

## 15. Tests

| Suite | File | Tests |
|---|---|---|
| DB skills | `apps/api/src/db/skills.database.test.ts` | 10 |
| Skills module | `apps/api/src/modules/skills/skills.test.ts` | 12 |
| SkillsPage | `apps/web/src/routes/SkillsPage.test.tsx` | 4 |
| All API tests | `apps/api` total | 215 |
| All web tests | `apps/web` total | 82 |

**Total: 297 tests passing across all packages.**

Mastery engine tests cover:
- No evidence → `unknown`
- Rejected-only evidence → `unknown`
- Determinism (identical inputs → identical outputs)
- Single strong > multiple weak
- Old evidence → `needs_review`
- Diverse verified recent → `high` confidence

---

## 16. Typecheck

```
pnpm --filter @avenza/web typecheck → exit code 0
pnpm --filter @avenza/api typecheck → exit code 0
pnpm --filter @avenza/shared typecheck → exit code 0
```

---

## 17. Lint

```
pnpm run lint → exit code 0
0 errors, 0 warnings
```

---

## 18. Build

```
pnpm run build → exit code 0
@avenza/shared: tsup build success (ESM + CJS + .d.ts)
@avenza/api: tsup build success (ESM)
@avenza/web: vite build success (758 KB bundle)
```

---

## 19. Migration Verification

Migration: `supabase/migrations/20261003000007_skills.sql`

Applied to local Supabase instance via `npx supabase db reset`.

Tables verified:
- `skills` ✓
- `skill_evidence` ✓
- `skill_goals` ✓
- `skill_tasks` ✓
- `skill_topics` ✓

Indexes verified:
- `idx_skills_user_id` ✓
- `idx_skills_status` ✓
- Unique `(user_id, slug)` partial index ✓
- Relation table user_id indexes ✓

Constraints verified:
- `CHECK (parent_skill_id <> id)` ✓
- Unique pairs on all relation tables ✓

RLS verified: 5 tables × 4 operation policies ✓

DB tests pass (10 tests in skills.database.test.ts) ✓

---

## 20. Visual QA

Tested at: 375px, 768px, 1024px, 1440px — dark mode.

**SkillsPage**: Skills directory with mastery badge, category pill, status, evidence count, parent breadcrumb, archive action. Responsive grid layout.

**SkillDetailPage**: Mastery card (state, confidence, health), tabbed relations (Evidence, Goals, Tasks, Academic Topics, Sub-skills), link modals for each relation. Breadcrumb back navigation.

Design follows existing Avenza system: technical, minimal, no neon gamification.

---

## 21. Performance

- Evidence fetched per-skill with bounded window (all evidence for linked skill IDs).
- No N+1 on list view — mastery calculated per skill from linked evidence.
- Diminishing returns curve bounds mastery growth on evidence flooding.
- No unnecessary mastery recalculation on list; per-request derivation acceptable at current scale.

---

## 22. Known Limitations

- No caching layer for mastery; recalculated per API request.
- Large evidence libraries (>50 items per skill) will apply diminishing returns fully — by design.
- `SkillDetailPage` does not support linking academic topics from the UI in Phase 12 (linking modal deferred; read-only display available).

---

## 23. Deferred Functionality

| Feature | Reason |
|---|---|
| Topic linking modal in SkillDetailPage UI | Complexity; DB and API support is complete |
| Project skill integration | Projects do not yet exist (Phase 15) |
| DSA provider integrations | Phase 13 |
| GitHub API | Phase 14 |
| Skill gap recommendation engine | Phase 16+ |
| Analytics / weekly review | Phase 19–20 |
| Gamification | Phase 21 |
| Manual mastery override | Not permitted in current model |
| Global skill taxonomy / sharing | Phase 12 is user-owned only |

---

## 24. Commit Hash

`031aa11`

---

## PHASE 12 PASSED
