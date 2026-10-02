# Avenza Today Domain — Architecture & Technical Reference
**Tagline:** Plan. Execute. Evolve.  
**Phase:** 7 (Foundational Today Execution Surface)

---

## 1. Philosophy & Purpose

Today is Avenza's primary **execution surface**.

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
    EXECUTE
```

### The 5 Core Questions Answered by Today
1. **What matters today?** — Curated, prioritized actions rather than a backlog dump.
2. **What should I work on next?** — A deterministic, unblocked, high-impact recommendation ("Next Up").
3. **What have I completed?** — Evidence of execution accomplished within the user's local calendar day.
4. **How much meaningful work have I done?** — Truthful minutes tracked against daily minimum and target goals.
5. **What remains?** — Overdue, due today, scheduled, and bounded upcoming horizons.

### Today vs. Tasks
| Dimension | Tasks Page (`/tasks`) | Today Page (`/today`) |
| :--- | :--- | :--- |
| **Core Question** | *"What work exists?"* | *"What work should I execute today?"* |
| **Perspective** | Backlog, planning, structuring, filtering | High-clarity, distraction-free execution |
| **Scope** | All tasks across all states, dates, and projects | Curated projection strictly relevant to today |
| **State Nature** | CRUD management and backlog pruning | Active workflow state and immediate action |

### What Today Is NOT (Explicit Non-Goals for Phase 7)
- **NOT a Focus Timer / Pomodoro**: Real-time timer and focus tracking belong to the future Focus Sessions phase.
- **NOT an AI Planner / Recommender**: Task prioritization and next-up selection are 100% deterministic code. No LLMs or heuristics generate fake plans.
- **NOT an Adaptive Rescheduler**: Missed deadlines stay overdue; tasks are not silently moved across days.
- **NOT a Gamification Engine**: No streaks, no XP, no badges, and no celebratory animations.
- **NOT an External Calendar Sync**: No Google/Outlook integrations in this phase.
- **NOT a Duplicate Database**: There is **no `daily_progress` table** and no duplicate task storage. Today is a real-time, deterministic projection computed directly from `tasks` and `user_preferences`.

---

## 2. Timezone & Local Day Strategy

### Strict User-Timezone Authority
Time calculations in execution systems cannot rely on UTC dates or server location. "Today" must reflect the user's local solar day.
1. The user's timezone is resolved from `user_preferences.timezone` (stored as an IANA timezone identifier, e.g. `'Asia/Kolkata'`, `'America/New_York'`, default: `'UTC'`).
2. If an optional `date` query parameter (`YYYY-MM-DD`) is provided, it is interpreted within the user's timezone. Otherwise, the current local date is computed.
3. Local calendar day boundaries are derived:
   - `startOfToday`: `YYYY-MM-DDT00:00:00.000` in user's timezone &rarr; Converted to UTC ISO string.
   - `endOfToday`: `YYYY-MM-DDT23:59:59.999` in user's timezone &rarr; Converted to UTC ISO string.
   - `endOfUpcoming`: `(Today + 7 days)T23:59:59.999` in user's timezone &rarr; Converted to UTC ISO string.

All date matching and categorization logic on the backend compares UTC ISO instants (`due_at`, `scheduled_start`, `completed_at`) against these boundaries.

---

## 3. Task Inclusion & Deterministic Precedence

To eliminate visual noise and cognitive overload, each active task appears in **at most one primary execution section**.

### Deterministic Classification Hierarchy
Tasks are evaluated against the following mutually exclusive rules:

```
[All Active Tasks for Profile]
       │
       ├─► Status = 'completed' AND completed_at in [startOfToday, endOfToday] ──► COMPLETED TODAY
       │
       ├─► Status NOT in ('completed', 'cancelled')
       │     │
       │     ├─► due_at < startOfToday ─────────────────────────────► OVERDUE
       │     │
       │     ├─► due_at within [startOfToday, endOfToday] ───────────► DUE TODAY
       │     │
       │     ├─► scheduled_start within [startOfToday, endOfToday] ──► SCHEDULED TODAY
       │     │
       │     └─► (due_at OR scheduled_start) in (endOfToday, endOfUpcoming] ─► UPCOMING (7-day horizon)
