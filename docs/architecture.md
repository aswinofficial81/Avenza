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

## 4. Planned Database & Supabase Location

- **Database Engine**: Supabase PostgreSQL.
- **Directory**: `supabase/migrations/`
  - All database DDL, schema definitions, and migration scripts will be placed here in future phases.
  - No foreign ORM (e.g. Prisma, TypeORM) or alternative database (e.g. MongoDB, Firebase) will be introduced.
- **Current State**: Phase 1 reserves the directory with a `.gitkeep` placeholder. Database connectivity will be introduced in subsequent phases.

---

## 5. Future Integration Boundaries & Security

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

## 6. Architectural Decisions Log (ADR)

| Decision                        | Rationale                                                                                                                     | Alternatives Considered                                         |
| :------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------- |
| **pnpm Monorepo Workspaces**    | Native workspace isolation, symlink deduplication, fast installation, deterministic locks.                                    | npm workspaces, Lerna, Turborepo                                |
| **Fastify for Backend**         | High throughput, low overhead, built-in schema compilation, first-class TypeScript support, built-in logging and request IDs. | Express (slower, unmaintained core), NestJS (heavy abstraction) |
| **Zod for Validation**          | Declarative runtime type validation, TypeScript static type inference, zero external dependencies.                            | Yup, Joi, TypeBox                                               |
| **TanStack Query for Frontend** | Industry standard for server-state caching, automatic deduplication, loading/error states without boilerplate.                | Redux Toolkit (unnecessary complexity for server state), SWR    |
| **Strict TypeScript Policy**    | Strict null checks, `noImplicitAny`, forbidden `@ts-ignore` / `@ts-nocheck` to guarantee build-time reliability.              | Permissive TypeScript                                           |
| **No Premature Feature Code**   | Phase 1 focuses exclusively on clean infrastructure, preventing technical debt from placeholder or mock data.                 | Mocking full product UI upfront                                 |
