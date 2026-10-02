# Avenza Goals Domain — Architecture & Technical Reference
**Tagline:** Plan. Execute. Evolve.  
**Phase:** 5 (Foundational Goals & Milestones System)

---

## 1. Domain Model & Hierarchy

Avenza goals represent high-level, outcome-driven targets that anchor personal growth across academic, technical, career, and personal pursuits. Avenza goals are **not** simple todo items.

### The Avenza Hierarchy
```
VISION / OUTCOME
       ↓
     GOAL           <-- Phase 5
       ↓
  MILESTONES        <-- Phase 5
       ↓
PROJECTS / OBJECTIVES (Future Phase)
       ↓
     TASKS          (Future Phase)
       ↓
 FOCUS SESSIONS     (Future Phase)
       ↓
    EVIDENCE        (Future Phase)
```

In Phase 5, only the **Goal** and **Milestone** layers are implemented. Future domains will consume goals via foreign keys and associations without altering this foundational schema.

---

## 2. Goal Entities & Fields

### Core Goal Attributes (`public.goals`)
- `id`: UUID (Primary Key, default `gen_random_uuid()`)
- `user_id`: UUID (Foreign Key references `public.profiles(id)` `ON DELETE CASCADE`)
- `title`: TEXT (1–255 characters, non-empty, trimmed)
- `description`: TEXT (Optional, max 2000 characters)
- `goal_type`: Constrained enum: `'academic' | 'learning' | 'career' | 'project' | 'personal' | 'custom'`
- `status`: Lifecycle enum: `'draft' | 'active' | 'paused' | 'completed' | 'archived'`
- `priority`: Authoritative user priority: `'low' | 'medium' | 'high' | 'critical'`
- `start_date`: TIMESTAMPTZ (Optional)
- `target_date`: TIMESTAMPTZ (Optional; must be `>= start_date` if both exist)
- `completed_at`: TIMESTAMPTZ (Auto-populated on completion, cleared on reactivation)
- `desired_outcome`: TEXT (Optional, max 2000 characters; describes the end-state capability)
- `completion_criteria`: TEXT (Optional, max 2000 characters; objective verification rule)
- `notes`: TEXT (Optional, max 5000 characters)
- `created_at`: TIMESTAMPTZ (Default `now()`)
- `updated_at`: TIMESTAMPTZ (Triggered via `public.handle_updated_at()`)

### Milestone Attributes (`public.goal_milestones`)
- `id`: UUID (Primary Key, default `gen_random_uuid()`)
- `goal_id`: UUID (Foreign Key references `public.goals(id)` `ON DELETE CASCADE`)
- `title`: TEXT (1–255 characters, non-empty, trimmed)
- `description`: TEXT (Optional, max 2000 characters)
- `status`: Enum: `'pending' | 'active' | 'completed' | 'skipped'`
- `priority`: Enum: `'low' | 'medium' | 'high' | 'critical'`
- `order_index`: INTEGER (`>= 0`, deterministic ordering)
- `start_date`: TIMESTAMPTZ (Optional)
- `target_date`: TIMESTAMPTZ (Optional; must be `>= start_date` if both exist)
- `completed_at`: TIMESTAMPTZ (Auto-populated on completion)
- `created_at`: TIMESTAMPTZ (Default `now()`)
- `updated_at`: TIMESTAMPTZ (Triggered via `public.handle_updated_at()`)

---

## 3. Lifecycle vs Health Model

A core architectural tenet of Avenza is separating **user-controlled lifecycle status** from **system-derived health status**.

### User-Controlled Lifecycle Statuses
1. **Draft**: Planning stage; not yet actively being executed.
2. **Active**: Currently under active focus and execution.
3. **Paused**: Work temporarily deferred (e.g. during exams or breaks).
4. **Completed**: Explicitly confirmed as fulfilled by the user.
5. **Archived**: Historical record retained for retrospective review.

### System-Derived Health Statuses
1. **On Track**: Execution is meeting or exceeding scheduled timeline.
2. **At Risk**: Pacing is substantially lagging or milestones are overdue.
3. **Unknown**: Insufficient schedule data (e.g. no target date, or draft/paused state).

**Crucial Rule:** Priority and Health are strictly independent. A goal can be `Priority: Critical` and `Health: At Risk`, or `Priority: Low` and `Health: On Track`.

---

## 4. Deterministic Health & Progress Algorithms

