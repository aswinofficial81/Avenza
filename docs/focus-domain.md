# Avenza Focus Domain — Architecture & Technical Reference
**Tagline:** Plan. Execute. Evolve.  
**Phase:** 8 (Foundational Focus Session System)

---

## 1. Philosophy & Purpose

Focus Sessions represent Avenza's trustworthy source of **actual intentional execution**.

In the Avenza execution hierarchy:
```
     GOALS          (Phase 5: Vision & Outcomes)
       ↓
  MILESTONES        (Phase 5: Intermediate Checkpoints)
       ↓
     TASKS          (Phase 6: Concrete Executable Units)
       ↓
     TODAY          (Phase 7: Daily Execution Surface)
       ↓
     FOCUS          (Phase 8: Intentional Execution Record)
       ↓
 ACTUAL EXECUTION
```

### The Core Problem Solved by Focus
In Phase 7, the system distinguished between estimated minutes (`estimated_minutes`) and self-reported actual minutes (`task.actual_minutes`). However, self-reported actual duration on tasks is often inaccurate, subjective, and prone to guesswork or double-counting.

Phase 8 introduces **Focus Sessions** (`public.focus_sessions`) to capture real periods of focused work against a concrete task.

### Execution Records, Not Metagame
A Focus Session is an immutable execution record capturing:
- Which specific task was worked on (`task_id`)
- Server-authoritative start timestamp (`started_at`)
- Server-authoritative end timestamp (`ended_at`)
- Verified elapsed duration (`actual_minutes`)
- Session type (`focus`, `pomodoro`, `deep_work`, `revision`, `practice`, `custom`)
- Session outcome status (`active`, `completed`, `cancelled`)
- Optional qualitative notes

### What Focus Sessions Are NOT (Phase 8 Non-Goals)
- **NOT tasks or goals**: Focus sessions belong to a task; they do not have checklists or subtasks.
- **NOT calendar events**: Focus sessions record past and present work, not external calendar invitations.
- **NOT evidence events**: Phase 9 will introduce the formal Evidence domain. Focus sessions will later serve as high-fidelity inputs to Evidence.
- **NOT AI coaches**: No LLM recommendations, AI task picking, or automated summaries.
- **NOT gamification**: No XP, streaks, badges, levels, or celebration particle effects. Focus is calm, minimalist, and execution-oriented.

---

## 2. Database Schema & Invariants

### Table: `public.focus_sessions`

```sql
CREATE TABLE public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  session_type TEXT NOT NULL DEFAULT 'focus'
    CHECK (session_type IN ('focus', 'pomodoro', 'deep_work', 'revision', 'practice', 'custom')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  ended_at TIMESTAMPTZ,
  planned_minutes INTEGER NOT NULL
    CHECK (planned_minutes >= 1 AND planned_minutes <= 480),
  actual_minutes INTEGER
    CHECK (actual_minutes IS NULL OR actual_minutes >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT chk_focus_session_ended_after_started
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);
```

### Foreign Key & Task Deletion Policy
- `user_id` &rarr; `profiles(id) ON DELETE CASCADE`: If a user account/profile is deleted, their execution history is removed.
- `task_id` &rarr; `tasks(id) ON DELETE SET NULL`: Historical focus sessions are **preserved** even if the underlying task is deleted. An execution record represents real time spent, which cannot be undone by deleting a backlog item.

### The Single Active Session Invariant
A user may have at most **ONE active focus session** at any time across the entire system.
This is enforced at the database level using a partial unique index:
```sql
CREATE UNIQUE INDEX idx_focus_sessions_user_active
  ON public.focus_sessions (user_id)
  WHERE status = 'active';
```

### Performance Indexes
- `(user_id, started_at DESC)`: Primary query index for listing sessions chronologically.
- `(user_id, status)`: Fast status filtering.
- `(task_id, started_at DESC)`: Rapid task-level session history lookups.
- `(user_id, status, started_at)`: Optimized for Today's completed execution aggregation.

---

## 3. Security & Row-Level Security (RLS)

