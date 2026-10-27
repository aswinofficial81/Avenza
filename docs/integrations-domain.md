# Avenza Integrations Domain

## 1. Domain Purpose & Philosophy

The Integrations domain connects external third-party development and productivity platforms to Avenza. It enables ingesting external activity, code repositories, commits, and contributions to serve as empirical signals for Avenza's growth operating system.

### Authoritative Boundaries & Invariants

```
External Provider (GitHub, etc.)
            ↓
     Provider Adapter
            ↓
     Integration Hub
            ↓
     Raw External Data
            ↓
       Normalization
            ↓
      Domain Signals
            ↓
Skills / Projects / Career / Evidence / Intelligence
```

1. **Avenza Remains Authoritative:**
   - External integrations are **never** the source of truth for Avenza's user-owned planning data (Goals, Milestones, Tasks, Focus Sessions, Academics, Skills, or Intelligence).
   - External activity **must not automatically complete** Goals, Milestones, or Tasks.
   - External platforms provide read-only signals and activity feeds according to explicit Avenza rules.

2. **Isolation & Least Privilege:**
   - Provider adapters are strictly isolated in `apps/api/src/infrastructure/providers/`.
   - Core domain modules (Goals, Tasks, Skills, DSA, Academics) do **not** contain provider-specific API calls.
   - Read-only access (`read:user`, `repo`) is requested by default.
   - Passwords and raw provider credentials are never requested or stored.

3. **Security & Token Isolation:**
   - OAuth tokens are encrypted with AES-256-GCM using unique 12-byte initialization vectors and 16-byte authentication tags before database persistence.
   - Provider access tokens are **never** exposed to the frontend browser, in API responses, in logs, or via `VITE_*` environment variables.
   - OAuth state parameters are cryptographically random, bound to the user profile, time-limited (15 minutes), and consumed exactly once to prevent CSRF and replay attacks.

4. **Multi-Tenant Row-Level Security (RLS):**
   - Every integration connection, oauth state, sync job, repository, and activity record is partitioned by `user_id = auth.uid()`.
   - User A cannot view, sync, modify, or disconnect User B's integrations or external data.

5. **Idempotent Synchronization & Duplicate Prevention:**
   - Database unique constraints guarantee idempotency:
     - `(user_id, provider)` on `integration_connections`
     - `(user_id, provider, external_id)` on `external_repositories`
     - `(user_id, provider, external_id)` on `external_activities`
   - Repeated sync runs update records in place without duplicating data or creating spurious events.

---

## 2. Domain Entities & Database Schema

### `integration_connections`
Stores third-party provider account connections per user profile.
- `id` (UUID, PK)
- `user_id` (UUID, FK -> profiles.id)
- `provider` (TEXT: `'github'`, `'leetcode'`, `'codeforces'`)
- `external_account_id` (TEXT, stable provider account ID or canonical handle)
- `external_username` (TEXT, e.g. `'octocat'`, `'tourist'`)
- `external_display_name` (TEXT)
- `external_avatar_url` (TEXT)
- `external_email` (TEXT)
- `status` (TEXT: `'CONNECTED'`, `'SYNCING'`, `'SYNCED'`, `'NEEDS_REAUTHORIZATION'`, `'PERMISSION_ERROR'`, `'RATE_LIMITED'`, `'TEMPORARILY_UNAVAILABLE'`, `'DISCONNECTED'`)
- `scopes` (TEXT[])
- `encrypted_access_token` (TEXT, AES-256-GCM ciphertext, NULL for direct-handle providers like LeetCode and Codeforces)
- `encrypted_refresh_token` (TEXT, optional)
- `token_expires_at` (TIMESTAMPTZ)
- `sync_cursor` (TEXT)
- `sync_state` (JSONB: provider-specific normalized profile and contest metrics)
- `last_synced_at`, `last_sync_started_at`, `last_sync_completed_at` (TIMESTAMPTZ)
- `last_error_code`, `last_error_message` (TEXT)
- `connected_at`, `disconnected_at`, `created_at`, `updated_at` (TIMESTAMPTZ)

### `external_repositories`
Stores normalized repositories discovered during synchronization.
- `id` (UUID, PK)
- `connection_id` (UUID, FK -> integration_connections.id)
- `user_id` (UUID, FK -> profiles.id)
- `provider` (TEXT)
- `external_id` (TEXT)
- `name` (TEXT), `full_name` (TEXT), `owner` (TEXT)
- `is_private` (BOOLEAN)
- `html_url` (TEXT)
- `description` (TEXT)
- `default_branch` (TEXT)
- `primary_language` (TEXT)
- `languages` (JSONB: key-value byte counts)
- `stars_count`, `forks_count`, `open_issues_count` (INTEGER)
- `pushed_at`, `created_at`, `updated_at` (TIMESTAMPTZ)

