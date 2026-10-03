# Phase 10 Completion Report: Basic Intelligence & Next Best Action

**Status**: PHASE 10 PASSED  
**Commit Baseline**: `f5582fd7a86aef63b89211f2672dd8153856e58a`

---

## 1. Objective
Build a foundational, deterministic Intelligence Engine capable of answering: **"What should I do next?"**

The system:
- Gathers relevant, bounded user context (goals, tasks, dependencies, schedule, recent execution, evidence).
- Generates real, executable candidate actions.
- Scores candidates using deterministic contextual signals and explainable weights.
- Returns **ONE primary Next Best Action** with factual explanation, confidence level, and score breakdown.
- Handles calm no-action states when all tasks are complete or blocked.
- Never hallucinates facts, never mutates user plans automatically, and maintains 100% user control.
- Operates purely deterministically without requiring an LLM.

---

## 2. Architecture
```
apps/api/src/modules/intelligence/
  ├── intelligence.routes.ts          (Fastify routes for GET /api/v1/intelligence/next-action)
  ├── intelligence.controller.ts      (Authentication verification & request validation)
  ├── intelligence.service.ts         (Next Best Action orchestration)
  ├── context/
  │   ├── context.types.ts            (Context data structures)
  │   └── context-builder.ts          (Bounded query collector)
  ├── candidates/
  │   ├── candidate.types.ts          (Candidate action interfaces)
  │   ├── candidate-generator.ts      (Action eligibility & type assignment)
  │   └── candidate-generator.test.ts (Eligibility test suite)
  ├── scoring/
  │   ├── scoring.types.ts            (Scored candidate interfaces)
  │   ├── candidate-scoring.ts        (Pure deterministic scoring engine)
  │   └── candidate-scoring.test.ts   (Signal independence & determinism tests)
  └── intelligence.test.ts            (Full HTTP integration test suite)

packages/shared/src/
  ├── intelligence.types.ts           (Zod schemas and DTOs)
  └── intelligence.types.test.ts      (Schema validation tests)

apps/web/src/features/intelligence/
  ├── useNextAction.ts                (TanStack Query hook)
  └── components/
      ├── NextBestActionCard.tsx      (Responsive UI card: Loading, Error, Empty, Recommendation)
      └── NextBestActionCard.test.tsx (UI component test suite)
```

---

## 3. Context Sources
1. **User Identity & Timezone**: Clerk auth ID mapped to profile with resolved effective timezone.
2. **Active Goals**: Bounded to 50 active goals with priority.
3. **Active Milestones**: Milestones belonging to active goals.
4. **Open Tasks**: Up to 200 non-terminal tasks (`inbox`, `planned`, `scheduled`, `in_progress`, `deferred`).
5. **Dependency Map**: Batch summaries identifying blocked tasks and reverse dependencies (`unblocks_count`).
6. **Recent Focus Execution**: Recent completed focus sessions and currently active focus session.
7. **Recent Evidence**: Recent verified and unverified evidence items linked to tasks.

---

## 4. Candidate Types
- `start_task`: Actionable task in `inbox` or `planned` state.
- `continue_task`: In-progress task with an active or recent focus session.
- `focus_task`: High priority, deep work, or estimated duration $\ge 30$ minutes.
- `complete_task`: In-progress task whose actual execution has met or exceeded estimated duration.
- `review_task`: Task with unverified evidence awaiting review.

---

## 5. Eligibility Rules
- Must belong to the authenticated user.
- Must not be completed, cancelled, or skipped.
- **Must not be blocked**: Tasks with incomplete prerequisites are disqualified. The engine prioritizes the uncompleted prerequisite instead.

---

## 6. Reason Codes
- `overdue`: Due date precedes current calendar date.
- `due_today`: Due date matches current calendar date.
- `critical_priority`: Marked as Critical priority.
- `high_priority`: Marked as High priority.
- `dependency_unblock`: Unblocks one or more downstream tasks.
- `in_progress_continuation`: Ongoing work or active focus session.
- `scheduled_now`: Scheduled for execution today.
- `deadline_soon`: Deadline within 48 hours.
- `stale_task`: Open $\ge 14$ days without progress.
- `goal_priority`: Linked to active user goal.
- `user_priority`: Standard actionable task.
- `no_actionable_tasks`: All tasks completed or blocked.

---

## 7. Scoring Model
Bounded score from 0 to 100:
- **Priority Signal**: `critical` (40), `high` (30), `medium` (20), `low` (10).
- **Urgency Signal**: Overdue (25), Due Today (20), Deadline $\le 48\text{h}$ (12), Later (4), None (0).
- **Goal Signal**: Active Goal (+10), Active Milestone (+5).
- **Dependency Signal**: $\min(\text{unblocks\_count} \times 5, 15)$.
- **Schedule Signal**: Scheduled today (15).
- **Continuation Signal**: Active session (10), In-progress with recent session (8), In-progress (5).
- **Staleness Signal**: Open $\ge 14$ days (5).

---

## 8. Priority Precedence
Explicit user priority has strong precedence. A Critical priority task (40 pts) outscores a Low priority task even when due today ($10 + 20 = 30$ pts). Derived signals never silently override explicit user intent.