```

1. **Overdue**: Incomplete task with `due_at < startOfToday`.
2. **Due Today**: Incomplete task not in Overdue with `startOfToday <= due_at <= endOfToday`.
3. **Scheduled Today**: Incomplete task not in Overdue or Due Today with `startOfToday <= scheduled_start <= endOfToday`.
4. **Upcoming**: Incomplete task not in the above sections with `due_at` or `scheduled_start` falling within the next 7 calendar days (`endOfToday < date <= endOfUpcoming`).
5. **Completed Today**: Tasks with `status = 'completed'` where `completed_at` falls within `[startOfToday, endOfToday]`. Tasks completed on prior days are excluded.

---

## 4. Deterministic "Next Up" Selection

Today features a single, prominent **Next** section to eliminate decision fatigue. It is strictly deterministic with zero AI.

### Eligibility Rules
A task is eligible for "Next Up" if and only if:
1. It is present in one of the daily active pools: `overdue`, `dueToday`, or `scheduledToday`.
2. It is **NOT blocked** (`blocking_task_count === 0`).
3. Its status is active (`status !== 'completed' && status !== 'cancelled' && status !== 'skipped'`).

### Sorting & Selection Precedence
Eligible tasks are ordered deterministically:
1. **Section Urgency**: `overdue` (weight 0) &gt; `dueToday` (weight 1) &gt; `scheduledToday` (weight 2).
2. **Priority**: `critical` (weight 0) &gt; `high` (weight 1) &gt; `medium` (weight 2) &gt; `low` (weight 3).
3. **Chronological Due Date**: Earliest `due_at` timestamp.
4. **Chronological Scheduled Start**: Earliest `scheduled_start` timestamp.
5. **Tie Breaker**: Earliest `created_at` timestamp.

The top-ranked task is returned as `next` in the Today response. If no unblocked daily tasks exist, `next` is `null`.

---

## 5. Blocked Tasks Behavior

A task is blocked when one or more of its prerequisite tasks (defined in `public.task_dependencies`) have not been completed.
- Blocked tasks **are not hidden**: Users must understand why planned work is waiting.
- Blocked tasks display semantic indicator badges: `Blocked (Waiting for N tasks)`.
- Blocked tasks **are never selected for "Next Up"**: Recommending blocked work causes frustration.

---

## 6. Meaningful Work & Daily Progress

Avenza measures **meaningful work**, rejecting vanity metrics like login frequency, page clicks, or app dwell time.

### Meaningful Work Formula
- **Actual Work (`meaningfulMinutes`)**:
  - Sum of `actual_minutes` for all tasks completed today where `actual_minutes != null`.
- **Estimated Work Without Actuals (`estimatedMinutesWithoutActual`)**:
  - Sum of `estimated_minutes` for tasks completed today that have NO recorded `actual_minutes`.
  - **Critical Rule**: Estimated time is **never silently reported as actual work**. The UI displays it with explicit "est." indicators.
- If a completed task has neither `actual_minutes` nor `estimated_minutes`, it increments `completedTaskCount` by 1 and contributes 0 minutes to time metrics.

### Targets & Progress Metrics
User execution preferences define daily goals:
- `daily_minimum` (default: 30 minutes)
- `daily_target` (default: 120 minutes)
- `max_daily_study` (default: 360 minutes, informational in Phase 7)

```typescript
minimumProgress = dailyMinimum > 0 
  ? Math.min(100, Math.round((meaningfulMinutes / dailyMinimum) * 100)) 
  : 0;

targetProgress = dailyTarget > 0 
  ? Math.min(100, Math.round((meaningfulMinutes / dailyTarget) * 100)) 
  : 0;
```

---

## 7. API Specification

### Endpoint: `GET /api/v1/today`
- **Authentication**: Strict Clerk JWT &rarr; Supabase Profile ID mapping via `requireAuth`.
- **Query Parameters**:
  - `date` (optional): `YYYY-MM-DD` string. Defaults to current local date in user's timezone.
- **Tenant Isolation**: Queries strictly enforce `user_id = profile.id`. Cross-user access is impossible.

### Response Payload Structure
```json
{
  "success": true,
  "data": {
    "date": "2026-10-03",
    "timezone": "Asia/Kolkata",
    "summary": {
      "completedTaskCount": 2,
      "meaningfulMinutes": 75,
      "estimatedMinutesWithoutActual": 30,
      "dailyMinimum": 30,
      "dailyTarget": 120,
      "maxDailyStudy": 360,
      "minimumProgress": 100,
      "targetProgress": 62.5
    },
    "next": {
      "id": "c1f7d540-3b98-4c8d-8a56-2e8c201460a1",
      "title": "Implement JWT middleware",
      "priority": "critical",
      "status": "planned",
      "is_blocked": false,
      "blocking_task_count": 0,
      "goal_title": "Backend Internship",
      "milestone_title": "Build authentication API"
    },
    "overdue": [],
    "dueToday": [],
    "scheduledToday": [],
    "upcoming": [],
    "completedToday": []
  }
}
```

---

## 8. Frontend Architecture & Cache Invalidation

### Route: `/today`
Located at `apps/web/src/routes/TodayPage.tsx` using subcomponents in `apps/web/src/features/today/components/`:
- `TodayHeader`: Formatted local date, navigation controls (Previous, Today, Next), and "Create Task" action.
- `TodayProgress`: Visual progress bars for Daily Minimum and Daily Target, separating actual minutes from estimated minutes.
- `NextTaskCard`: Hero execution card with immediate `Complete`, `Defer`, and detail view triggers.
- `TodaySection`: Collapsible section wrapper with semantic badges.
- `TodayTaskRow`: Accessible row displaying goal/milestone breadcrumbs, blocked status, scheduled/due timing, and lifecycle actions.

### Mutation Cache Invalidation Strategy
When any task is completed, deferred, or updated:
- Mutation calls `useUpdateTask` or `useCreateTask`.
- On success, TanStack Query invalidates:
  - `['today']`: Triggers immediate re-derivation of daily metrics and Next Up card.
  - `['tasks']`: Keeps the task inventory synchronized.
  - `['goals']`: Keeps milestone and goal progress bars synchronized.

---

## 9. Future Integration Points

### 1. Focus Sessions (Phase 8+)
- When a user starts execution on a task from Today, a Focus Session will attach to that task.
- When the Focus Session completes, its elapsed duration will write to `tasks.actual_minutes` and log an Evidence event.
- Today will immediately consume this recorded actual time in `summary.meaningfulMinutes`.

### 2. Adaptive Planner & Evidence (Later Phases)
- Adaptive planning will suggest realistic schedule adjustments for overdue tasks based on historical velocity.
- The deterministic Next Up algorithm can be augmented with user-approved intelligent suggestions, preserving user agency.
