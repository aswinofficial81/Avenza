# Avenza System Architecture

> **"Plan. Execute. Evolve."**  
> _A personal operating system for growth._

---

## 1. Executive Summary

Avenza is designed from first principles as an integrated personal operating system for personal and professional growth. This document defines the structural blueprints, boundary definitions, and architectural decisions established during **Phase 1 (Repository & Tooling Foundation)**.

---

## 2. Monorepo Repository Structure

The repository is organized as a workspace-based monorepo managed with **pnpm**:

```
Avenza/
│
├── apps/
│   ├── web/                     # Client application (React + Vite + Tailwind CSS)
│   └── api/                     # Server application (Node.js + Fastify + Zod)
│
├── packages/
│   ├── shared/                  # Common domain contracts, response schemas, and constants
│   └── config/                  # Shared tooling configurations (TypeScript, Prettier)
│
├── supabase/
│   └── migrations/              # Supabase PostgreSQL schema migrations (future phases)
│
├── docs/
│   └── architecture.md          # Architectural blueprints and decisions
│
├── .gitignore                   # Workspace gitignore rules
├── .env.example                 # Root environment template
├── pnpm-workspace.yaml          # Monorepo workspace boundaries
├── package.json                 # Monorepo root scripts & dev dependencies
├── tsconfig.json                # Root TypeScript project references
└── README.md                    # Repository documentation and getting-started guide
```

---

## 3. Package and Application Responsibilities

### 3.1 `apps/web` (Client Application)

- **Technology Stack**: React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, Lucide React.
- **Responsibilities**:
  - UI presentation and user interaction.
  - Client-side routing and view state management.
  - Server state caching and synchronization via TanStack Query.
  - Local state kept strictly local (React state hooks).
- **Prohibitions**:
  - **Zero Database / Server Logic**: Must not contain database queries, direct database access, or backend services.
  - **Zero Private Credentials**: Server secrets (Clerk secret key, Supabase service role key, FreeLLM API key) must **never** be imported or referenced.

### 3.2 `apps/api` (Server Application)

- **Technology Stack**: Node.js, Fastify, TypeScript, Zod.
- **Responsibilities**:
  - Fastify server bootstrap with request ID tagging (`x-request-id`) and structured logging.
  - Centralized error handling and standard HTTP response shaping.
  - Environment validation and configuration management using Zod.
  - Health endpoint (`GET /health`) exposing uptime, timestamp, and version status.
- **Prohibitions**:
  - **No Business Logic in Route Handlers**: Route definitions remain thin transport mappings; logic is delegated to controllers and service layers.
  - **No Unvalidated Inputs**: All inputs and incoming payloads will be parsed through Zod schemas.

### 3.3 `packages/shared`

- **Purpose**: A strictly curated shared library for code that must be shared between frontend and backend.
- **Contents**:
  - Foundational response schemas: `HealthResponseSchema`, `HealthResponse`.
  - API envelope types: `ApiResponse<T>`, `ApiSuccessResponse<T>`, `ApiErrorResponse`.
  - Brand constants: `APP_NAME`, `APP_TAGLINE`.
- **Constraint**: Small and purposeful. Will **not** contain speculative types, mock data, or feature stubs.

### 3.4 `packages/config`

- **Purpose**: Single source of truth for tooling configuration across all workspace packages.
- **Contents**:
  - `tsconfig.base.json`: Common strict compiler settings (ES2022, strict null checks, noImplicitAny, noUnusedLocals).
  - `tsconfig.react.json`: React JSX settings for frontend packages.
  - `tsconfig.node.json`: Node runtime type definitions for backend services.
  - `prettier.config.js`: Uniform code formatting guidelines.

---

## 4. Database Architecture (Supabase PostgreSQL)

Avenza employs **Supabase PostgreSQL** as its single, authoritative database. ORMs such as Prisma, Drizzle, or TypeORM are strictly avoided in favor of deterministic SQL migrations.

### 4.1 Clerk Identity Relationship & Ownership Model

- **Identity Provider**: Clerk manages authentication credentials (passwords, MFA, social OAuth, session tokens). The database stores zero credentials.
- **Anchor Point**: The `public.profiles` table bridges Clerk identity to application data via `clerk_user_id TEXT NOT NULL UNIQUE`.
- **Ownership Graph**:
  ```
  Clerk User (Auth) ──> profiles(clerk_user_id) ──> user_preferences(user_id) ──> [Domain Entities]
  ```
- **Trust Boundary**: The database never trusts unauthenticated client inputs for identity. Client queries through PostgREST rely on verified JWT claims (`auth.jwt() ->> 'sub'`), while backend API operations resolve and enforce user context server-side.

