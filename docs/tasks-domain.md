# Avenza Tasks Domain — Architecture & Technical Reference
**Tagline:** Plan. Execute. Evolve.  
**Phase:** 6 (Foundational Tasks & Dependencies System)

---

## 1. Domain Model & Hierarchy

In Avenza, a **Task** is the concrete, executable unit of work that bridges strategic intent with daily focus.

### The Avenza Execution Hierarchy
```
VISION / OUTCOME
       ↓
     GOAL           (Phase 5)
       ↓
  MILESTONES        (Phase 5)
       ↓
     TASK           (Phase 6)
       ↓
 FOCUS SESSION      (Future Phase)
       ↓
    EVIDENCE        (Future Phase)
```

### Core Domain Principle
A task must answer: **"What concrete action needs to be performed?"**
- Tasks are **NOT** goals (which are strategic outcomes).
- Tasks are **NOT** milestones (which are progress checkpoints).
- Tasks are executable, concrete, and binary at the execution layer (`completed` or not).

Examples of valid tasks:
- "Revise binary search boundary conditions."
- "Complete DBMS assignment 3."
- "Implement JWT middleware."
- "Submit internship application."
- "Review calculus integration problems."

---

## 2. Database Schema & Entities

The Tasks domain introduces two relational tables in PostgreSQL: `public.tasks` and `public.task_dependencies`.

### Core Task Attributes (`public.tasks`)
- `id`: UUID (Primary Key, default `gen_random_uuid()`)
- `user_id`: UUID (Foreign Key references `public.profiles(id)` `ON DELETE CASCADE`)
- `title`: TEXT (1–255 characters, non-empty, trimmed)
- `description`: TEXT (Optional, max 2000 characters)
- `status`: Lifecycle enum: `'inbox' | 'planned' | 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'deferred' | 'cancelled'`
- `priority`: Authoritative user priority: `'low' | 'medium' | 'high' | 'critical'`
- `task_type`: Constrained enum: `'study' | 'practice' | 'revision' | 'assignment' | 'exam_preparation' | 'dsa' | 'project' | 'career' | 'administrative' | 'personal' | 'custom'`
- `goal_id`: UUID (Optional Foreign Key references `public.goals(id)` `ON DELETE SET NULL`)
- `milestone_id`: UUID (Optional Foreign Key references `public.goal_milestones(id)` `ON DELETE SET NULL`)
- `estimated_minutes`: INTEGER (Optional, must be `> 0` if specified; expected effort)
- `actual_minutes`: INTEGER (Optional, must be `>= 0` if specified; observed effort, populated by future focus sessions)
- `due_at`: TIMESTAMPTZ (Optional; delivery deadline)
- `scheduled_start`: TIMESTAMPTZ (Optional; planned start time)
- `scheduled_end`: TIMESTAMPTZ (Optional; planned end time; must be `>= scheduled_start`)
- `completed_at`: TIMESTAMPTZ (Auto-populated with `now()` when status becomes `'completed'`; cleared when reopened)
- `notes`: TEXT (Optional, max 5000 characters)
- `created_at`: TIMESTAMPTZ (Default `now()`)
- `updated_at`: TIMESTAMPTZ (Triggered via `public.handle_updated_at()`)

### Task Dependencies Attributes (`public.task_dependencies`)
- `id`: UUID (Primary Key, default `gen_random_uuid()`)
- `task_id`: UUID (Foreign Key references `public.tasks(id)` `ON DELETE CASCADE`)
- `depends_on_task_id`: UUID (Foreign Key references `public.tasks(id)` `ON DELETE CASCADE`)
- `created_at`: TIMESTAMPTZ (Default `now()`)

### Database Constraints
1. **Title Length & Non-Empty**: `char_length(trim(title)) > 0 AND char_length(title) <= 255`.
2. **Enum Checks**: Strict check constraints on `status`, `priority`, and `task_type`.
3. **Durations**: `estimated_minutes > 0` and `actual_minutes >= 0`.
4. **Schedule Integrity**: `scheduled_end >= scheduled_start` when both are present.
5. **No Self-Dependency**: `task_id != depends_on_task_id`.
6. **Unique Dependency Pair**: Unique constraint on `(task_id, depends_on_task_id)`.