### `external_activities`
Stores normalized activity events from connected providers.
- `id` (UUID, PK)
- `connection_id` (UUID, FK -> integration_connections.id)
- `repository_id` (UUID, FK -> external_repositories.id, optional)
- `user_id` (UUID, FK -> profiles.id)
- `provider` (TEXT: `'github'`, `'leetcode'`, `'codeforces'`)
- `external_id` (TEXT)
- `activity_type` (TEXT: `'push'`, `'pull_request'`, `'issue'`, `'dsa_solve'`, `'contest_participation'`, etc.)
- `occurred_at` (TIMESTAMPTZ)
- `title` (TEXT), `summary` (TEXT), `external_url` (TEXT)
- `metadata` (JSONB)
- `raw_data` (JSONB, sanitized)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### `sync_jobs`
Audit trail of synchronization operations.
- `id` (UUID, PK)
- `connection_id` (UUID)
- `user_id` (UUID)
- `provider` (TEXT)
- `job_type` (TEXT: `'initial'`, `'incremental'`, `'manual'`)
- `status` (TEXT: `'QUEUED'`, `'RUNNING'`, `'SUCCESS'`, `'FAILED'`, `'RATE_LIMITED'`)
- `started_at`, `completed_at` (TIMESTAMPTZ)
- `records_synced` (INTEGER)
- `error_message` (TEXT)
- `created_at` (TIMESTAMPTZ)

---

## 3. Provider Implementations

### GitHub (`github`)
- **Connection Type:** OAuth 2.0 (`read:user`, `repo`).
- **Capabilities:** `['oauth', 'repositories', 'commits', 'activity', 'read_only']`
- **Security:** Encrypted tokens in DB via AES-256-GCM. 15-minute one-time CSRF states.

### LeetCode (`leetcode`)
- **Connection Type:** Public username verification via backend GraphQL.
- **Capabilities:** `['profile', 'activity', 'read_only']`
- **Security:** No passwords or cookies required. 15-minute sync cooldown.

### Codeforces (`codeforces`)
- **Connection Type:** Public handle verification via backend REST API (`https://codeforces.com/api/`).
- **Capabilities:** `['profile', 'activity', 'read_only']`
- **Handle Validation:** `^[a-zA-Z0-9_.-]{3,24}$`.
- **Identity Model:** `external_account_id = current canonical handle`.
  - *Limitation:* Codeforces permits handle changes. If a user changes their handle on Codeforces, they must reconnect with their new handle in Avenza.
- **Rate Limit & Throttling:**
  - Codeforces enforces a maximum of 1 request every 2 seconds.
  - Avenza implements an internal throttle guaranteeing `>= 2000ms` between upstream requests.
  - Sync requests are executed strictly sequentially:
    1. `user.info`
    2. wait >= 2000ms -> `user.rating`
    3. wait >= 2000ms -> `user.status?from=1&count=20`
  - Defensive backoff maps HTTP 429 and "Call limit exceeded" to connection status `RATE_LIMITED`.
  - Manual sync enforces a 5-minute cooldown per connection.
- **Submission Scope:**
  - Queries latest 20 submissions (`from=1&count=20`).
  - Ingests only submissions where `verdict === "OK"`.
  - No deep pagination beyond top 20 submissions for MVP.
- **Contest Scope:**
  - Queries `user.rating` (rated contests participated).
  - Ingests up to the latest 5 rated contest participations as `contest_participation`.
- **Evidence Integration:**
  - Submissions generate non-authoritative evidence: `source_type = 'external_provider'`, `source_id = 'codeforces:submission:<id>'`, `evidence_strength = 'medium'`, `verification_status = 'unverified'`.
  - Contests generate non-authoritative evidence: `source_type = 'external_provider'`, `source_id = 'codeforces:contest:<contestId>'`.
  - External Codeforces activities **never** mutate Avenza DSA problem attempts, mastery, Skills, Goals, or Tasks.

### Google Calendar (`google_calendar`)
- **Connection Type:** OAuth 2.0 Authorization Code flow (`access_type=offline`, `prompt=consent`).
- **Scopes (Strictly Read-Only):**
  - `openid`
  - `email`
  - `profile`
  - `https://www.googleapis.com/auth/calendar.readonly`
  - *Forbidden:* Write scopes (`https://www.googleapis.com/auth/calendar`) and arbitrary workspace scopes are strictly prohibited.
