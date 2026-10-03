# Intelligence Domain: Foundational Next Best Action Engine

## 1. Purpose
The Intelligence Domain provides the foundational deterministic intelligence layer for Avenza. It answers the core user question: **"What should I do next?"**

The engine is built on the principle that **the LLM is NOT the intelligence engine**. Phase 10 establishes a purely deterministic, context-driven, explainable, and testable intelligence core. It evaluates real user tasks, active goals, dependencies, urgency, and recent execution evidence to select **ONE primary Next Best Action**.

---

## 2. Context Engine
The Context Engine (`IntelligenceContextBuilder`) gathers only bounded, relevant execution data:
1. **User Identity & Effective Timezone**: Derived from Clerk and user preferences/profile.
2. **Date Boundaries**: Local calendar day and ISO timestamps computed deterministically with Node.js `Intl` API.
3. **Active Goals & Milestones**: Bounded query (`pageSize: 50`) for goals in `active` state and their milestones.
4. **Open Tasks**: Bounded query (`pageSize: 200`) for user tasks excluding terminal states (`completed`, `cancelled`, `skipped`).
5. **Dependency Graph**: Batch queries (`getDependencySummariesForTasks` and `getAllUserDependencies`) to determine:
   - Whether each task is currently blocked (`is_blocked: true`).
   - How many open dependent tasks would be unblocked if this task is completed (`unblocks_count`).
6. **Recent Execution & Focus**: Recent completed tasks (last 10), active focus session, and recent focus sessions (last 10).
7. **Recent Evidence**: Recent evidence items (last 10) and their linked task associations.

Context gathering is strictly bounded to prevent $N+1$ queries and large memory footprints.

---

## 3. Candidate Generation
The `CandidateGenerator` evaluates tasks in the context and generates candidate actions:
- Every candidate maps directly to a real task entity. No synthetic or motivational tasks are invented.
- Candidate Types:
  - `start_task`: Actionable task in `inbox` or `planned` state ready for initial work.
  - `continue_task`: Task with an active focus session or in-progress state with a recent focus session.
  - `focus_task`: Deep work, high priority (`critical` or `high`), or tasks with estimated duration $\ge 30$ minutes.
  - `complete_task`: In-progress task whose actual minutes have met or exceeded its estimated minutes.
  - `review_task`: Task with linked unverified evidence requiring review.

---

## 4. Eligibility Rules
A task is eligible to become a candidate if and only if:
1. It belongs to the authenticated user.
2. It is not completed (`status !== 'completed'`).
3. It is not cancelled (`status !== 'cancelled'`).
4. It is not skipped (`status !== 'skipped'`).
5. It is **not blocked** (`!task.is_blocked` and no unsatisfied prerequisite tasks).

> **Blocked Task Invariant**: A task with unfinished prerequisite dependencies is strictly excluded from candidate generation. The engine prefers the actionable prerequisite dependency instead.

---

## 5. Reason Codes
Each selected Next Best Action is accompanied by a deterministic reason code, human-readable label, and factual explanation:
- `overdue`: Task due date is in the past.
- `due_today`: Task is due on the current calendar date.
- `critical_priority`: Task is marked with explicit Critical priority.
- `high_priority`: Task is marked with explicit High priority.
- `dependency_unblock`: Completing this task unblocks one or more active dependent tasks.
- `in_progress_continuation`: Ongoing work or active/recent focus session.
- `scheduled_now`: Task is explicitly scheduled for today.
- `deadline_soon`: Task deadline is within the next 48 hours.
- `stale_task`: Actionable task open for over 14 days without progress.
- `goal_priority`: Task advances an active user goal.
- `user_priority`: Standard top actionable task.
- `no_actionable_tasks`: Returned when no actionable tasks exist.

---

## 6. Deterministic Scoring Model
Candidate scores are bounded from 0 to 100 and calculated as a sum of discrete signals:

$$\text{Total Score} = \min(100, \text{Priority} + \text{Urgency} + \text{Goal} + \text{Dependency} + \text{Schedule} + \text{Continuation} + \text{Staleness})$$

### Signal Components:
1. **Explicit Priority Signal (10 – 40 pts)**:
   - `critical`: 40
   - `high`: 30
   - `medium`: 20
   - `low`: 10
2. **Urgency Signal (0 – 25 pts)**:
   - Overdue: 25
   - Due Today: 20
   - Deadline Soon ($\le 48\text{h}$): 12
   - Due Later: 4
   - No Due Date: 0
3. **Dependency Unblock Signal (0 – 15 pts)**:
   - $\min(\text{unblocks\_count} \times 5, 15)$
4. **Goal Relevance Signal (0 – 15 pts)**:
   - Linked to Active Goal: +10
   - Linked to Active Milestone: +5
5. **Schedule Signal (0 – 15 pts)**:
   - Scheduled for Today: 15
6. **Continuation Signal (0 – 10 pts)**:
   - Active focus session on task: 10
   - In-progress with recent session: 8
   - In-progress: 5
7. **Staleness Signal (0 – 5 pts)**:
   - Open for $\ge 14$ days: 5 (staleness nudge to prevent neglected work).

---

