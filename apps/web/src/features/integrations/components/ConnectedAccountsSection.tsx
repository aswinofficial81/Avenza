import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { GitHubConnectionCard } from './GitHubConnectionCard';
import { LeetCodeConnectionCard } from './LeetCodeConnectionCard';
import { CodeforcesConnectionCard } from './CodeforcesConnectionCard';
import { GoogleCalendarConnectionCard } from './GoogleCalendarConnectionCard';
import { useProcessOAuthCallback } from '../hooks/useIntegrations';
import { useToast } from '../../../components/ui/Toast';
import { Link2, Code2 } from 'lucide-react';
import type { IntegrationProvider } from '@avenza/shared';

export const ConnectedAccountsSection: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const processCallback = useProcessOAuthCallback();
  const { showToast } = useToast();
  const processedRef = useRef(false);

  // Handle incoming OAuth callback query params: ?code=...&state=...
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      showToast({
        type: 'error',
        title: 'OAuth Authorization Cancelled or Denied',
        message: errorDescription || error,
      });
      // Clean up search params
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('code');
      newParams.delete('state');
      newParams.delete('error');
      newParams.delete('error_description');
      newParams.delete('provider');
      setSearchParams(newParams, { replace: true });
      return;
    }

    if (code && state && !processedRef.current) {
      processedRef.current = true;
      const providerParam = searchParams.get('provider');
      const provider: IntegrationProvider =
        providerParam === 'google_calendar' ? 'google_calendar' : 'github';

      processCallback
        .mutateAsync({
          provider,
          code,
          state,
        })
        .then((connection) => {
          const providerName = provider === 'google_calendar' ? 'Google Calendar' : 'GitHub';
          showToast({
            type: 'success',
            title: `${providerName} Connected`,
            message: `Successfully connected ${providerName} account ${
              connection.external_username ? `@${connection.external_username}` : ''
            }. Initial sync scheduled.`,
          });
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Failed to finalize OAuth authorization.';
          showToast({
            type: 'error',
            title: 'Connection Error',
            message,
          });
        })
        .finally(() => {
          // Clean up search params from URL
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('code');
          newParams.delete('state');
          newParams.delete('provider');
          setSearchParams(newParams, { replace: true });
        });
    }
  }, [searchParams, setSearchParams, processCallback, showToast]);

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Connected Accounts</h2>
        <Badge variant="info">Phase 14</Badge>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Connect external accounts to ingest activity and project signals into Avenza. External platforms are never authoritative for your Goals, Tasks, or Skills.
      </p>

      {/* GitHub Integration Card */}
      <GitHubConnectionCard />

      {/* LeetCode Integration Card */}
      <LeetCodeConnectionCard />

      {/* Codeforces Integration Card */}
      <CodeforcesConnectionCard />

      {/* Google Calendar Integration Card */}
      <GoogleCalendarConnectionCard />

      {/* Future Providers Preview (Disabled/Upcoming) */}
      <Card className="opacity-70 bg-surface-2/40 border-dashed">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-xs">Competitive Programming Platforms</CardTitle>
            </div>
            <Badge variant="secondary">Planned</Badge>
          </div>
          <CardDescription className="text-[11px]">
            Future adapters for CodeChef, AtCoder, and HackerRank will be introduced in subsequent phases following reference verification.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
};
