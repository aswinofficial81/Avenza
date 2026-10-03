# Skills Domain — Avenza Phase 12

**Phase 12: Unified Skills + Mastery Foundation**

---

## 1. Skill Model

A **Skill** is a capability or area of competence that belongs to a specific user.
It is a first-class entity with its own lifecycle, hierarchy, and mastery tracking.

### Core Fields

| Field | Type | Description |
|---|---|---|
| `id` | `uuid` | Unique primary key |
| `user_id` | `text` | Owner — derived from Clerk `profileId` |
| `parent_skill_id` | `uuid?` | Optional parent skill (must belong to same user) |
| `name` | `text` | Human-readable capability name |
| `slug` | `text` | URL-safe normalized identifier, unique per user |
| `description` | `text?` | Optional elaboration of the skill |
| `category` | `text?` | Optional grouping label |
| `status` | `enum` | `active` or `archived` |
| `source` | `enum` | `user`, `system`, or `imported` |
| `created_at` | `timestamptz` | Creation timestamp |
| `updated_at` | `timestamptz` | Last mutation timestamp (auto-managed via trigger) |

### Slug Generation

Slugs are generated deterministically from the skill name:
- Lowercased
- Spaces replaced with hyphens
- Special characters stripped
- Unique per user (enforced at DB level with partial index on `(user_id, slug)`)

Example: `"Binary Search"` → `"binary-search"`

### Source Values

| Source | Meaning |
|---|---|
| `user` | User explicitly created this skill |
| `system` | Reserved for future system-suggested skills (not used in Phase 12) |
| `imported` | Reserved for future provider imports (not used in Phase 12) |

---

## 2. Skill Hierarchy

Skills support an optional parent-child hierarchy via `parent_skill_id`.

### Hierarchy Rules

1. A skill may have at most one parent.
2. Parent and child must belong to the **same user** (enforced by DB trigger).
3. A skill cannot be its own parent (`CHECK (parent_skill_id <> id)`).
4. Circular hierarchies are rejected by the `prevent_skill_hierarchy_cycle` trigger.
5. Deleting a parent sets `parent_skill_id` to `NULL` on children (`ON DELETE SET NULL`).
6. Archiving a parent does not cascade-archive children.

---

## 3. Skill Relationships

Skills connect to other Avenza domain entities through explicit normalized tables:

| Table | Entities | Description |
|---|---|---|
| `skill_evidence` | Skill ↔ Evidence | Evidence supporting a skill claim |
| `skill_goals` | Skill ↔ Goal | Goals requiring or developing this capability |
| `skill_tasks` | Skill ↔ Task | Tasks that exercise this skill |
| `skill_topics` | Skill ↔ Academic Topic | Curriculum topics aligned to this skill |

Every relationship row validates ownership on **both sides** via DB trigger.

---

## 4. Evidence Relationship

Evidence is the **primary input** to mastery calculation.

A single evidence record can support multiple skills.
A single skill can have multiple evidence records.

**Anti-fabrication Rule**: Linking is always explicit. The system never automatically associates evidence with a skill based on task titles, topic names, or any heuristic.

---

## 5. Mastery

Mastery is a **derived estimate** of demonstrated capability.

It is not user-entered, not stored as a writable value, and never the result of an LLM call.

### Score-to-State Mapping

| Score Range | State |
|---|---|
| 0 – 9 | `unknown` |
| 10 – 24 | `exploring` |
| 25 – 44 | `learning` |
| 45 – 64 | `developing` |
| 65 – 79 | `proficient` |
| 80 – 100 | `strong` |

Score-independent overrides:
- `daysSinceLastEvidence > 365` → `inactive`
- `daysSinceLastEvidence > 180` → `needs_review`

---

## 6. Confidence

Confidence measures how reliable the mastery estimate is (separate from mastery state).

| Level | Criteria |
|---|---|
| `high` | ≥4 items, ≥2 verified, ≥2 source types, activity within 120 days |
| `medium` | ≥2 items with ≥1 verified or ≥3 items, activity within 180 days |
| `low` | All other cases |

---

## 7. Evidence Quality

Phase 9 attributes used in mastery computation:

| Attribute | Values | Role |
|---|---|---|
| `evidence_strength` | `low`, `medium`, `high` | Base score (4, 12, 24) |
| `verification_status` | `unverified`, `verified`, `rejected` | Multiplier (0.8×, 1.25×, excluded) |
| `reliability` | `low`, `medium`, `high` | Multiplier (0.6×, 0.85×, 1.0×) |
| `directness` | `indirect`, `direct` | Multiplier (0.7×, 1.0×) |

Rejected evidence is completely excluded.

---

## 8. Recency

| Age of Evidence | Recency Weight |
|---|---|
| 0–30 days | 1.00 |
| 31–90 days | 0.90 |
| 91–180 days | 0.70 |
| 181–365 days | 0.45 |
| >365 days | 0.25 |

Historical evidence is never deleted; its influence is reduced, not removed.
Reference timestamp is always passed explicitly — never `Date.now()` inside the engine.

---

## 9. Evidence Diversity

| Unique Source Types | Multiplier |
|---|---|
| 1 | 1.00× |
| 2 | 1.10× |
| ≥3 | 1.20× |

Recognized source types: `task`, `assessment`, `focus_session`, `user`, `external`.

