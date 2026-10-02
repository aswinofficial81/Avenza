import React from 'react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  ShieldCheck,
  KeyRound,
  LogIn,
  UserPlus,
  AlertCircle,
  Database,
} from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '@avenza/shared';
import { useApiClient } from './lib/api-client';

interface AppProps {
  isMissingKey?: boolean;
}

const AuthenticatedView: React.FC = () => {
  const { user } = useUser();
  const apiClient = useApiClient();

  const {
    data: authData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['authMe'],
    queryFn: () => apiClient.getMe(),
  });

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Top Header Shell */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">{APP_NAME}</h2>
            <p className="text-xs text-emerald-400 font-medium">{APP_TAGLINE}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: 'w-9 h-9 border border-emerald-500/30',
              },
            }}
          />
        </div>
      </header>

      {/* Authenticated Identity Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-2.5 text-emerald-400 font-semibold text-sm">
          <ShieldCheck className="w-5 h-5" />
          <span>Authenticated Session (Verified by Clerk)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 space-y-1">
            <span className="text-slate-400 font-medium">Clerk User</span>
            <p className="text-slate-200 font-semibold truncate">
              {user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Authenticated User'}
            </p>
            <p className="text-slate-500 text-[11px] truncate font-mono">{user?.id}</p>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 space-y-1">
            <span className="text-slate-400 font-medium">Email Address</span>
            <p className="text-slate-200 font-semibold truncate">
              {user?.primaryEmailAddress?.emailAddress || 'No primary email'}
            </p>
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Verified
            </span>
          </div>
        </div>

        {/* Backend Fastify + Supabase Profile Resolution Status */}
        <div className="border-t border-slate-800/80 pt-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Fastify API & Supabase Profile Resolution (`/api/v1/auth/me`)</span>
          </div>

          {isLoading && (
            <p className="text-xs text-slate-400 animate-pulse">
              Resolving Avenza profile via Fastify API...
            </p>
          )}

          {error && (
            <div className="rounded bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Profile Resolution Notice</p>
                <p className="text-[11px] text-rose-300/80">
                  {(error as Error).message || 'Fastify API unreachable or unauthenticated.'}
                </p>
              </div>
            </div>
          )}

          {authData?.data?.profile && (
            <div className="rounded-lg bg-emerald-950/20 border border-emerald-500/20 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-emerald-400 font-medium">
                <span>Profile Bootstrapped Successfully</span>
                <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 font-mono">
                  PostgreSQL UUID
                </span>
              </div>
              <div className="text-[11px] text-slate-400 space-y-1 font-mono">
                <p>
                  <span className="text-slate-500">profile.id:</span> {authData.data.profile.id}
                </p>
                <p>
                  <span className="text-slate-500">display_name:</span>{' '}
                  {authData.data.profile.displayName || '—'}
                </p>
                <p>
                  <span className="text-slate-500">timezone:</span>{' '}
                  {authData.data.profile.timezone || 'UTC'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Authenticated State Placeholder */}
      <div className="text-center py-4 text-xs text-slate-500">
        <p>Security & Profile Foundation Active.</p>
        <p>Domain features (Goals, Tasks, Planner) will be implemented in subsequent phases.</p>
      </div>
    </div>
  );
};

const SignedOutView: React.FC<{ isMissingKey?: boolean }> = ({ isMissingKey }) => {
  return (
    <main className="w-full max-w-xl text-center space-y-8">
      {/* Brand Icon & Name */}
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
        <Layers className="w-8 h-8" />
      </div>

      <div className="space-y-3">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-white">
          {APP_NAME}
        </h1>
        <p className="text-sm font-semibold tracking-wider text-emerald-400 uppercase">
          {APP_TAGLINE}
        </p>
        <p className="text-slate-400 text-base max-w-md mx-auto">
          A personal operating system for growth.
        </p>
      </div>

      {isMissingKey ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-left text-xs text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber-400">
            <KeyRound className="w-4 h-4" />
            <span>Clerk Configuration Notice</span>
          </div>
          <p>
            To connect live Clerk authentication, add your Publishable Key to{' '}
            <code className="bg-slate-900 px-1 py-0.5 rounded text-white">apps/web/.env</code>:
          </p>
          <pre className="bg-slate-900/80 p-2.5 rounded text-emerald-400 font-mono text-[11px] overflow-x-auto">
            VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
          </pre>
        </div>
      ) : (
        /* Sign In / Sign Up CTAs using Clerk */
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <SignInButton mode="modal">
            <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors shadow-lg shadow-emerald-950/50">
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          </SignInButton>

          <SignUpButton mode="modal">
            <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors border border-slate-700">
              <UserPlus className="w-4 h-4" />
              Get Started
            </button>
          </SignUpButton>
        </div>
      )}

      {/* Security Foundation Note */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-left space-y-2.5 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-slate-300 font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Phase 3 — Identity & Authorization Architecture</span>
        </div>
        <p>
          Clerk manages identity credentials securely. Fastify verifies tokens server-side and
          resolves internal Avenza profiles backed by Supabase PostgreSQL.
        </p>
      </div>
    </main>
  );
};

export const App: React.FC<AppProps> = ({ isMissingKey = false }) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-slate-100">
      {isMissingKey ? (
        <SignedOutView isMissingKey={true} />
      ) : (
        <>
          <SignedIn>
            <AuthenticatedView />
          </SignedIn>
          <SignedOut>
            <SignedOutView isMissingKey={false} />
          </SignedOut>
        </>
      )}

      <footer className="mt-12 text-xs text-slate-600">
        &copy; {new Date().getFullYear()} Avenza. Plan. Execute. Evolve.
      </footer>
    </div>
  );
};

export default App;
