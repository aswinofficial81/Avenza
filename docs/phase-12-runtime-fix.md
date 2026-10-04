# Phase 12 — Skills blank-screen runtime fix

## 1. Root cause

**Root cause: SkillsPage received a non-array API response shape and called `forEach()` on it.**

Confirmed by inspection and by reproducing the exact error against the original code
(see §6): `TypeError: skills.forEach is not a function` at `SkillsPage.tsx:41`.

Category: **frontend data contract (TanStack Query hook ↔ API envelope)**. It was not
Vite/HMR, auth/profile initialisation, route loading or the API. The Fastify API was healthy
(`GET /health` → `ok`) and `/auth/me` resolved normally.

Why the whole screen went blank: the app has no React error boundary, so an exception
thrown during render unmounts the entire tree (sidebar, topbar and page). Overview
worked because its hooks unwrap the envelope correctly. Only the Skills hooks did not.

## 2. Actual API response shape

`skills.controller.ts` (`listSkills`) replies with the standard Avenza envelope:

```json
{ "success": true, "data": [ /* SkillWithMasteryDto[] */ ] }
```

The same envelope is used by every other controller (`ApiSuccessResponse<T>` in `@avenza/shared`).

## 3. Previous frontend expectation

`useSkills()` called `api.get<SkillWithMasteryDto[]>(...)` and returned the response as-is.
`ApiClient.get` does not unwrap, so the query's `data` was `{ success, data }`, an object.
`SkillsPage` guarded only against `undefined` (`if (!skills) return []`), so the object
passed the guard and `skills.forEach` threw. The type annotation claimed an array, which
hid the mismatch from TypeScript.

## 4. Corrected contract

Per the existing convention (`useGoals`, `useTasks`, `useAcademics`, `useEvidence`):

```ts
const response = await api.get<ApiSuccessResponse<SkillWithMasteryDto[]>>(endpoint);
return response.data;
```

Normalisation happens in the hook, so `SkillsPage` receives `SkillWithMasteryDto[]` and
knows nothing about the transport envelope. Zero skills yields `[]`. No Skills-specific
envelope was introduced, and no casts or non-null assertions were used.

The same defect was present in every other Skills hook that returns a DTO, so all were
corrected the same way: `useSkill`, `useSkillDetail`, `useSkillMastery`, `useCreateSkill`,
`useUpdateSkill`, `useArchiveSkill`, and the evidence/goal/task/topic link mutations.

## 5. Files changed

| File | Change |
| --- | --- |
| `apps/web/src/features/skills/useSkills.ts` | Unwrap `ApiSuccessResponse<T>` in all DTO-returning hooks |
| `apps/web/src/features/skills/useSkills.test.tsx` | New regression tests (real hook + real page) |
| `docs/phase-12-runtime-fix.md` | This report |

`SkillsPage.tsx` was not modified. Its loading, error and empty branches were already
correct; the bug was upstream.

Note: `git diff` also shows pre-existing uncommitted edits to `apps/api/src/app.ts` and
`apps/web/vite.config.ts`. These were not made as part of this fix.

## 6. Regression test

`useSkills.test.tsx` mocks only the transport (`useApiClient`) and returns the exact
`{ success: true, data: [...] }` envelope. `useSkills` and `SkillsPage` are the real code.

- Hook returns an array (not the envelope) for an enveloped response.
- Hook returns `[]` for zero skills.
- Page renders skills from an enveloped response (the original bug).
- Page renders loading without touching `skills`.
- Page renders the empty state for zero skills.
- Page renders the error state when the request fails.

**Reproduced the failure:** with `useSkills.ts` reverted to `HEAD`, 4 of 6 tests failed
and Vitest reported `TypeError: skills.forEach is not a function` at
`src/routes/SkillsPage.tsx:41:12`, inside the `useMemo` in `SkillsPage`. With the fix
restored, all 6 pass.

## 7. Test results

- `@avenza/web`: **18 files, 88 tests passed** (includes Goals, Tasks, Today, Focus,
  Academics, Intelligence, Skills, AppShell).
- `@avenza/shared`: 10 files, 50 tests passed.
- `@avenza/api`: in the full `pnpm test` run, 7 DB test files (`src/db/*.database.test.ts`,
  `database.test.ts`) failed with `Hook timed out in 30000ms` while creating `PGlite`
  in `beforeAll`, under parallel load. The other 12 files passed, including
  `skills.test.ts`. Re-running those 7 files alone with a longer hook timeout and
  sequential execution: **7 files, 84 tests passed**. This is a test-environment resource
  timeout and unrelated to the web change, but the default `pnpm test` is **not currently
  green on this machine** until the `PGlite` hook timeout or parallelism is addressed.

## 8. Typecheck / 9. Lint / 10. Build

- `pnpm run typecheck`: no errors reported.
- `pnpm run lint`: no errors reported.
- `pnpm run build`: succeeded (shared, api, web; `tsc --noEmit` + `vite build`). The only
  output was the existing chunk-size warning.

## 11. Browser verification

**Not performed.** The `/skills` route sits behind Clerk sign-in, and I could not
authenticate in an automated browser, so I did not hard-refresh, navigate
Overview ↔ Skills, or test zero/one skill in a live browser, and did not run
`vite preview`. The fix is verified only at the component/hook level with the real
envelope, where the original error is reproduced and removed. Please do the manual
check below before marking Phase 12 passed.

Manual check (Vite dev server on `:3001`, API on `:3005`):
1. Hard refresh `/skills`, then normal refresh.
2. Overview → Skills → Overview → Skills.
3. Open `/skills` directly in a new tab.
4. With zero skills: expect "No skills found" and "Create First Skill".
5. Create one skill: it should appear with mastery state "unknown".

## Observations (not changed, out of scope)

- Port 3001 is listened to by both Vite (IPv6) and Docker's backend (IPv4 `127.0.0.1`).
  `http://localhost:3001` may resolve to Docker instead of Vite in some browser sessions;
  this could be an independent source of intermittent odd behaviour. Not touched.
- There is still no root error boundary. It was requested in the earlier brief but this
  task was scoped to the data-contract fix only.
- `ApiClient`'s network error text mentions port 3005, while `env.ts` falls back to 3001.