---

## 10. Skill States

### Mastery States

| State | Description |
|---|---|
| `unknown` | No valid evidence, score <10 |
| `exploring` | Minimal early evidence, score 10–24 |
| `learning` | Repeated early-stage evidence, score 25–44 |
| `developing` | Meaningful but not proficient, score 45–64 |
| `proficient` | Solid demonstrated capability, score 65–79 |
| `strong` | Extensive verified evidence, score 80–100 |
| `needs_review` | Prior capability, no activity in 180–365 days |
| `inactive` | No activity for over 365 days |

### Skill Health

| Health | Condition |
|---|---|
| `inactive` | State is `inactive` |
| `needs_attention` | State is `needs_review`, or `daysSinceRecent >90` |
| `developing` | All other active states below `proficient` |
| `healthy` | State is `proficient` or `strong` |

---

## 11. Skill Gaps

A skill gap is a derived relationship, not a stored fact.

Gap condition:
- A goal specifies `target_mastery_state` for a skill AND
- Current derived mastery state does not meet or exceed the target

Phase 12 provides the data model. Gap computation and recommendation UI is deferred to a future phase.

---

## 12. Academic Integration

`skill_topics` table connects skills to `subject_topics` from Phase 11.

- Linking is always **explicit** — never automatic.
- Completing or covering a topic does **not** increase mastery.
- The connection provides curriculum alignment context only.

---

## 13. Goal Integration

`skill_goals` table connects skills to `goals` from Phase 5.

- A goal may specify `target_mastery_state` for the required skill level.
- Being linked to a goal does **not** increase mastery.
- Goal completion is evidence only if the user creates an explicit evidence record.

---

## 14. Task Integration

`skill_tasks` table connects skills to `tasks` from Phase 6.

- Users must explicitly link tasks to skills.
- Task completion does **not** automatically update mastery.
- The connection informs skill context, not mastery scores directly.

---

## 15. Future Project Integration

Projects (Phase 15) are not yet implemented.

When Phase 15 arrives:
- A `skill_projects` table should be created following the same ownership pattern.
- Project completions may become evidence for skills.

No project skill tables exist in Phase 12.

---

## 16. Future DSA Integration

DSA providers (LeetCode, Codeforces, etc.) are explicitly out of scope for Phase 12.

When Phase 13+ introduces DSA:
- DSA results can use `source_type: 'external'` in the evidence model.
- They can be linked to skills via `skill_evidence`.
- The mastery engine handles them without redesign.

---

## 17. RLS

All 5 new tables have RLS enabled with `user_id = auth.uid()::text` policies for all operations.

### Additional DB-Level Enforcement

- `prevent_skill_self_parent`: Trigger checking `parent_skill_id <> id`
- `prevent_skill_hierarchy_cycle`: Trigger walking ancestry to detect cycles
- `check_skill_relationship_user_match`: Trigger validating both sides of every relationship belong to the same user

---

## 18. Security

- `user_id` is **never** accepted from the request body.
- `user_id` is **always** derived from the authenticated Clerk session via `requireAuth` middleware.
- Cross-user relationships are blocked at the DB trigger level.
- No skill, evidence, or relationship can be accessed across user boundaries.
- Frontend trust is never relied upon for isolation.

---

## 19. Mastery Formula

The engine lives in `apps/api/src/modules/skills/skills.mastery.ts`.

```
For each valid evidence item:
  baseStrength: high=24, medium=12, low=4
  verificationMult: verified=1.25, unverified=0.80, rejected=excluded
  reliabilityMult: high=1.00, medium=0.85, low=0.60
  directnessMult: direct=1.00, indirect=0.70
  recencyWeight: 0-30d=1.00, 31-90d=0.90, 91-180d=0.70, 181-365d=0.45, >365d=0.25

  itemScore = baseStrength × verificationMult × reliabilityMult × directnessMult × recencyWeight

Sort itemScores descending, apply diminishing returns:
  [1.00, 0.75, 0.55, 0.40, 0.30, 0.20, 0.20, ...]

accumulated = Σ(itemScore[i] × diminishingWeight[i])
diversityMultiplier: 1 type=1.00, 2 types=1.10, ≥3 types=1.20
rawScore = accumulated × diversityMultiplier
boundedScore = clamp(round(rawScore), 0, 100)
```

Given identical inputs and referenceTimestamp → identical output (pure, deterministic).

---

## 20. Explicit Non-Goals (Phase 12)

| Non-Goal | Phase |
|---|---|
| LLM/AI mastery assessment | Never |
| Auto skill inference from task titles | Anti-fabrication rule |
| Auto skill inference from topic names | Anti-fabrication rule |
| DSA provider integrations | Phase 13+ |
| GitHub API integration | Phase 14+ |
| External OAuth | Phase 14+ |
| Adaptive task generation | Phase 18+ |
| Career skill-gap engine | Phase 16+ |
| Gamification (XP, streaks) | Phase 21+ |
| Analytics dashboard | Phase 19+ |
| Weekly review | Phase 20+ |
| Probabilistic confidence scores | No calibrated model exists |
| Global/shared skill taxonomy | User-owned only in Phase 12 |
| Project skill tables | Projects do not exist yet |
| Manual mastery override | Mastery is always derived |