### 4.2 Foundational Tables

1. **`public.profiles`**:
   - Primary key: `id UUID DEFAULT gen_random_uuid()`.
   - Fields: `clerk_user_id` (unique), `display_name`, `avatar_url`, `timezone`, `created_at`, `updated_at`.
   - Trigger: `handle_updated_at()` updates `updated_at` before every row update.
2. **`public.user_preferences`**:
   - Primary key: `id UUID DEFAULT gen_random_uuid()`.
   - Foreign key: `user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`.
   - Fields: `theme` (constrained to 'system', 'light', 'dark'), `timezone`, study start/end times, study target minutes (`daily_minimum_minutes`, `daily_target_minutes`, `max_daily_study_minutes`).
   - Constraints: Validates non-negative minute values and ensures `daily_target_minutes >= daily_minimum_minutes` and `max_daily_study_minutes >= daily_target_minutes`.
   - Trigger: `handle_updated_at()` attached for automatic timestamp tracking.

### 4.3 UUID & Primary Key Strategy

- All application entities utilize UUID primary keys generated natively via PostgreSQL `gen_random_uuid()`.
- Provides cryptographic unpredictability, prevents enumeration attacks, and supports safe distributed ID generation.

### 4.4 Timestamp Conventions

- All persisted timestamps use `TIMESTAMPTZ` (UTC-normalized timestamp with time zone), defaulting to `now()`.
- Display and scheduling timezones (e.g., user preference `timezone`) are treated as presentation settings, never altering raw timestamp storage.
- A single reusable PL/pgSQL function `public.handle_updated_at()` ensures consistent `updated_at` mutation behavior across all tables.

### 4.5 Foreign-Key & Indexing Conventions

- Relationships explicitly define foreign key constraints.
- `ON DELETE CASCADE` is reserved strictly for lifecycle-coupled 1:1 or parent-child ownership (e.g. `user_preferences`).
- Explicit indexes are maintained on foreign keys (`idx_user_preferences_user_id`) and external lookup keys (`idx_profiles_clerk_user_id`). Speculative indexes for future unbuilt features are prohibited.

### 4.6 Row Level Security (RLS) & Service-Role Boundary

- RLS is enabled unconditionally on all tables in `public`.
- **Direct Client Access**: PostgREST client queries match `(select auth.jwt() ->> 'sub') = clerk_user_id` for profiles, and parent profile subqueries for dependent tables.
- **Backend Service Access**: The Fastify backend utilizes `SUPABASE_SERVICE_ROLE_KEY` exclusively on the server (`auth.role() = 'service_role'`). This key bypasses RLS on the database while the API enforces business authorization independently.

---

## 5. Authentication & Authorization Architecture

Avenza establishes a verified cryptographic identity pipeline connecting Clerk, the Fastify API, and Supabase PostgreSQL:

```
Clerk Auth (Authoritative)
       ↓
React Client (apps/web)
       ↓
Authorization: Bearer <clerk_token>
       ↓
Fastify API (apps/api - requireAuth preHandler)
       ↓
Verified clerk_user_id
       ↓
profiles.clerk_user_id (Database Anchor)
       ↓
profiles.id (Application Identity)
       ↓
user-owned domain entities (Preferences, etc.)
```

### 5.1 Authoritative Identity Provider

- **Clerk** owns all credential storage, password security, session lifecycles, and MFA.
- Fastify and Supabase store **zero** user passwords, provider tokens, or session credentials.

### 5.2 Server-Determined Identity

- The client is **never** trusted to specify its identity. Request bodies or headers containing arbitrary user IDs (e.g. `userId: "xyz"`) are ignored.
- The authenticated identity is extracted exclusively by Fastify verifying the Clerk JWT token server-side via `@clerk/backend`.

### 5.3 Idempotent Profile Bootstrap

- When a verified user interacts with the API, `ProfileService.getOrCreateProfile` looks up `public.profiles` by `clerk_user_id`.
- If no profile exists, a new profile is bootstrapped with `clerk_user_id` and verified metadata (name, avatar, timezone).
- Uniqueness constraints on `clerk_user_id` in PostgreSQL prevent duplicate profile creation under race conditions.

### 5.4 Protected API Routes & Middleware

- Application endpoints under `/api/v1` (such as `GET /api/v1/auth/me`) require the `requireAuth` preHandler hook.
- Unauthenticated requests receive HTTP 401 with standard API error responses (`{ success: false, error: { code: 'UNAUTHORIZED', ... } }`).
- Public endpoints (such as `GET /health`) remain accessible without credentials.