Focus Sessions are completely isolated per authenticated user:
1. RLS is enabled on `public.focus_sessions`.
2. Supabase RLS policies enforce that `auth.jwt() ->> 'sub'` matches `profiles.clerk_user_id` for all operations (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
3. The Fastify API layer authenticates requests using `requireAuth` and injects `req.auth.profileId`.
4. Client requests are never allowed to provide arbitrary `user_id`, `started_at`, `ended_at`, or `actual_minutes`.

---

## 4. Session Time Model & Authoritative Server Timestamps

### The Core Invariant
**The server is strictly authoritative for session timestamps and execution duration.**

1. **Starting**:
   - `started_at` = server `clock_timestamp()` (or `new Date().toISOString()`).
   - The client cannot supply a custom start time.
2. **Completing**:
   - `ended_at` = server `clock_timestamp()`.
   - `actual_minutes` = `Math.floor((ended_at - started_at) / 60,000)`.
   - Client duration is ignored.
3. **Timer Drift Protection (Frontend)**:
   - The client timer computes `elapsed = Math.floor((currentTime - started_at) / 1000)` on each frame/render.
   - It does NOT increment an accumulator (`elapsed += 1`), ensuring perfect accuracy across browser tab sleep, OS suspension, and background throttling.
   - The client state recovers seamlessly on page reload via `GET /api/v1/focus-sessions/active`.

### Planned vs. Actual
- `planned_minutes`: Set by user when starting (e.g. 25 min for Pomodoro, 60 min for Deep Work; bounded 1..480).
- `actual_minutes`: Measured elapsed duration upon completion.
- `planned_minutes` is never overwritten by `actual_minutes`. Both remain available for variance analysis.

### Minimum Meaningful Duration
- **Rule**: Minimum meaningful duration is **1 minute** (60 seconds).
- A session completed in less than 60 seconds records `actual_minutes = 0`.
- The session is recorded (not discarded) to maintain historical auditability, but contributes 0 minutes to execution totals.

### Cancellation Behavior
- A session may be cancelled at any time before completion via `POST /api/v1/focus-sessions/:id/cancel`.
- `status` transitions to `'cancelled'`.
- `actual_minutes` is set to `0`. Cancelled sessions never contribute to meaningful execution metrics.

---

## 5. Task Lifecycle Integration & Eligibility

### Task Eligibility
Focus sessions can only be started for actionable tasks owned by the authenticated user.
- **Allowed Task Statuses**: `inbox`, `planned`, `scheduled`, `in_progress`, `deferred`.
- **Rejected Task Statuses**:
  - `completed`: Cannot focus on a task that is already finished (`409 Conflict`).
  - `cancelled`: Cannot focus on a cancelled task (`409 Conflict`).
  - `skipped`: Cannot focus on a skipped task (`409 Conflict`).
  - Blocked tasks (tasks with unresolved prerequisites): Rejected with `409 Conflict: Cannot start focus on a blocked task`.

### Task Status Transition
- When starting a focus session on a task in `planned` or `scheduled` status, the task status is automatically transitioned to `in_progress`.
- When a focus session **completes**, the task is **NOT automatically completed**. A 45-minute focus session does not imply the task is done; task completion remains an explicit user action.

---

## 6. Today Integration & Meaningful Minutes

### Execution Precedence Hierarchy
To prevent double-counting between focus sessions and manual task minutes, Today uses a strict precedence rule:

1. **Primary Evidence**: Sum of all `completed` focus sessions whose `started_at` falls within the user's local day (`focusMinutes`).
2. **Fallback Evidence**: For tasks that were worked on / completed today but have **ZERO focus sessions today**, use `task.actual_minutes` (`fallbackTaskActualMinutes`).
3. **Non-Double-Counting**: If a task has even one completed focus session today, `task.actual_minutes` is completely ignored for today's execution total.
4. **Combined Metric**:
   $$\text{meaningfulMinutes} = \text{focusMinutes} + \text{fallbackTaskActualMinutes}$$
5. **Estimates**: `estimatedMinutesWithoutActual` tracks estimated time for unworked tasks, preserving estimate distinction.

### Local Day Attribution & Cross-Midnight Rule
Execution is attributed to the user's local calendar day derived from `user_preferences.timezone`:
- **Deterministic Attribution Rule**: The entire duration of a completed focus session is attributed to the local calendar date of its `started_at` timestamp.
- **Cross-Midnight Example**:
  - Session starts at 23:50 on October 2.
  - Session completes at 00:30 on October 3 (40 minutes).
  - The full 40 minutes are attributed to **October 2** (the local start day).
  - No partial splitting occurs in Phase 8, preserving deterministic and verifiable accounting.

---

## 7. API Specification

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/focus-sessions` | Start a new focus session (enforces single active session, task ownership & eligibility). |
| `GET` | `/api/v1/focus-sessions/active` | Get current user's active session, or `null`. Used for timer recovery. |
| `GET` | `/api/v1/focus-sessions` | List focus sessions with pagination and filters (`taskId`, `status`, `from`, `to`). |
| `GET` | `/api/v1/focus-sessions/:id` | Get details of a specific focus session owned by the user. |
| `POST` | `/api/v1/focus-sessions/:id/complete` | Complete active session, calculate server duration, record notes. |
| `POST` | `/api/v1/focus-sessions/:id/cancel` | Cancel active session, set actual_minutes to 0. |

All responses follow the standard Avenza envelope:
```json
{
  "success": true,
  "data": { ... }
}
```

---

## 8. Frontend Architecture

### Core Components (`apps/web/src/features/focus/`)
- `useFocusSession.ts`: TanStack Query hooks (`useActiveFocusSession`, `useFocusSessions`, `useStartFocusSession`, `useCompleteFocusSession`, `useCancelFocusSession`) with surgical query invalidation (`["focus"]`, `["today"]`, `["tasks"]`).
- `FocusTimer.tsx`: Clean, drift-free elapsed time counter, radial circular progress, accessible static live region (`aria-live="off"` to prevent reader spam).
- `FocusSessionControls.tsx`: Primary Complete button and two-step confirmation Cancel button with optional execution notes textarea.
- `StartFocusModal.tsx`: Calm modal supporting task preselection, preset durations (15m, 25m, 45m, 60m, custom), and session type selection.
- `ActiveFocusBanner.tsx`: Persistent, non-distracting banner mounted in `AppShell` displaying active task name, elapsed time, and direct navigation link (hidden when currently on `/focus`).

### Routes
- `/focus`: Full-screen focused workspace displaying active session or calm empty state.
- `/focus/history`: Reverse-chronological execution audit table with status filtering and pagination.