**No LLMs or AI predictions are used in Phase 5.** Health and progress are 100% deterministic and transparent.

### Initial Progress Calculation
- Let `N` = total milestones belonging to the goal.
- Let `C` = number of milestones with `status === 'completed'`.
- If `N === 0`: `progress = 0%`.
- If `N > 0`: `progress = Math.round((C / N) * 100)`.

### Initial Health Calculation
1. If `goal.status === 'completed'`: Health is **On Track** (`"Goal has been completed."`).
2. If `goal.status` is `'draft'`, `'paused'`, or `'archived'`: Health is **Unknown** (`"Goal is currently in [status] status."`).
3. If `goal.target_date` is missing: Health is **Unknown** (`"No target date set for timeline calculation."`).
4. If `now > target_date` and `progress < 100%`: Health is **At Risk** (`"Target date has passed and goal is not yet completed."`).
5. If any active milestone (`status !== 'completed'` and `status !== 'skipped'`) has `milestone.target_date < now`: Health is **At Risk** (`"One or more scheduled milestones are overdue."`).
6. If `goal.start_date` exists, `now >= start_date`, and `target_date > start_date`:
   - `totalDuration = target_date - start_date`
   - `elapsed = now - start_date`
   - `expectedProgress = (elapsed / totalDuration) * 100`
   - If `actualProgress < expectedProgress - 20%`: Health is **At Risk** (`"Actual progress (X%) is behind scheduled pacing (Y%)."`).
7. Otherwise: Health is **On Track** (`"Goal progress is on schedule."`).

---

## 5. Row Level Security (RLS) Strategy

All tables enforce Row Level Security. Authenticated access is secured via Clerk JWT identity resolution against `public.profiles`:

```sql
-- Goals RLS Check
user_id IN (
  SELECT p.id FROM public.profiles p
  WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
)

-- Milestones RLS Check
goal_id IN (
  SELECT g.id FROM public.goals g
  JOIN public.profiles p ON p.id = g.user_id
  WHERE p.clerk_user_id = (select auth.jwt() ->> 'sub')
)
```

Client-supplied `user_id` is never trusted. In the API layer, Fastify middleware verifies Clerk tokens, resolves the authenticated profile ID from `request.profile.id`, and injects it into repository queries.

---

## 6. REST API Endpoints

All endpoints are mounted under `/api/v1/goals` and require `Authorization: Bearer <clerk_token>`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/goals` | List goals with pagination, filtering (`status`, `goal_type`, `priority`, `health`), search, and sorting. |
| `POST` | `/api/v1/goals` | Create a new goal. |
| `GET` | `/api/v1/goals/:id` | Get goal details, derived metrics, and ordered milestones. |
| `PATCH` | `/api/v1/goals/:id` | Update goal fields and transition lifecycle status. |
| `DELETE` | `/api/v1/goals/:id` | Delete goal and cascade delete all milestones. |
| `GET` | `/api/v1/goals/:goalId/milestones` | List all milestones for a goal. |
| `POST` | `/api/v1/goals/:goalId/milestones` | Create a milestone under a goal. |
| `PATCH` | `/api/v1/goals/:goalId/milestones/:milestoneId` | Update milestone properties or toggle status. |
| `DELETE` | `/api/v1/goals/:goalId/milestones/:milestoneId` | Delete milestone. |

### Envelope Convention
Success:
```json
{
  "success": true,
  "data": { ... },
  "pagination": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```
Error:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request payload validation failed.",
    "details": { ... }
  }
}
```

---

## 7. Frontend Architecture

- **State Management**: TanStack Query v5 with centralized query key factory (`goalKeys`).
- **URL Query Synchronization**: Search, filters (`status`, `goal_type`, `priority`, `health`), and sorting (`sortBy`, `sortOrder`) are synchronized with `useSearchParams` for shareable and bookmarkable URLs.
- **Components**:
  - `GoalsPage`: Workspace dashboard with responsive cards, filter toolbar, progress bars, and creation modal.
  - `GoalDetailPage`: Comprehensive view featuring strategic criteria (desired outcome, completion criteria, notes), sequential milestones list with status toggles, progress bar, system health explanation, and deletion dialogs.
  - `GoalBadges`: Semantic badges for types, priorities, lifecycle states, and derived health.
  - `CreateGoalModal` & `EditGoalModal`: Accessible modal forms with client-side validation.
  - `MilestoneModal`: Milestone editor supporting deterministic order indexing and dates.