### 5.5 Frontend Token Handling & API Client

- The React application utilizes `@clerk/clerk-react` and obtains active session tokens dynamically via `useAuth().getToken()`.
- Authentication tokens are **never** stored in `localStorage` or `sessionStorage`.
- `ApiClient` attaches `Authorization: Bearer <token>` dynamically to Fastify requests.

### 5.6 Service-Role Boundary & RLS Relationship

- Fastify interacts with Supabase using `SUPABASE_SERVICE_ROLE_KEY` exclusively on the server.
- The Fastify authorization layer serves as the primary application boundary, validating the user's Clerk token before executing database operations.
- Supabase Row Level Security (RLS) remains active as defense-in-depth, enforcing policies that permit service-role administrative operations and direct PostgREST client queries matching `auth.jwt() ->> 'sub'`.

### 5.7 CORS Configuration

- Fastify configures `@fastify/cors` restricted specifically to `CORS_ORIGIN` (defaults to `http://localhost:3000`). Wildcard origins (`*`) are prohibited.

---

## 6. Future Integration Boundaries & Security

Security and credential boundaries are strictly enforced:

```
┌────────────────────────────────────────────────────────┐
│                   apps/web (Client)                    │
│                                                        │
│  - VITE_CLERK_PUBLISHABLE_KEY                          │
│  - VITE_API_BASE_URL                                   │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / JSON API
                            ▼
┌────────────────────────────────────────────────────────┐
│                   apps/api (Backend)                   │
│                                                        │
│  - CLERK_SECRET_KEY                                    │
│  - SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY            │
│  - FREELLM_API_KEY                                     │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
                ▼                        ▼
       ┌─────────────────┐      ┌─────────────────┐
       │ Supabase (Postgres)│   │ FreeLLM API     │
       └─────────────────┘      └─────────────────┘
```

### Security Rules:

1. **Never Expose Server Secrets**:
   - `SUPABASE_SERVICE_ROLE_KEY` bypasses Row-Level Security (RLS) and must live exclusively on the backend.
   - `CLERK_SECRET_KEY` handles administrative auth actions and is server-only.
   - `FREELLM_API_KEY` controls LLM usage and billing and must remain on the backend.
2. **Client Environment Rule**:
   - Only variables prefixed with `VITE_` can be bundled into `apps/web`.
   - Any attempt to add server keys as `VITE_*` violates security policy.

---

## 7. Architectural Decisions Log (ADR)

| Decision                        | Rationale                                                                                                                     | Alternatives Considered                                         |
| :------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------- |
| **pnpm Monorepo Workspaces**    | Native workspace isolation, symlink deduplication, fast installation, deterministic locks.                                    | npm workspaces, Lerna, Turborepo                                |
| **Fastify for Backend**         | High throughput, low overhead, built-in schema compilation, first-class TypeScript support, built-in logging and request IDs. | Express (slower, unmaintained core), NestJS (heavy abstraction) |
| **Zod for Validation**          | Declarative runtime type validation, TypeScript static type inference, zero external dependencies.                            | Yup, Joi, TypeBox                                               |
| **TanStack Query for Frontend** | Industry standard for server-state caching, automatic deduplication, loading/error states without boilerplate.                | Redux Toolkit (unnecessary complexity for server state), SWR    |
| **Raw SQL Supabase Migrations** | Deterministic DDL, native PostgreSQL feature support (triggers, RLS, functions), no ORM impedance mismatch.                   | Prisma, Drizzle, TypeORM                                        |
| **Clerk as Identity Anchor**    | Complete separation of identity/auth concerns from core application state; profiles link via `clerk_user_id`.                 | Local auth tables, Supabase native auth                         |
| **Dual RLS Strategy**           | Full defense-in-depth: PostgREST client policies verify Clerk JWT `sub`, while API operates via secure service-role.          | No RLS (insecure), client-only RLS                              |
| **Server-Derived Identity**     | Fastify verifies Clerk token server-side; client cannot choose or forge its user ID.                                          | Client-supplied `userId` parameter                              |
| **On-Demand Token Fetching**    | Frontend fetches tokens via Clerk SDK without localStorage caching to mitigate XSS exposure.                                  | LocalStorage/cookie custom storage                              |
| **Strict TypeScript Policy**    | Strict null checks, `noImplicitAny`, forbidden `@ts-ignore` / `@ts-nocheck` to guarantee build-time reliability.              | Permissive TypeScript                                           |
| **No Premature Feature Code**   | Incremental progression avoids speculative technical debt or fake data.                                                       | Mocking full product UI upfront                                 |
