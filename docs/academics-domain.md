# Avenza Academics Foundation Domain Specification

## 1. Academic Hierarchy

The Avenza Academics domain models educational structures as factual source-of-truth data. It does not assume any fixed schooling system, semester schedule, grading scale, or institutional curriculum.

```
Academic Year (optional)
        ↓
      Term (primary container)
        ↓
     Subject
        ↓
   Unit / Topic
        ↓
Assessment / Exam
```

- **Academic Year (optional)**: Broad grouping for multi-year programs (e.g., `2026–2027`).
- **Term (mandatory core container)**: Primary grouping for active study periods (e.g., `Fall 2026`, `Trimester 1`).
- **Subject**: Specific course or study area belonging to a Term (e.g., `Operating Systems`, `Distributed Systems`).
- **Topic**: Deterministically ordered syllabus unit belonging to a Subject (e.g., `Virtual Memory`, `Raft Consensus`).
- **Assessment / Exam**: Evaluative checkpoints belonging to a Term and optionally linked to Subjects and Topics.

---

## 2. Academic Year

Academic Year is an optional entity for users who organize their studies on an annual cycle.
- **Attributes**: `id`, `user_id`, `name`, `start_date`, `end_date`, `is_current`, timestamps.
- **Invariants**:
  - `start_date <= end_date`.
  - When `is_current` is true, an updated trigger or query filter manages current status per user.
  - Optional: Terms may exist without being assigned to an Academic Year.

---

## 3. Terms

The **Term** is the foundational academic container. Every Subject, Assessment, and Exam belongs directly to a Term.
- **Attributes**: `id`, `user_id`, `academic_year_id` (nullable), `name`, `code` (nullable), `start_date`, `end_date`, `status`, `is_current`, `notes`, timestamps.
- **Statuses**:
  - `planned`: Upcoming term.
  - `active`: Current ongoing term.
  - `completed`: Finished term.
  - `archived`: Historical record.
- **Invariants**:
  - `start_date <= end_date`.
  - Strictly owned by a single authenticated user.

---

## 4. Subjects

A **Subject** represents an individual course taken during a Term.
- **Attributes**: `id`, `user_id`, `term_id`, `name`, `code` (nullable), `description` (nullable), `instructor` (nullable), `credits` (nullable, float), `color` (nullable), `status`, `notes`, timestamps.
- **Statuses**: `planned`, `active`, `completed`, `archived`.
- **Invariants**:
  - Must belong to a valid Term owned by the same user.
  - Credits and instructor are optional to accommodate global academic diversity.

---

## 5. Topics

A **Topic** models a granular syllabus element within a Subject.
- **Attributes**: `id`, `user_id`, `subject_id`, `name`, `description` (nullable), `order_index` (integer, deterministic ordering), `status`, `importance`, `estimated_minutes` (nullable, non-negative), `resources` (JSON array of `{ title, url, type }`), `notes`, timestamps.
- **Coverage States**:
  - `not_started`: Topic has not been opened yet.
  - `in_progress`: Material is currently being studied.
  - `covered`: Student has finished going through the syllabus material.
  - `needs_review`: Topic was covered but requires subsequent revision.
- **Importance Metadata**: `low`, `medium`, `high`, `critical`. User-provided priority signal.
- **Invariants**:
  - Must belong to a valid Subject owned by the same user.
  - Deterministic ordering via `order_index ASC`.

---

## 6. Assessments

An **Assessment** represents non-exam academic work (assignments, lab submissions, projects, quizzes, presentations).
- **Attributes**: `id`, `user_id`, `term_id`, `subject_id` (nullable), `title`, `assessment_type`, `description` (nullable), `due_at` (nullable timestamptz), `max_marks` (nullable), `obtained_marks` (nullable), `weight_percent` (nullable, 0-100), `status`, `notes`, timestamps.
- **Assessment Types**: `assignment`, `quiz`, `lab`, `project`, `internal`, `presentation`, `mock`, `custom`.
- **Statuses**: `planned`, `in_progress`, `submitted`, `completed`, `cancelled`.
- **Topic Coverage**: Many-to-many relationship tracked via `assessment_topics` relational join table (`assessment_id`, `topic_id`).
- **Invariants**:
  - `weight_percent` between 0 and 100 if specified.
  - `max_marks > 0` and `obtained_marks >= 0`.
  - `obtained_marks <= max_marks` if both are specified.
  - Cannot link topics belonging to another user or an unrelated subject.

---

## 7. Exams

