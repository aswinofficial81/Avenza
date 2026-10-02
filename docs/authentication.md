# Avenza Authentication & Authorization Guide

> **"Plan. Execute. Evolve."**  
> _Phase 3: Clerk Authentication + Fastify Authorization_

---

## 1. Executive Overview

Avenza establishes a strict, defense-in-depth identity pipeline where **Clerk** is the sole authoritative identity provider, **Fastify** is the server-side authorization enforcement gate, and **Supabase PostgreSQL** stores application-level user profiles and domain data.

```
┌─────────────────┐
│   Clerk Auth    │ (Authoritative Provider: passwords, MFA, sessions, OAuth)
└────────┬────────┘
         │ Clerk JWT (Bearer Token)
         ▼
┌─────────────────┐
│    apps/web     │ (React Frontend: obtains session token dynamically via useAuth())
└────────┬────────┘
         │ Authorization: Bearer <clerk_session_token>
         ▼
┌─────────────────┐
│    apps/api     │ (Fastify Backend: preHandler hook verifies Clerk JWT)
└────────┬────────┘
         │ Verified clerk_user_id
         ▼
┌─────────────────┐
│ Profile Service │ (Idempotent bootstrap: getOrCreateProfile)
└────────┬────────┘
         │ Resolved profiles.id (Internal UUID)
         ▼
┌─────────────────┐
│ Supabase (Pg)   │ (Profiles & user_preferences with active RLS)
└─────────────────┘
```

---

## 2. Core Security & Identity Rules

1. **Clerk is Authoritative**: All credential management, password policies, session lifetimes, social login providers, and MFA are owned by Clerk. The database stores zero passwords, sessions, or provider tokens.
2. **Never Trust Client-Supplied User IDs**: Endpoints reject or ignore any client-supplied user ID in the request body (e.g. `{ "userId": "..." }`) or custom headers. The authenticated identity is extracted solely from the cryptographic Clerk token verified by Fastify.
3. **No Tokens in LocalStorage**: The frontend uses Clerk React's `getToken()` API on demand. Session tokens are never cached in `localStorage` or `sessionStorage`.
4. **Idempotent Profile Bootstrap**: When a verified Clerk user makes their first API request, Fastify checks `public.profiles`. If missing, it creates a profile record anchored to `clerk_user_id`. Concurrent requests are safely handled via database unique constraints.
5. **Server Secrets Separation**:
   - `CLERK_SECRET_KEY`: Kept exclusively on Fastify backend.
   - `SUPABASE_SERVICE_ROLE_KEY`: Kept exclusively on Fastify backend.
   - `VITE_CLERK_PUBLISHABLE_KEY`: Client-facing publishable key only.

---

## 3. Environment Variables Configuration

### Frontend (`apps/web/.env`)

```bash
# Clerk Publishable Key (Safe for browser)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# API Backend URL
VITE_API_BASE_URL=http://localhost:3001
```

### Backend (`apps/api/.env`)

```bash
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Clerk Secret Key (Server-only secret)
CLERK_SECRET_KEY=sk_test_...

# Supabase Credentials (Server-only service role)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 4. Frontend Authentication UX & Client Usage

### 4.1 Root Provider

Clerk is mounted at the application root (`apps/web/src/main.tsx`) using `<ClerkProvider publishableKey={...}>`. If the publishable key is not set, a non-crashing setup banner is shown.

### 4.2 Signed-Out vs Signed-In State

- **Signed Out**: Renders Avenza branding, tagline, and modal Clerk CTAs (`<SignInButton>`, `<SignUpButton>`).
- **Signed In**: Renders authenticated user details (`useUser()`), Clerk's `<UserButton />`, and automatically fetches profile information from `GET /api/v1/auth/me`.

### 4.3 Authenticated API Client (`apps/web/src/lib/api-client.ts`)

```ts
import { useApiClient } from './lib/api-client';

function MyComponent() {
  const apiClient = useApiClient();

  // Requests automatically attach Authorization: Bearer <token>
  const fetchMe = async () => {
    const data = await apiClient.getMe();
    console.log(data.profile.id);
  };
}
```

---

## 5. Backend Authorization Architecture

### 5.1 Request Context

The Fastify request context is augmented with typed properties:

```ts
declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      clerkUserId: string;
      profileId: string;
    };
    profile?: ProfileRow;
  }
}
```

### 5.2 `requireAuth` Middleware

Located in [`apps/api/src/auth/auth.middleware.ts`](file:///c:/Users/ASWIN%20BABU/OneDrive/Documents/Desktop/AVENZA/apps/api/src/auth/auth.middleware.ts):

1. Verifies `Authorization: Bearer <token>`.
2. Validates token via `AuthService` (`@clerk/backend`).
3. If unauthenticated &rarr; responds with HTTP 401 using the standard API error envelope.
4. Invokes `ProfileService.getOrCreateProfile(clerkUserId, metadata)`.
5. Attaches `request.auth` and `request.profile`.

### 5.3 Protected Verification Endpoint: `GET /api/v1/auth/me`

Returns the verified identity and resolved internal profile:

```json
{
  "success": true,
  "data": {
    "clerkUserId": "user_2NN...",
    "profile": {
      "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      "clerkUserId": "user_2NN...",
      "displayName": "Aswin Babu",
      "avatarUrl": "https://img.clerk.com/...",
      "timezone": "Asia/Kolkata",
      "createdAt": "2026-10-02T12:00:00.000Z",
      "updatedAt": "2026-10-02T12:00:00.000Z"
    }
  }
}
```

### 5.4 CORS

Fastify restricts origins using `@fastify/cors` matching `CORS_ORIGIN` (defaults to `http://localhost:3000`). Wildcards (`*`) are prohibited.

---

## 6. Testing Strategy

1. **Public Routes**: `GET /health` confirmed accessible without credentials.
2. **Authentication Gate**: `GET /api/v1/auth/me` confirmed to return 401 on missing, empty, or forged bearer tokens.
3. **Identity Resolution**: Controlled Clerk client mocks simulate valid tokens and verify profile lookup and bootstrapping.
4. **Idempotency**: Repeated calls verify that existing profiles are returned without duplicate inserts.
5. **User Isolation**: Verified that User Bob cannot receive or access User Alice's profile.
6. **Frontend State**: Verified that `<App />` handles key-missing, signed-out, and signed-in states with API client token propagation.
