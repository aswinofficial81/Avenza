# Avenza

> **Plan. Execute. Evolve.**  
> _A personal operating system for growth._

---

## 🌟 Overview

Avenza is a personal operating system designed to facilitate continuous personal and professional growth. This repository contains the monorepo foundation for both the web frontend and API backend.

---

## 🏗️ Repository Architecture

The monorepo is structured with workspace packages:

```
Avenza/
├── apps/
│   ├── web/                # Frontend application (React, Vite, Tailwind CSS, TanStack Query)
│   └── api/                # Backend API service (Node.js, Fastify, Zod)
│
├── packages/
│   ├── shared/             # Shared TypeScript types, schemas, and brand constants
│   └── config/             # Shared configs (TypeScript, Prettier)
│
├── supabase/
│   └── migrations/         # Supabase PostgreSQL migrations (planned for future phase)
│
├── docs/
│   └── architecture.md     # In-depth architectural blueprint and decisions
│
├── .env.example            # Safe global environment templates
├── .gitignore              # Git ignore rules ensuring zero committed secrets
├── pnpm-workspace.yaml     # pnpm workspace configuration
├── tsconfig.json           # Root TypeScript configuration
└── package.json            # Root workspace scripts and dev dependencies
```

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended, v22 supported)
- [pnpm](https://pnpm.io/) (v9+)

### Installation

```bash
# Install dependencies across all workspaces
pnpm install
```

### Environment Configuration

Copy the example environment files:

```bash
# Frontend
cp apps/web/.env.example apps/web/.env

# Backend
cp apps/api/.env.example apps/api/.env
```

---

## 🛠️ Available Scripts

Run from the monorepo root:

| Command               | Description                                               |
| :-------------------- | :-------------------------------------------------------- |
| `pnpm run dev`        | Runs both `apps/web` and `apps/api` concurrently          |
| `pnpm run dev:web`    | Starts the React/Vite development server                  |
| `pnpm run dev:api`    | Starts the Fastify API server with hot-reload             |
| `pnpm run build`      | Builds `@avenza/shared`, `@avenza/api`, and `@avenza/web` |
| `pnpm run test`       | Executes all Vitest test suites across the monorepo       |
| `pnpm run typecheck`  | Runs TypeScript strict typechecks across all projects     |
| `pnpm run lint`       | Runs ESLint 9 checks                                      |
| `pnpm run lint:fix`   | Fixes linting errors automatically                        |
| `pnpm run format`     | Checks code formatting with Prettier                      |
| `pnpm run format:fix` | Formats all code with Prettier                            |

---

## 🛡️ Foundational Principles

- **Zero Mock / Fake Data**: Phase 1 provides clean infrastructure only.
- **Strict Separation of Concerns**: Frontend and backend are completely decoupled.
- **Strict Type Safety**: TypeScript strict mode enabled with `noImplicitAny` and strict null checks.
- **Secure by Default**: Strict credential boundary. Server-side keys (Supabase Service Role, Clerk Secret, FreeLLM) are strictly forbidden from client bundles.