## 7. Priority Precedence & Authority
Explicit user priority has strong authority. A Critical priority task (40 pts) naturally outweighs low-priority tasks even if they are due today ($10 + 20 = 30$ pts). Derived urgency never silently overrides explicit user intent.

---

## 8. Dependency Handling
- If Task B depends on Task A, and Task A is incomplete:
  - Task B is blocked (`is_blocked: true`) and **cannot** be recommended.
  - Task A receives an unblocking signal boost proportional to the number of dependent tasks it unlocks.

---

## 9. Confidence Model
Confidence reflects signal strength and ambiguity:
- **`high`**: Clear, decisive signals (e.g. Critical priority, active focus session, or High priority with Due Today / Overdue / Unblocking).
- **`medium`**: Solid signals with multiple competing factors or Medium priority with goal/due dates.
- **`low`**: Sparse context (Low priority, no due date, no goals attached).

---

## 10. Determinism & Tie Breaking
The scoring engine is a **pure function**. It does not call `Date.now()` internally; all timestamps are passed via the context.

When two candidates have identical total scores, ties are broken deterministically:
1. Total score (descending)
2. Explicit priority (`critical` > `high` > `medium` > `low`)
3. Urgency rank (`overdue` > `due_today` > `deadline_soon` > other)
4. Dependency unblock count (descending)
5. Goal attached (has goal > no goal)
6. Scheduled today (has scheduled date today > none)
7. Due date (earlier ISO timestamp first)
8. Created at (older first)
9. Stable task ID (`taskId.localeCompare`)

---

## 11. Next Best Action API
### Endpoint
`GET /api/v1/intelligence/next-action`

### Query Parameters
- `date` (optional): `YYYY-MM-DD`
- `timezone` (optional): IANA timezone string

### Response Envelope (Success with Action)
```json
{
  "success": true,
  "data": {
    "action": {
      "type": "focus_task",
      "taskId": "11111111-2222-3333-4444-555555555555",
      "title": "Practice Binary Search",
      "score": 85,
      "goalId": "goal-uuid",
      "goalTitle": "DSA Mastery",
      "milestoneId": "milestone-uuid",
      "milestoneTitle": "Binary Search",
      "priority": "high",
      "taskType": "dsa",
      "status": "planned",
      "dueAt": "2026-10-03T18:00:00.000Z",
      "scheduledDate": null,
      "estimatedMinutes": 45
    },
    "reason": {
      "code": "due_today",
      "label": "Due today",
      "explanation": "\"Practice Binary Search\" is due today and is currently actionable."
    },
    "confidence": "high",
    "generatedAt": "2026-10-03T07:00:00.000Z",
    "scoreBreakdown": {
      "prioritySignal": 30,
      "urgencySignal": 20,
      "goalSignal": 15,
      "dependencySignal": 5,
      "scheduleSignal": 15,
      "continuationSignal": 0,
      "stalenessSignal": 0,
      "totalScore": 85
    }
  }
}
```

---

## 12. No-Action Behavior
When no actionable tasks exist (or all remaining tasks are blocked):
```json
{
  "success": true,
  "data": {
    "action": null,
    "reason": {
      "code": "no_actionable_tasks",
      "label": "Nothing urgent",
      "explanation": "There are no actionable tasks available right now."
    },
    "confidence": "high",
    "generatedAt": "2026-10-03T07:00:00.000Z",
    "scoreBreakdown": null
  }
}
```
The frontend renders a calm empty state without fabricating tasks.

---

## 13. User Control & Non-Mutation
The engine only **suggests**. It never:
- Automatically completes tasks.
- Automatically reschedules tasks or moves dates.
- Automatically starts focus sessions.
- Modifies user priorities or goals.
- Deletes user data.

---

## 14. Security
- Clerk authentication enforced on all endpoints via `requireAuth`.
- Data isolation: Every database query is strictly scoped by `userId`. Cross-user data leakage is impossible and verified by tests.
- Zero credential exposure.

---

## 15. Performance Boundaries
- Bounded queries: Maximum 50 active goals, 200 open tasks, 10 recent focus sessions, 10 recent evidence records.
- Batch fetching for dependency summaries and goal titles prevents $N+1$ queries.
- Cached on frontend via TanStack Query (`staleTime: 30s`) and invalidated on relevant mutations.

---

## 16. Future AI Architecture Boundary
### Phase 10 (Current):
```
User Data
  ↓
Context Engine
  ↓
Candidate Generator
  ↓
Deterministic Scorer
  ↓
Next Best Action
```

### Future AI Phase (Phase 11+):
```
User Data
  ↓
Context Engine
  ↓
Deterministic Candidates
  ↓
LLM Reasoning (Reasoning about candidates, NOT inventing them)
  ↓
Structured Suggestion
  ↓
User Decision
```
The LLM will reason *about* candidate actions; it will never fabricate facts or invent actions from nothing.

---

## 17. Explicit Non-Goals for Phase 10
- No FreeLLM or external AI API calls.
- No AI Coaching or conversational chat.
- No automatic rescheduling or autonomous plan modification.
- No analytics, weekly review, skill health, or gamification (XP/streaks).
- No external provider sync (GitHub, LeetCode, Codeforces).
