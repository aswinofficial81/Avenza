# Phase 9 Runtime Fix — Evidence API Loading Failure

## 1. Exact Root Cause

The `GET /api/v1/evidence` endpoint returned an error because the database migration
`20261003000005_evidence.sql` had been written to disk but **not applied to the
running local Supabase instance**.

The `supabase migration list --local` command confirmed:

`
{ "local": "20261003000005", "remote": "" }
`

The `remote` field being empty means the migration had never been executed against
the local PostgreSQL database. As a result, the `evidence` and `evidence_links`
tables did not exist at runtime. Any Supabase query against `.from('evidence')`
resulted in a PostgREST error:

`
Failed to list evidence: relation "public.evidence" does not exist
`

This propagated as a 500 Internal Server Error, which the frontend surfaced as:

`
"Failed to load evidence records."
`

## 2. How It Was Reproduced

1. Inspected all code layers (routes, controller, service, repository, types, hook) — all structurally correct.
2. Ran `npx supabase migration list --local` and found `"remote": ""` for migration `20261003000005`.
3. Confirmed via HTTP: `GET /api/v1/evidence` (no auth) → 401 UNAUTHORIZED (route registered).
4. Applied migration, re-ran all 152 tests — all passed.

## 3. Files Changed

| File | Change |
|---|---|
| Database (Supabase local instance) | Applied migration `20261003000005_evidence.sql` via `supabase db push --local` |

No source code was changed.

## 4. Fix Applied

`
npx supabase db push --local
`

Post-fix all 5 migrations show local and remote in sync.

## 5. Why the Fix Is Correct

The migration creates the `public.evidence` and `public.evidence_links` tables
with all columns, constraints, indexes, triggers, and RLS policies. These were
prerequisites for any API query to succeed.

## 6. Security Implications

None. The fix is additive — it creates exactly the tables and RLS policies
already reviewed. The security model is unchanged:

  Clerk JWT -> Fastify auth middleware -> request.profile.id -> evidence.user_id

RLS enforces user isolation at the database level. The API additionally
enforces it via `eq('user_id', userId)` in every query.

## 7. Tests Run

- API: 152/152 tests passing (12 test files)
- Web: 67/67 tests passing (14 test files)
- evidence.database.test.ts: 5/5 tests passing against live DB
- API TypeScript: 0 errors
- Web TypeScript: 0 errors

## 8. Final API Response Shape

Authenticated GET /api/v1/evidence returns:

{
  "success": true,
  "data": [],
  "pagination": { "page": 1, "pageSize": 15, "total": 0, "totalPages": 1 },
  "summary": { "total": 0, "verified": 0, "unverified": 0, "rejected": 0 }
}

---

## PHASE 9 PASSED