### Indexing Strategy
Targeted composite and single-column B-tree indexes support all primary query patterns:
- `tasks_user_id_idx` ON `tasks(user_id)`
- `tasks_user_id_status_idx` ON `tasks(user_id, status)`
- `tasks_user_id_due_at_idx` ON `tasks(user_id, due_at)`
- `tasks_user_id_scheduled_start_idx` ON `tasks(user_id, scheduled_start)`
- `tasks_user_id_priority_idx` ON `tasks(user_id, priority)`
- `tasks_user_id_task_type_idx` ON `tasks(user_id, task_type)`
- `tasks_user_id_goal_id_idx` ON `tasks(user_id, goal_id)`
- `tasks_user_id_milestone_id_idx` ON `tasks(user_id, milestone_id)`
- `task_dependencies_task_id_idx` ON `task_dependencies(task_id)`
- `task_dependencies_depends_on_task_id_idx` ON `task_dependencies(depends_on_task_id)`

---

## 3. Cross-Domain Ownership & Integrity

A task may optionally link to a Goal and/or Milestone.
```
Task → Milestone → Goal
```

### Strict Relational Invariants
1. **User Alignment**: A user cannot attach a Goal or Milestone owned by another user.
2. **Hierarchical Consistency**: If a task has both a `goal_id` and a `milestone_id`, the database and service enforce:
   ```
   milestone.goal_id === task.goal_id
   ```
   A task cannot belong to Goal A while its milestone belongs to Goal B.
3. **Decoupled Life Cycle**: When a Goal or Milestone is deleted, foreign keys use `ON DELETE SET NULL`. This ensures historic work and task records are never silently erased when high-level goals change.

---

## 4. Task Lifecycle & Completion Rules

Tasks support an 8-state lifecycle:
- `inbox`: Captured idea or work item, not yet prioritized or scheduled.
- `planned`: Intended for execution, sequenced in the backlog.
- `scheduled`: Assigned a specific calendar start and/or end time.
- `in_progress`: Currently being actively worked on.
- `completed`: Successfully finished.
- `skipped`: Intentionally bypassed for this cycle without failure.
- `deferred`: Postponed to a future review cycle.
- `cancelled`: Deprecated or no longer relevant.

### `completed_at` Rules
- When `status` transitions to `'completed'`: `completed_at = now()`.
- When reopening a completed task (status becomes non-completed): `completed_at = null`.
- Scheduled start/end dates are **never** cleared automatically on completion to preserve historical scheduling records.

---

## 5. Dependency Semantics & Cycle Detection

### Dependency Model
The relationship `task_id` depends on `depends_on_task_id` means that `depends_on_task_id` is a **prerequisite** for `task_id`.

### Cycle Detection Algorithm (DFS)
Before a dependency `A → B` is inserted, the backend builds an in-memory directed adjacency graph of all dependency pairs owned by the user. A Depth-First Search (DFS) traverses edges starting from `B`. If `A` is reachable from `B`, adding `A → B` would create a cycle `A → B → ... → A`. The mutation is rejected with:
`"Circular dependency detected: adding this dependency would create a cycle."`

### Derived Blocked State (Separation of Source and Derived State)
A task's stored status (e.g. `'planned'`, `'scheduled'`) is **never** automatically overwritten when prerequisites are uncompleted. Instead, the backend derives execution readiness:
- `is_blocked = true` if at least one prerequisite task has `status !== 'completed'`.
- `blocking_task_count`: number of uncompleted prerequisites.
- `blocked_by`: list of blocking prerequisite IDs, titles, and statuses.

---

## 6. Row Level Security (RLS)

PostgreSQL RLS ensures total tenant isolation based on Clerk JWT session claims:

```sql
auth.jwt() -> (request.jwt.claims->>'sub') -> profiles.clerk_user_id -> profiles.id
```

