# Avenza Database Architecture & Conventions

> **"Plan. Execute. Evolve."**  
> _Database Foundation — Supabase PostgreSQL_

---

## 1. Source of Truth

**Supabase PostgreSQL** is the single source of truth for all persistent Avenza data.

- **No additional ORMs**: Prisma, Drizzle, TypeORM, and Mongoose are prohibited.
- **Raw SQL Migrations**: Database schemas, functions, triggers, constraints, and RLS policies are authored as deterministic SQL migrations located in `supabase/migrations/`.

---

## 2. Identity & Ownership Model

```
       Clerk Auth (Authoritative Provider)
                    │
                    ▼ (Clerk User ID: string)
        public.profiles (Application User)
                    │
                    ▼ (1:1 CASCADE via user_id)
      public.user_preferences (Settings & Targets)
                    │
                    ▼ (Future Phase Domain Entities)
          [user-owned domain data]
```

1. **Authentication Provider**: **Clerk** is the authoritative authentication and identity provider.
2. **Database Identity**: Supabase stores application-level user profiles. The database anchors each profile to Clerk using the unique `clerk_user_id` column.
3. **No Credential Storage**: Passwords, OAuth tokens, session tokens, and API keys are **never** stored in the database.
4. **Ownership Flow**:
   - `profiles` represents application users.
   - Domain tables (e.g. `user_preferences`) reference `profiles(id)` via `user_id`.
   - The database never trusts unauthenticated client inputs for user identification.

---

## 3. Database Conventions

### 3.1 Table & Column Naming

- **Tables**: Snake_case, plural nouns (e.g., `profiles`, `user_preferences`).
- **Columns**: Snake_case (e.g., `clerk_user_id`, `daily_target_minutes`).
- **Primary Keys**: Always named `id`.
- **Foreign Keys**: Named `<singular_referenced_table>_id` (e.g., `user_id`).

### 3.2 Primary Keys

- **Type**: UUID (`uuid`).
- **Generation Strategy**: Native PostgreSQL `gen_random_uuid()` (cryptographically secure v4 UUID).
- **Rationale**: Prevents enumeration attacks, supports distributed generation, and simplifies replication.

### 3.3 Foreign Keys & Delete Behavior

- **Explicit Foreign Key Constraints**: All relationships must specify explicit foreign keys.
- **Cascading Deletions**:
  - Used strictly for 1:1 or tightly owned child entities whose lifecycle is indivisible from the parent (e.g., `user_preferences.user_id` &rarr; `profiles.id` with `ON DELETE CASCADE`).
  - For loose associations or audit data, `ON DELETE RESTRICT` or `ON DELETE SET NULL` will be applied and documented.

### 3.4 Timestamps

- **Storage Type**: Always `TIMESTAMPTZ` (timestamp with time zone).
- **Default**: `now()`.
- **Convention**:
  - `created_at`: Set once at creation.
  - `updated_at`: Automatically updated via database trigger.
- **No Local Timestamps**: User timezone preferences (`timezone`) are for display and scheduling calculation only; all persisted timestamps remain UTC-normalized `TIMESTAMPTZ`.

### 3.5 Automatic `updated_at` Trigger Strategy

A reusable PostgreSQL function `public.handle_updated_at()` is defined once and attached to tables via a `BEFORE UPDATE` trigger:

```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Indexing Conventions

- **Primary Keys & Unique Constraints**: Automatically indexed by PostgreSQL B-trees.
- **Foreign Keys**: Explicit B-tree index created on every foreign key column (e.g., `idx_user_preferences_user_id`).
- **Lookup Columns**: Explicit index on external identity keys (e.g., `idx_profiles_clerk_user_id`).
- **Rule**: Indexes are added only when backed by an active query pattern. No speculative indexing.

---

## 5. Row Level Security (RLS) & Authorization

RLS is mandatory on every table in the `public` schema.

```sql
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
```

### 5.1 Dual-Layer Authorization Strategy

1. **Client Direct Access (Defense-in-Depth via Supabase PostgREST)**:
   - When authenticated requests pass through Supabase client libraries with a verified Clerk JWT, the Clerk user identity is extracted via `(select auth.jwt() ->> 'sub')`.
   - Policies verify that `clerk_user_id` matches the token claim.
   - Child records verify ownership through parent profile join: `user_id IN (SELECT id FROM public.profiles WHERE clerk_user_id = (select auth.jwt() ->> 'sub'))`.
2. **Backend API Access (Privileged Fastify Server)**:
   - The Fastify backend connects using the server-only `SUPABASE_SERVICE_ROLE_KEY`.
   - The backend validates Clerk identity independently in application middleware.
   - Policies explicitly permit `auth.role() = 'service_role'` for administrative and system operations.

### 5.2 Summary of Phase 2 Policies

| Table              | Policy Name                      | Command | Expression / Condition                                                                                                     |
| :----------------- | :------------------------------- | :------ | :------------------------------------------------------------------------------------------------------------------------- |
| `profiles`         | `profiles_select_policy`         | SELECT  | `auth.role() = 'service_role' OR (select auth.jwt() ->> 'sub') = clerk_user_id`                                            |
| `profiles`         | `profiles_insert_policy`         | INSERT  | `auth.role() = 'service_role' OR (select auth.jwt() ->> 'sub') = clerk_user_id`                                            |
| `profiles`         | `profiles_update_policy`         | UPDATE  | `auth.role() = 'service_role' OR (select auth.jwt() ->> 'sub') = clerk_user_id`                                            |
| `profiles`         | `profiles_delete_policy`         | DELETE  | `auth.role() = 'service_role' OR (select auth.jwt() ->> 'sub') = clerk_user_id`                                            |
| `user_preferences` | `user_preferences_select_policy` | SELECT  | `auth.role() = 'service_role' OR user_id IN (SELECT id FROM profiles WHERE clerk_user_id = (select auth.jwt() ->> 'sub'))` |
| `user_preferences` | `user_preferences_insert_policy` | INSERT  | `auth.role() = 'service_role' OR user_id IN (SELECT id FROM profiles WHERE clerk_user_id = (select auth.jwt() ->> 'sub'))` |
| `user_preferences` | `user_preferences_update_policy` | UPDATE  | `auth.role() = 'service_role' OR user_id IN (SELECT id FROM profiles WHERE clerk_user_id = (select auth.jwt() ->> 'sub'))` |
| `user_preferences` | `user_preferences_delete_policy` | DELETE  | `auth.role() = 'service_role' OR user_id IN (SELECT id FROM profiles WHERE clerk_user_id = (select auth.jwt() ->> 'sub'))` |

---

## 6. Migration Structure & Workflow

- **Directory**: `supabase/migrations/`
- **Naming Pattern**: `YYYYMMDDHHMMSS_<descriptive_name>.sql`
- **Rules**:
  1. Never modify applied migrations in production; write forward migrations.
  2. Migrations must be deterministic, self-contained, and idempotent where appropriate (`CREATE TABLE IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`).
  3. Every migration must include explicit RLS policies for newly created tables.

---

## 7. Future Schema Expansion Rules

When introducing domain entities in future phases (e.g. Goals, Tasks, Focus Sessions):

1. **Always link to `profiles(id)`** using `user_id UUID NOT NULL REFERENCES public.profiles(id)`.
2. **Always enable RLS** and implement isolation policies matching parent profile ownership.
3. **Always attach `handle_updated_at()` trigger** if table contains mutable data.
4. **Always validate domain boundaries with check constraints** (e.g. non-negative durations, valid statuses).
5. **Add TypeScript types and Zod schemas** to `@avenza/shared` strictly reflecting the migration.
