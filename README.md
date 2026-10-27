# Avenza

> **Plan. Execute. Evolve.**  
> A personal operating system for learning, planning, and consistent progress.

Avenza is a developer and student productivity workspace that connects long-term goals to day-to-day execution. It brings goals, tasks, focus sessions, study preferences, planning, learning progress, and career preparation into one place.

## Contents

- [Overview](#overview)
- [Features](#features)
- [Technology stack](#technology-stack)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Development commands](#development-commands)
- [Deployment](#deployment)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)

## Overview

Avenza is built as a TypeScript monorepo. The React web application communicates with a Fastify API; shared contracts live in a workspace package, and Supabase PostgreSQL stores application data. Clerk handles user authentication.

**Hosted preview:** [web-five-cyan-39.vercel.app](https://web-five-cyan-39.vercel.app)  
**API health check:** [avenza-api-wc47.onrender.com/health](https://avenza-api-wc47.onrender.com/health)

The hosted preview is useful for testing. Before a public production launch, configure Clerk with a domain you own and matching production keys.

## Features

The application currently includes the following areas:

- **Overview** — a dashboard for today's activity, next best action, goals, DSA progress, upcoming work, and projects.
- **Goals and milestones** — create and track goals, target dates, priorities, lifecycle status, health, and milestone progress.
- **Tasks and Today** — organize execution, view daily tasks, and track completion.
- **Focus sessions and productivity streaks** — record focus time and surface study and consistency signals.
- **Planner** — manage task planning and review proposed or unscheduled work.
- **Study preferences** — configure study windows and daily study targets.
- **DSA tracker** — manage coding problems, topics, attempts, solved progress, and revision information.
- **Academics** — organize terms, subjects, assessments, and exams.
- **Projects and career preparation** — track project work, career applications, and interviews.
- **Evidence, analytics, and weekly review** — record supporting evidence and review progress over time.
- **Connected accounts** — integration flows for GitHub, LeetCode, Codeforces, and Google Calendar, subject to each provider's configuration.

The AI Coach is currently marked as **Coming Soon** in the application. Integration availability depends on OAuth credentials, provider permissions, and configuration.

## Technology stack

| Area | Technologies |
| --- | --- |
| Web | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Server state | TanStack Query |
| Forms and validation | React Hook Form, Zod |
| API | Node.js, Fastify, TypeScript |
| Database | Supabase PostgreSQL, SQL migrations, Row Level Security |
| Authentication | Clerk |
| Monorepo | pnpm workspaces |
| Testing | Vitest, Testing Library |
| Hosting | Vercel (web), Render (API) |

## Repository structure

```text
Avenza/
├── apps/
│   ├── web/                 # React + Vite frontend
│   └── api/                 # Fastify API
├── packages/
│   ├── shared/              # Shared types, schemas, and utilities
│   └── config/              # Shared TypeScript and formatting configuration
├── supabase/
│   ├── migrations/          # Database schema migrations
│   └── config.toml          # Supabase local development configuration
├── docs/
│   └── architecture.md      # Architecture and security decisions
├── vercel.json              # SPA fallback for client-side routes
├── pnpm-workspace.yaml
├── package.json             # Root scripts
└── README.md
```

## Getting started

### Prerequisites

- Node.js 22 or newer
- pnpm 9 or newer
- A Clerk application for sign-in
- A Supabase project (or a local Supabase instance) with Avenza's migrations applied

### 1. Clone and install

Run these commands from a terminal:

```bash
git clone https://github.com/aswinofficial81/Avenza.git
cd Avenza
pnpm install
```

### 2. Create local environment files

On Windows PowerShell:

```powershell
Copy-Item .\apps\web\.env.example .\apps\web\.env
Copy-Item .\apps\api\.env.example .\apps\api\.env
```

On macOS, Linux, or Git Bash:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

### 3. Configure the frontend

Edit `apps/web/.env`:

```dotenv
VITE_CLERK_PUBLISHABLE_KEY=pk_test_replace_with_your_clerk_publishable_key
VITE_API_BASE_URL=http://localhost:3005
```

Use the **publishable key** from your Clerk development instance for local development. The key should begin with `pk_test_`. Never use a Clerk secret key in a `VITE_` variable.

### 4. Configure the API

Edit `apps/api/.env` and replace the example values with credentials for your development environment. The most important settings are:

```dotenv
PORT=3005
HOST=::
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

CLERK_SECRET_KEY=sk_test_replace_with_your_clerk_secret_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_server_secret_key
```

Use a Clerk secret key that belongs to the **same Clerk instance** as the frontend publishable key. The Supabase URL and server key must belong to the same Supabase project. Never commit real `.env` files or share credentials in issues, screenshots, or chat.

Optional integrations can be configured when needed:

- GitHub OAuth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_REDIRECT_URI`
- Google Calendar OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`
- Integration token encryption: `INTEGRATION_TOKEN_ENCRYPTION_KEY`
- Clerk webhooks: `CLERK_WEBHOOK_SECRET`
- AI provider: `FREELLM_API_KEY`
- Account deletion recovery worker: `ENABLE_DELETION_RECOVERY_WORKER`, `DELETION_RECOVERY_INTERVAL_MS`, and `DELETION_RECOVERY_BATCH_SIZE`

For OAuth, register the exact redirect URI used by the app with the corresponding provider. Keep the integration encryption key stable after encrypted tokens have been stored. The deletion recovery worker defaults to disabled; enable it only when its operational requirements are understood.

### 5. Prepare the database

Apply the SQL migrations in `supabase/migrations/` to the Supabase project configured for the API before using data-backed features. For local Supabase development, install and use the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) with Docker. Do not run destructive database reset commands against a production project.

### 6. Start the application

From the repository root:

```bash
pnpm run dev
```

By default:

- Web app: [http://localhost:3000](http://localhost:3000)
- API health: [http://localhost:3005/health](http://localhost:3005/health)

The API's `GET /health` endpoint is public. The feature API routes use Clerk authentication.

## Environment variables

| Variable | Location | Purpose |
| --- | --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Web | Public Clerk publishable key; embedded in the browser bundle |
| `VITE_API_BASE_URL` | Web | Base URL of the API, without `/api` or `/health` |
| `CLERK_SECRET_KEY` | API | Server-side Clerk authentication |
| `CLERK_WEBHOOK_SECRET` | API | Webhook signature verification when configured |
| `SUPABASE_URL` | API | Supabase project URL |
| `SUPABASE_ANON_KEY` | API | Supabase public API key when required |
| `SUPABASE_SERVICE_ROLE_KEY` | API | Server-side Supabase key used by the API |
| `CORS_ORIGIN` | API | Allowed frontend origin(s); multiple origins may be comma-separated |
| `PORT`, `HOST`, `NODE_ENV` | API | Listener and runtime configuration |

See `apps/web/.env.example` and `apps/api/.env.example` for the full example configuration. Only public client configuration belongs in the web environment. Do not prefix server secrets with `VITE_`.

## Development commands

Run from the repository root:

| Command | Purpose |
| --- | --- |
| `pnpm run dev` | Run the web app and API concurrently |
| `pnpm run dev:web` | Start the Vite frontend |
| `pnpm run dev:api` | Start the Fastify API with watch mode |
| `pnpm run build` | Build the shared package, API, and web app |
| `pnpm run test` | Run test suites across workspaces |
| `pnpm run typecheck` | Run TypeScript checks across workspaces |
| `pnpm run lint` | Run ESLint |
| `pnpm run lint:fix` | Automatically fix supported lint issues |
| `pnpm run format` | Check formatting with Prettier |
| `pnpm run format:fix` | Format files with Prettier |

You can also run checks for one workspace:

```bash
pnpm --filter @avenza/web test
pnpm --filter @avenza/web typecheck
pnpm --filter @avenza/web build

pnpm --filter @avenza/api test
pnpm --filter @avenza/api typecheck

pnpm --filter @avenza/shared test
pnpm --filter @avenza/shared typecheck
```

## Deployment

### Web app — Vercel

Import `aswinofficial81/Avenza` into Vercel. Keep the **Root Directory** at the repository root so the web app can build the shared workspace package.

Suggested build configuration:

- **Framework preset:** Vite
- **Install command:** `pnpm install --frozen-lockfile`
- **Build command:** `pnpm --filter @avenza/shared build && pnpm --filter @avenza/web build`
- **Output directory:** `apps/web/dist`

Configure these environment variables for the Vercel Production environment:

- `VITE_API_BASE_URL`: the Render API base URL, without a path or trailing slash
- `VITE_CLERK_PUBLISHABLE_KEY`: the matching Clerk publishable key

After changing environment variables, redeploy so the frontend bundle is rebuilt. The root `vercel.json` provides a fallback for client-side routes such as `/settings` and `/goals`.

### API — Render

Create a Node web service connected to the same repository. Keep **Root Directory** blank so the workspace root and `packages/shared` are available.

**Build command**

```bash
pnpm install --frozen-lockfile && pnpm --filter @avenza/shared build && pnpm --filter @avenza/api build
```

**Start command**

```bash
pnpm --filter @avenza/api start
```

Set the health check path to `/health`. Configure the server-side environment variables in Render, including Clerk and Supabase credentials, `INTEGRATION_TOKEN_ENCRYPTION_KEY`, and `CORS_ORIGIN`. Set `CORS_ORIGIN` to the exact deployed frontend origin (scheme + hostname, no trailing slash); if multiple frontend origins are needed, separate them with commas. Let Render provide `PORT`.

### Production authentication checklist

Before inviting real users:

- Configure a domain you own for Clerk production.
- Use matching Clerk production keys (`pk_live_` on the web app and `sk_live_` on the API).
- Keep secret keys exclusively in server-side environment variables.
- Configure OAuth redirect URIs and provider allow-lists for the final domain.
- Verify CORS, health checks, sign-in, profile creation, and core API flows after deployment.
- Rotate any secret that has accidentally been placed in a client-side `VITE_` variable or committed to Git.

## Security notes

- Never commit `.env`, `.env.local`, service-role keys, Clerk secret keys, OAuth client secrets, or integration encryption keys.
- `VITE_*` values are public browser configuration. They must not contain secrets.
- Treat the API as the server-side boundary: it verifies Clerk tokens and derives the application user identity server-side.
- Keep Supabase service credentials on the API only. Do not use the service-role key in frontend code.
- Use HTTPS for hosted environments and exact CORS origin allow-lists.
- Do not enable background workers or integrations in production until their configuration and operational behavior have been checked.

## Troubleshooting

### Blank page or Clerk publishable-key error

Check that `VITE_CLERK_PUBLISHABLE_KEY` contains a publishable key (`pk_test_` for development or `pk_live_` for production), not a secret key. Redeploy Vercel after changing it.

### API reports “Invalid API key”

Verify that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are from the same Supabase project and that the server key is current. Save the variables and restart/redeploy the API.

### Browser reports a CORS error

Set `CORS_ORIGIN` on Render to match the browser's origin exactly, for example `https://your-app.vercel.app`. Do not include a URL path or trailing slash. Save and restart/redeploy the API after changing it.

### Direct navigation to a frontend route returns 404

Check that the root `vercel.json` is present and included in the deployment. It configures the SPA fallback used by React Router.

### The latest code is not visible

Check that the intended commit reached `main`, then verify that Vercel or Render deployed that commit. Environment-variable changes require a new deployment to be reflected in a frontend bundle.

## Architecture reference

For more detailed technical decisions, identity flow, database ownership model, and security boundaries, see [`docs/architecture.md`](docs/architecture.md).
