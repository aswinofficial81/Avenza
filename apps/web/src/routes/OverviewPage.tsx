import React from 'react';
import { useUser } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Database, AlertCircle, Layers } from 'lucide-react';
import { useApiClient } from '../lib/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { APP_NAME, APP_TAGLINE } from '@avenza/shared';

export const OverviewPage: React.FC = () => {
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Overview</h1>
            <Badge variant="success">Phase 4 Active</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {APP_NAME} — {APP_TAGLINE}
          </p>
        </div>
      </div>

      {/* Security & Authentication Foundation Card (Preserved from Phase 3) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
            <ShieldCheck className="w-4 h-4" />
            <CardTitle className="text-sm">Verified Identity Session</CardTitle>
          </div>
          <CardDescription>
            Identity authenticated via Clerk. Session tokens are securely transmitted to Fastify
            API and mapped to the PostgreSQL profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-surface-2 p-3 rounded border border-border-subtle space-y-1">
              <span className="text-muted-foreground font-medium">Clerk User</span>
              <p className="text-foreground font-semibold truncate">
                {user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Authenticated User'}
              </p>
              <p className="text-muted-foreground text-[11px] truncate font-mono">{user?.id}</p>
            </div>

            <div className="bg-surface-2 p-3 rounded border border-border-subtle space-y-1">
              <span className="text-muted-foreground font-medium">Primary Email</span>
              <p className="text-foreground font-semibold truncate">
                {user?.primaryEmailAddress?.emailAddress || 'No primary email'}
              </p>
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                Verified
              </span>
            </div>
          </div>

          {/* Backend Fastify + Supabase Profile Resolution Status */}
          <div className="border-t border-border-subtle pt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Database className="w-4 h-4 text-secondary" />
              <span>Fastify API & Supabase Profile Resolution (`/api/v1/auth/me`)</span>
            </div>

            {isLoading && (
              <p className="text-xs text-muted-foreground animate-pulse font-mono">
                Resolving Avenza profile via Fastify API...
              </p>
            )}

            {error && (
              <div className="rounded bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Profile Resolution Notice</p>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">
                    {(error as Error).message || 'Fastify API unreachable or unauthenticated.'}
                  </p>
                </div>
              </div>
            )}

            {authData?.data?.profile && (
              <div className="rounded bg-emerald-500/10 border border-emerald-500/20 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 font-medium">
                  <span>Profile Bootstrapped Successfully</span>
                  <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-200 font-mono">
                    PostgreSQL UUID
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground space-y-1 font-mono">
                  <p>
                    <span className="text-foreground font-medium">profile.id:</span>{' '}
                    {authData.data.profile.id}
                  </p>
                  <p>
                    <span className="text-foreground font-medium">display_name:</span>{' '}
                    {authData.data.profile.displayName || '—'}
                  </p>
                  <p>
                    <span className="text-foreground font-medium">timezone:</span>{' '}
                    {authData.data.profile.timezone || 'UTC'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Shell & Architecture Status */}
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Layers className="w-4 h-4" />
            <CardTitle className="text-sm">Phase 4 Foundation</CardTitle>
          </div>
          <CardDescription>
            The application shell, navigation system, design tokens, and UI primitives are established.
            Domain-specific functionality (goals, tasks, focus sessions, DSA tracking, academics, career)
            will be built in their respective phases without fake mock data.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
};