### Tasks Policies
- `SELECT`: `user_id = (SELECT id FROM profiles WHERE clerk_user_id = auth.jwt()->>'sub')`
- `INSERT`: `user_id = (SELECT id FROM profiles WHERE clerk_user_id = auth.jwt()->>'sub')`
- `UPDATE`: `user_id = (SELECT id FROM profiles WHERE clerk_user_id = auth.jwt()->>'sub')`
- `DELETE`: `user_id = (SELECT id FROM profiles WHERE clerk_user_id = auth.jwt()->>'sub')`

### Task Dependencies Policies
A user can only select, insert, update, or delete dependencies where **both** the dependent task and prerequisite task belong to their authenticated profile:
```sql
EXISTS (
  SELECT 1 FROM public.tasks t1
  JOIN public.tasks t2 ON t2.id = task_dependencies.depends_on_task_id
  WHERE t1.id = task_dependencies.task_id
    AND t1.user_id = public.current_profile_id()
    AND t2.user_id = public.current_profile_id()
)
```

---

## 7. REST API Endpoints

All endpoints are authenticated via Clerk JWT Bearer token and validated with Zod.

### Tasks Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/tasks` | List tasks with pagination, filters, sorting, and search |
| `POST` | `/api/v1/tasks` | Create a task with goal/milestone validation |
| `GET` | `/api/v1/tasks/:id` | Get task detail, strategic alignment, and dependency graph |
| `PATCH` | `/api/v1/tasks/:id` | Update task fields, lifecycle transitions, and estimates |
| `DELETE` | `/api/v1/tasks/:id` | Delete task (cascades dependency records) |

### Task Dependencies Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/tasks/:id/dependencies` | List all direct prerequisites for a task |
| `POST` | `/api/v1/tasks/:id/dependencies` | Add prerequisite (with cycle & ownership validation) |
| `DELETE` | `/api/v1/tasks/:id/dependencies/:dependencyId` | Remove prerequisite relationship |

### Query Parameters for `GET /api/v1/tasks`
- `page`: positive integer (default `1`)
- `pageSize`: integer between `1` and `100` (default `20`)
- `status`: filter by single `TaskStatus`
- `priority`: filter by single `TaskPriority`
- `task_type`: filter by single `TaskType`
- `goal_id`: filter by parent Goal UUID
- `milestone_id`: filter by parent Milestone UUID
- `search`: case-insensitive substring search on title
- `due_before`, `due_after`: ISO timestamp filters on `due_at`
- `scheduled_before`, `scheduled_after`: ISO timestamp filters on `scheduled_start`
- `blocked`: boolean filter (`true` for blocked tasks, `false` for unblocked tasks)
- `sortBy`: `'created_at' | 'due_at' | 'scheduled_start' | 'priority'` (default `'created_at'`)
- `sortOrder`: `'asc' | 'desc'` (default `'desc'`)

---

## 8. Frontend Execution Layer

- **Route `/tasks`**: Dense list/table hybrid UI with sticky search and filter bar, status counts, pagination, quick actions, and blocked badges.
- **Route `/tasks/:id`**: Deep execution detail view showing time estimates vs actuals, strategic goal alignment card, notes, and a dependency manager.
- **Component `TaskDependencyManager`**: Visual list of prerequisites with status badges, blocked warning banner, and modal selector to add dependencies with instant feedback.
- **Modals `CreateTaskModal` & `EditTaskModal`**: Dynamic Goal & Milestone cascading pickers, client-side validation matching server Zod schemas.

---

## 9. Future Integration Points (Phase 7+)

Phase 6 provides the foundation for upcoming execution systems:
1. **Today View**: Queries `tasks` scheduled for today or due today, displaying actionable work without changing underlying task data.
2. **Focus Sessions**: Logs focus sessions linked to `task_id`, automatically accumulating observed duration into `actual_minutes`.
3. **Evidence Engine**: Attaches code commits, papers, and artifacts to completed tasks.
4. **Adaptive Planner**: Reads task estimates, priorities, and dependency graphs to propose non-destructive schedule adjustments.