An **Exam** is a scheduled examination event with direct study and preparation implications.
- **Attributes**: `id`, `user_id`, `term_id`, `subject_id` (nullable), `title`, `exam_type`, `exam_date` (timestamptz), `duration_minutes` (nullable, > 0), `location` (nullable), `weight_percent` (nullable, 0-100), `status`, `notes`, timestamps.
- **Exam Types**: `midterm`, `endterm`, `final`, `mock`, `practical`, `viva`, `custom`.
- **Statuses**: `planned`, `completed`, `cancelled`.
- **Topic Coverage**: Relational join table `exam_topics` (`exam_id`, `topic_id`).
- **Invariants**:
  - `duration_minutes > 0` if specified.
  - `weight_percent` between 0 and 100 if specified.
  - Both exam and topics must belong to the authenticated user.

---

## 8. Coverage vs Mastery Boundary

Avenza establishes a strict semantic and architectural boundary between **Syllabus Coverage** and **Mastery**:

| Concept | Meaning | Phase Implemented |
| :--- | :--- | :--- |
| **Syllabus Coverage** | "Have I gone through this part of the syllabus?" (Factual: 8 of 10 topics marked `covered` = 80% coverage) | **Phase 11 (Academics Foundation)** |
| **Mastery** | "How deeply do I understand this material?" (Inferred: retention, test performance, cognitive depth) | **Phase 12+ (Skills & Mastery Intelligence)** |
| **Readiness** | "How prepared am I for the upcoming exam on Oct 25?" (Predictive scoring, confidence modeling) | **Phase 17+ (AI Academic Coach)** |

> [!IMPORTANT]
> The system strictly calculates and displays `Syllabus Coverage`. It **never** labels coverage as "Mastery" or claims a student has mastered a topic merely because it was covered.

---

## 9. Academic Resources

Phase 11 supports lightweight resource references on Topics without requiring complex document management or file storage:
- Resources are modeled as `{ title: string, url?: string, type?: 'url' | 'document' | 'notes' | 'slides' | 'video' | 'book' }`.
- URLs are validated and clickable in the UI.
- No local file uploads, binary parsing, OCR, or AI document extractions are performed in Phase 11.

---

## 10. Relationships to Tasks

Existing Tasks (Phase 6) can optionally link to academic entities to provide context for execution:
- Fields added to `tasks`:
  - `academic_term_id` (UUID nullable, FK -> `terms(id) ON DELETE SET NULL`)
  - `academic_subject_id` (UUID nullable, FK -> `subjects(id) ON DELETE SET NULL`)
  - `academic_topic_id` (UUID nullable, FK -> `subject_topics(id) ON DELETE SET NULL`)
- Task creation modal supports optional Subject and Topic pickers.
- All relationships preserve existing task workflows, schedules, and priorities without side-effects.

---

## 11. Relationships to Goals

Existing Goals (Phase 5) can optionally link to academic entities:
- Fields added to `goals`:
  - `academic_term_id` (UUID nullable, FK -> `terms(id) ON DELETE SET NULL`)
  - `academic_subject_id` (UUID nullable, FK -> `subjects(id) ON DELETE SET NULL`)
- Goal health and progress calculations remain unchanged. Academic links provide structural domain context.

---

## 12. Focus Integration

- Focus Sessions (Phase 8) link directly to Tasks.
- Because Tasks now optionally reference Subject and Topic IDs, Focus Sessions inherit academic context transitively:
  `Focus Session -> Task -> Academic Subject & Topic`
- No fields or behaviors were duplicated or mutated on `focus_sessions`. Focus timer, state machine, and today projections continue operating without modification.

---

## 13. Evidence Integration

- Evidence records (Phase 9) remain dedicated to verifiable execution artifacts (completed tasks, focus sessions, user links).
- Academic entities provide foreign keys for future academic proof (e.g., assignment receipts, exam scores) without altering existing evidence structures or fabricating outcomes.

---

## 14. Timezone Behavior

- Date-only fields (`start_date`, `end_date` for Terms and Academic Years) use ISO date format `YYYY-MM-DD` and date semantics.
- Exact scheduled times (`due_at` for Assessments, `exam_date` for Exams) use UTC ISO-8601 timestamps (`timestamptz`).
- Display formatting preserves the user's configured timezone via standard date utilities.

---

## 15. Security & Row-Level Security (RLS)