- **Capabilities:** `['oauth', 'calendar', 'read_only']`
- **Identity Model:**
  - `external_account_id = sub` (Google OpenID Connect subject claim; immutable identifier).
  - Email, display name, and avatar are stored solely as profile metadata.
- **Token Security & Refresh:**
  - Access and refresh tokens are encrypted at rest using AES-256-GCM (`INTEGRATION_TOKEN_ENCRYPTION_KEY`).
  - Access tokens are checked before sync: if expiring within 5 minutes, decrypted refresh token is exchanged at `https://oauth2.googleapis.com/token` to obtain a fresh access token before making Google Calendar API calls.
  - On HTTP 401 Unauthorized during API calls, a single token refresh attempt is performed before failing.
  - On disconnect, credentials are deleted and an upstream revocation call (`https://oauth2.googleapis.com/revoke`) is executed.
- **Calendar Discovery & Scope (MVP):**
  - Discovers calendars via `GET /calendar/v3/users/me/calendarList`.
  - Automatically selects the primary calendar (`primary: true`). Secondary calendar selection is architecturally supported via `selectedCalendarIds` in `sync_state`.
- **Initial Event Sync Window:**
  - `timeMin = now - 7 days`
  - `timeMax = now + 30 days`
  - `singleEvents = true` (server-side recurring event expansion; no manual RRULE parsing).
  - `showDeleted = true`.
  - Pages through `nextPageToken` and captures `nextSyncToken` only on the final page.
- **Incremental Sync Semantics:**
  - When `syncTokens[calendarId]` exists, queries `events.list` with `syncToken=<token>` and `showDeleted=true`.
  - Explicitly omits `timeMin`, `timeMax`, and `orderBy` during incremental sync as required by Google Calendar API.
  - Updates `syncTokens[calendarId]` to the new `nextSyncToken` upon completion.
- **HTTP 410 Gone Recovery:**
  - If Google responds with HTTP 410 (sync token invalid or expired), Avenza discards the invalid sync token and immediately executes a clean windowed initial sync (`-7` to `+30` days) to self-heal.
- **Privacy Filtering & Data Minimization:**
  - **Stored fields:** `calendar_id`, `external_event_id`, `title` (summary or "(No title)"), `start_time`, `end_time`, `is_all_day`, `time_zone`, `is_busy` (from `transparency === 'opaque'`), `status` (`confirmed`, `tentative`, `cancelled`), `is_recurring`, `recurring_event_id`, `html_link`.
  - **Omitted fields:** Descriptions, attendee emails, conferencing PINs, Google Meet access tokens, and arbitrary extended properties are discarded.
- **Dedicated Storage Table:**
  - Stored in `public.external_calendar_events` (NOT `external_activities`).
  - Unique constraint on `(user_id, calendar_id, external_event_id)` ensures idempotent upserts (0 duplicates).
  - Row-Level Security (RLS) restricts access strictly to the event owner (`user_id = auth.uid()`).
  - Cascade-deleted when the integration connection is removed.
- **Core Invariant — External Scheduling Context Only:**
  - Calendar events are strictly temporal scheduling constraints for future planning services (`SchedulingContextService`).
  - Calendar events **never** generate achievement evidence, never create DSA problems/attempts, never modify mastery, never create Skills, and never complete Goals, Milestones, or Tasks.
  - No write operations (`events.insert`, `update`, `delete`) are implemented or permitted.

---

## 4. Signal Integration with Avenza Domains

External activity generates signals according to explicit Avenza rules:

| External Data | Domain Target | Avenza Integration Rule |
|---|---|---|
| Repositories | Projects Domain | Read-only reference to external source repository. Does not auto-create project milestones. |
| Languages | Skills Domain | Candidate signal for skill evidence. Does **not** automatically elevate mastery or grant skills without verified evidence. |
| Activities | Evidence Domain | Emits evidence record with `source_type = 'external_provider'` and `source_id = '<provider>:<type>:<id>'`. Idempotent via unique constraint. |
| Solved Problems | DSA Domain | External solves (LeetCode / Codeforces) generate observational activities and unverified evidence. They **never** mutate Avenza DSA problem mastery, attempt records, Skills, or Tasks. |
| Calendar Events | Scheduling Context | External events (Google Calendar) stored in `external_calendar_events`. Strictly temporal planning constraints. **Never** generates evidence, completes tasks, or alters mastery. |
