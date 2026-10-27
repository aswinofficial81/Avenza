# DSA Domain - Phase 13

## Overview

The DSA (Data Structures and Algorithms) foundation module provides a structured system for tracking, practicing, and reviewing algorithmic problem solving. It integrates with Avenza's existing Phase 12 skills, evidence, goals, and tasks systems to provide an evidence-driven learning experience.

## Architectural Invariants

The DSA domain strictly adheres to seven core architectural invariants:

1. **Mastery Ownership Exclusivity**: DSA does **NOT** implement a second mastery system. Mastery belongs exclusively to Phase 12 Skills (`novice | learning | proficient | mastered`). DSA tracks performance metrics only: attempt count, solved count, solve rate, failure rate, solve time, and spaced repetition review stages (0 through 3).
2. **Deterministic Recommendation**: The recommendation engine is strictly deterministic. There is **NO** `Math.random()`, no randomized shuffling, and no non-deterministic selection. Identical input state and timestamp produces the identical recommended problem.
3. **No Automatic Entity Completion**: Solving a DSA problem does **NOT** automatically complete a Goal, Milestone, or Task. It produces evidence and progress signals only.
4. **Historical Execution Preservation**: The `dsa_attempts` table is an append-only log of user attempts. An execution history of `failed -> failed -> solved` preserves all three distinct attempt records. Deletions are forbidden to users.
5. **Idempotent Evidence Generation**: A solved DSA attempt generates at most one evidence record (`evidence_type: 'dsa_problem_solved'`). Duplicate processing for the same attempt ID is idempotent via unique constraint `(user_id, source_type, source_id)`. Failed attempts never produce solved evidence.
6. **Focus Independence**: Focus session completion does not equal or imply problem solved.
7. **Skill Decoupling**: Creating or solving a problem does not automatically create or rename a Skill. Skills must be linked explicitly.

## Core Concepts

### DSA Problem
A DSA problem represents a specific algorithmic challenge. Each problem tracks:
- Title, slug, description, external URL
- Difficulty level (`easy`, `medium`, `hard`)
- Source (`user`, `system`, `imported`)
- Status (`active`, `archived`)
- Derived projections recomputed deterministically from attempts:
  - `attempt_count`, `solved_count`, `failed_count`
  - `last_attempt_at`, `last_solved_at`
  - `next_review_at`, `revision_count`, `review_stage` (0 to 3)

### DSA Topic
Topics categorize problems hierarchically (e.g., "Arrays", "Binary Search", "Dynamic Programming").
- Unique slug per user
- Enforces strict DAG hierarchy: self-parenting and circular references are blocked by database triggers
- Cross-user parent assignments are rejected

### DSA Attempt
An immutable record of a user working on a problem:
- Status: `attempted`, `solved`, `failed`, `abandoned`
- Timestamps: `occurred_at`, `started_at`, `submitted_at`
- Optional metrics: `solve_time_minutes`, `language`, `notes`
- At most one `attempted` (in-progress) attempt permitted per problem at any given time

### Spaced Repetition System
A deterministic review scheduler based on successful solve milestones:
- **Stage 0**: Unsolved (no review scheduled)
- **Stage 1 (First solve)**: `next_review_at = last_solved_at + 2 days`
- **Stage 2 (Second successful revision)**: `next_review_at = last_solved_at + 7 days`
- **Stage 3 (Third+ successful revision)**: `next_review_at = last_solved_at + 21 days`
- **Documented Failure Behavior**: A failed attempt on a previously solved problem does not increment the revision stage or advance the review interval. It triggers a "recent failure" signal in the recommendation engine to prompt review.

### Weak Area Detection Algorithm
Weak areas are calculated deterministically across topics:
- **Threshold 1**: Minimum 3 attempts in the topic (`attempt_count >= 3`)
- **Threshold 2**: Failure rate strictly greater than 50% (`failed_count / attempt_count > 0.50`)
- **Ranking**: Ranked descending by failure rate, then descending by attempt count, tie-broken by `topic_id` ascending.
- **Boundary Verification**:
  - 2 attempts (2 failed) → **No weak area** (< 3 attempts)
  - 3 attempts with 1 failure (33.3%) → **No weak area** (<= 50%)
  - 3 attempts with 2 failures (66.7%) → **Weak area** (> 50%)
  - 3 attempts with 3 failures (100.0%) → **Weak area** (> 50%)
- **Term**: Labeled as a performance signal / diagnostic indicator, **never** called "mastery".

### Recommendation Engine
Selects the next recommended problem deterministically according to prioritized criteria:
1. **Revision Due**: Problems where `next_review_at <= now()`, ordered by `next_review_at` ascending, tie-broken by `problem_id` ascending.
2. **Recent Failure**: Problems with a failed attempt within the last 7 days that are not yet solved, ordered by `occurred_at` descending, tie-broken by `problem_id` ascending.
3. **Weak Area Problems**: Unsolved problems belonging to detected weak-area topics, tie-broken by `problem_id` ascending.
4. **Goal Relevance**: Problems linked to active user goals, tie-broken by `problem_id` ascending.
5. **Difficulty Progression / Recency**: Unsolved active problems ordered by difficulty (`easy` -> `medium` -> `hard`) then by creation date, tie-broken by `problem_id` ascending.
6. **No Candidates**: Returns `null` deterministically if no problems match.

## Database Schema

Applied via migration `supabase/migrations/20261004000008_dsa.sql`:
- `public.dsa_problems`
- `public.dsa_topics`
- `public.dsa_attempts`
- `public.dsa_problem_topics`
- `public.dsa_problem_skills`
- `public.dsa_problem_goals`
- `public.dsa_problem_tasks`

### Row Level Security (RLS)
All DSA tables have RLS enabled with Clerk user isolation:
- `service_role` has administrative access.
- Authenticated users can only read, insert, update, or delete their own rows (`auth.jwt() ->> 'sub'` mapping to `profiles.clerk_user_id`).
- End users are strictly denied DELETE privileges on `dsa_attempts` to preserve audit history.