Strict RLS policies are enforced across all academic tables:
1. `academic_years`: `user_id = auth.uid()`
2. `terms`: `user_id = auth.uid()`
3. `subjects`: `user_id = auth.uid()` AND `term_id IN (SELECT id FROM terms WHERE user_id = auth.uid())`
4. `subject_topics`: `user_id = auth.uid()` AND `subject_id IN (SELECT id FROM subjects WHERE user_id = auth.uid())`
5. `assessments`: `user_id = auth.uid()` AND `term_id IN (SELECT id FROM terms WHERE user_id = auth.uid())`
6. `exams`: `user_id = auth.uid()` AND `term_id IN (SELECT id FROM terms WHERE user_id = auth.uid())`
7. `assessment_topics`: Relational join verified against parent assessment owner.
8. `exam_topics`: Relational join verified against parent exam owner.

Cross-user creation attempts (e.g., User B creating a topic in User A's subject) are rejected at both the database level via RLS check constraints and the service layer with structured validation errors.

---

## 16. Delete Behavior

Deletions follow safe domain preservation:
- Deleting an `academic_year` sets `terms.academic_year_id = NULL` (preserves terms).
- Deleting a `term` cascades to child `subjects`, `assessments`, `exams`, and `subject_topics` within that academic container.
- Deleting a `subject` or `topic` **never** cascades to `tasks` or `goals`. Tasks and Goals have foreign keys with `ON DELETE SET NULL`, preserving the user's execution history, actual minutes, and evidence.

---

## 17. REST API Endpoints

All endpoints require Clerk authentication and return standard Avenza envelopes `{ success: true, data: ... }`:

### Overview
- `GET /api/v1/academics/overview`: Answers the 5 core academic overview questions.

### Academic Years
- `POST /api/v1/academic-years`: Create academic year
- `GET /api/v1/academic-years`: List academic years
- `GET /api/v1/academic-years/:id`: Get academic year by ID
- `PATCH /api/v1/academic-years/:id`: Update academic year
- `DELETE /api/v1/academic-years/:id`: Delete academic year

### Terms
- `POST /api/v1/terms`: Create term
- `GET /api/v1/terms`: List terms
- `GET /api/v1/terms/:id`: Get term by ID
- `PATCH /api/v1/terms/:id`: Update term
- `DELETE /api/v1/terms/:id`: Delete term

### Subjects
- `POST /api/v1/subjects`: Create subject
- `GET /api/v1/subjects?termId=...`: List subjects
- `GET /api/v1/subjects/:id`: Get subject by ID with coverage
- `GET /api/v1/subjects/:id/bundle`: Get full subject detail bundle (subject, topics, assessments, exams)
- `PATCH /api/v1/subjects/:id`: Update subject
- `DELETE /api/v1/subjects/:id`: Delete subject

### Topics
- `POST /api/v1/subjects/:subjectId/topics`: Add topic to subject
- `GET /api/v1/subjects/:subjectId/topics`: List topics ordered deterministically
- `GET /api/v1/topics/:id`: Get topic by ID
- `PATCH /api/v1/topics/:id`: Update topic status/details
- `DELETE /api/v1/topics/:id`: Delete topic

### Assessments
- `POST /api/v1/assessments`: Create assessment with covered topic IDs
- `GET /api/v1/assessments?termId=...&subjectId=...`: List assessments
- `GET /api/v1/assessments/:id`: Get assessment by ID
- `PATCH /api/v1/assessments/:id`: Update assessment
- `DELETE /api/v1/assessments/:id`: Delete assessment

### Exams
- `POST /api/v1/exams`: Create exam with covered topic IDs
- `GET /api/v1/exams?termId=...&subjectId=...`: List exams
- `GET /api/v1/exams/:id`: Get exam by ID
- `PATCH /api/v1/exams/:id`: Update exam
- `DELETE /api/v1/exams/:id`: Delete exam

---

## 18. Future Intelligence Readiness

Academic source facts are prepared to feed future intelligence pipelines (Phases 12, 17, 18):
- `exam_date` and `due_at` will supply upcoming deadline pressure signals to candidate scoring.
- `subject_id` and `topic_id` on tasks will enable domain-specific session analysis.
- Topic status (`not_started`, `in_progress`, `covered`, `needs_review`) provides verifiable input for revision scheduling.

---

## 19. Explicit Non-Goals for Phase 11

The following capabilities are deliberately excluded from Phase 11 and deferred to future phases:
- No AI study planner or automated calendar rescheduling.
- No AI academic coach or LLM calls.
- No mastery scoring, readiness grading, or GPA prediction.
- No automated syllabus extraction or OCR parsing of PDF syllabi.
- No external school LMS integrations (Canvas, Blackboard, Google Classroom).
- No gamification badges or academic streaks.
