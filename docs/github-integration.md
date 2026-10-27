# Avenza GitHub Integration

## 1. Overview & Capability Set

GitHub is the initial reference provider for Phase 14 of Avenza. It establishes the end-to-end integration architecture: OAuth authorization, encrypted token storage, background synchronization, idempotent data normalization, rate limit handling, and UI connection controls.

### Explicit Capabilities
- `oauth`: Web Application OAuth 2.0 authorization code flow.
- `profile`: Authenticated user profile identification (login, id, name, avatar, email).
- `repositories`: User-owned and contributed public repositories.
- `languages`: Repository programming language breakdown.
- `activity`: Public event activity stream (pushes, pull requests, issues).
- `read_only`: Minimum read-only scope requirement (`read:user`, `repo`).

---

## 2. OAuth Authorization Flow

```
1. Frontend User clicks "Connect GitHub" on Settings → Connected Accounts
2. POST /api/v1/integrations/github/connect
   → Generates cryptographically secure random state (32 bytes hex)
   → Stores state in `integration_oauth_states` with 15-minute TTL
   → Returns GitHub authorization URL
3. Browser navigates to GitHub OAuth authorization screen
4. User grants access on GitHub
5. GitHub redirects back to configured callback: `/settings?provider=github&code=...&state=...`
6. Frontend invokes GET /api/v1/integrations/github/callback?code=...&state=...
7. Backend verifies and consumes state (preventing replay attacks)
8. Backend exchanges authorization code for access token via GitHub API
9. Backend fetches stable GitHub identity via GET /user
10. Backend encrypts access token via AES-256-GCM and persists connection
11. Backend schedules immediate initial synchronization
12. Frontend cleans URL search parameters and refreshes connection status
```

---

## 3. Security Architecture & Invariants

1. **Token Protection:**
   - Provider tokens are encrypted with `AES-256-GCM` using environment variable `INTEGRATION_TOKEN_ENCRYPTION_KEY` (or secure fallback for test/development).
   - Each token has an independent 12-byte initialization vector (`iv`) and 16-byte authentication tag (`tag`).
   - The frontend never receives access tokens; `encrypted_access_token` is stripped by DTO mappers and API controllers.
   - Access tokens are never logged or exported to client-side bundles.

2. **Cross-User Isolation (Row-Level Security):**
   - User A cannot view, modify, sync, or disconnect User B's GitHub connection or data.
   - Enforced by PostgreSQL RLS on all integration tables (`user_id = auth.uid()`).

3. **Rate-Limit Handling:**
   - HTTP 403/429 responses with `x-ratelimit-remaining: 0` are captured by `GitHubClient`.
   - The connection is transitioned to `RATE_LIMITED` status with `last_error_message` indicating the reset timestamp.
   - Sync aborts gracefully without throwing unhandled exceptions, preserving all previously synchronized data.

4. **Idempotent Upserts:**
   - Identical repositories and activities are updated in place using `ON CONFLICT (user_id, provider, external_id) DO UPDATE`.
   - Duplicate sync operations do not generate duplicate database records or multiple evidence items.

---

## 4. API Endpoints

All endpoints require Clerk Bearer token authentication:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/integrations` | List all active integration connections for authenticated user. |
| `GET` | `/api/v1/integrations/github` | Get GitHub connection details for authenticated user. |
| `POST` | `/api/v1/integrations/github/connect` | Initiate GitHub OAuth flow; returns `{ authorization_url, state }`. |
| `GET` | `/api/v1/integrations/github/callback` | Process OAuth code & state exchange; finalizes connection. |
| `POST` | `/api/v1/integrations/github/sync` | Manually trigger incremental or full sync of GitHub data. |
| `POST` | `/api/v1/integrations/github/disconnect` | Revoke/delete stored credentials and set status to `DISCONNECTED`. |
| `GET` | `/api/v1/integrations/github/status` | Lightweight status check: `{ connected: boolean, connection: ... }`. |
| `GET` | `/api/v1/integrations/github/repositories` | Retrieve synchronized external repositories. |
| `GET` | `/api/v1/integrations/github/activities` | Retrieve synchronized external activities. |

---

## 5. UI Integration

Located under **Settings → Connected Accounts**:
- **Not Connected State:** Clear branding, capability summary, and "Connect GitHub" CTA.
- **Connected / Synced State:** Shows account handle (`@username`), connection status badge, last synced timestamp, repository and activity counts, and repository previews.
- **Syncing State:** Displays spinner and disables redundant triggers.
- **Error States:** Dedicated warning banners for `Rate Limited`, `Needs Reauthorization`, `Permission Error`, and `Temporarily Unavailable`.
- **Disconnect Action:** Interactive modal dialog requesting user confirmation before deleting credentials.