---

## 9. Tie Breaking
Pure deterministic order:
1. Total score (descending)
2. Priority (`critical` > `high` > `medium` > `low`)
3. Urgency rank (`overdue` > `due_today` > `deadline_soon` > other)
4. Unblock count (descending)
5. Goal attached (active goal first)
6. Scheduled today (first)
7. Due date (earlier first)
8. Created at (older first)
9. Stable task ID (`localeCompare`)

---

## 10. API Specification
- **Route**: `GET /api/v1/intelligence/next-action`
- **Query**: Optional `date` (`YYYY-MM-DD`) and `timezone`
- **Auth**: Clerk Bearer token required (401 on unauthorized)
- **Response**: Standard Avenza API envelope with `action`, `reason`, `confidence`, `generatedAt`, and `scoreBreakdown`.

---

## 11. Frontend Implementation
- Integrated into `TodayPage.tsx` directly above execution sections.
- Component: `NextBestActionCard.tsx`
  - Loading: Structured skeleton animation.
  - Error: Error explanation with "Retry" action.
  - Calm Empty: All Clear banner with "Plan New Task" action.
  - Recommendation: Action type badge, reason badge, confidence pill, title link, quote explanation, metadata chips, and primary "Start Focus" CTA.
  - Query invalidation on task creation, status updates, deletions, and dependency changes.

---

## 12. Verification & Test Results

### Monorepo Test Summary (`npm test`):
- `packages/shared`: 8 test files, 37 passed (100%)
- `apps/api`: 15 test files, 178 passed (100%)
- `apps/web`: 15 test files, 74 passed (100%)
- **Total**: 38 test files, **289 passed**, 0 failed.

### Dedicated Intelligence Tests:
- `candidate-scoring.test.ts`: 12 tests covering signal independence, conflict scenarios, 100-run determinism, and tie-breaking.
- `candidate-generator.test.ts`: 6 tests covering eligibility, blocked exclusion, and candidate type assignment.
- `intelligence.test.ts`: 8 tests covering auth, empty state, single task scoring, dependency unblocking, cross-user isolation, and validation.
- `NextBestActionCard.test.tsx`: 7 tests covering loading skeleton, error retry, empty state, recommendation display, CTA clicks, and fallback rendering.

---

## 13. Quality Gates
- **Typecheck**: `pnpm run typecheck` passed cleanly across all packages (`@avenza/shared`, `@avenza/api`, `@avenza/web`).
- **Lint**: `npx eslint src/modules/intelligence` and `npx eslint src/features/intelligence` passed with 0 errors.
- **Build**: `pnpm run build` passed with all bundles generated.

---

## 14. Visual QA & Responsive Breakpoints
- **Mobile (375px)**: Compact stacked layout, primary CTA accessible, metadata chips wrap cleanly.
- **Tablet (768px)**: Balanced two-column header with inline metadata and side actions.
- **Desktop (1024px & 1440px)**: Refined card with left accent indicator bar, high contrast typography, and clear CTA alignment.
- **Light & Dark Theme**: Fully supported with curated design tokens (Navy `#2F4156`, Teal `#567C8D`, Surface `#172330`, Surface 2 `#20303D`).

---

## 15. Security & Isolation
- User ID derived strictly from Clerk authentication; no client-supplied user IDs accepted.
- All repository queries enforce user-level scoping.
- Zero API keys or secrets exposed to the client.

---

## 16. Performance Boundaries
- Bounded database queries ensure strict $O(1)$ database load per request.
- Batch fetching for dependency summaries prevents $N+1$ query cascades.
- TanStack Query 30-second stale cache prevents unnecessary network polling.

---

## 17. Known Limitations
- Scheduled window matching currently operates at local calendar day resolution. Minute-level time block schedule detection will be enhanced in future scheduling phases.
- Academic exam pressure signals are stubbed in types but not evaluated until Phase 12 (Academics).

---

## 18. Deferred Features (Strict Phase Boundary)
- FreeLLM & AI reasoning calls (deferred to Phase 11+).
- Conversational AI Coach.
- Automatic plan rescheduling or auto-completion.
- Weekly review and retrospective analytics.
- Gamification, XP, and streak systems.
- External coding platforms (LeetCode, GitHub, Codeforces).

---

## 19. Definition of Done Checklist
- [x] Existing architecture preserved
- [x] No unnecessary database table (pure derived intelligence)
- [x] Intelligence module cleanly isolated in `apps/api/src/modules/intelligence`
- [x] Context Engine implemented with bounded queries
- [x] Candidate generation excludes blocked, completed, and cancelled tasks
- [x] Deterministic scoring with documented component weights and pure math
- [x] Explicit priority precedence strictly respected
- [x] Next Best Action API endpoint with Clerk authentication and cross-user isolation
- [x] Today page integration with responsive NextBestActionCard
- [x] Loading, error, empty, and recommendation states handled
- [x] 100% test pass rate (289 tests passed across monorepo)
- [x] Typecheck, lint, and build all green
- [x] Documentation complete (`docs/intelligence-domain.md` and `docs/phase-10-completion.md`)

**PHASE 10 PASSED**
