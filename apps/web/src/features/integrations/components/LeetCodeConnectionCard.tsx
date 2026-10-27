import React, { useState } from 'react';
import type { IntegrationStatusResponseDto, IntegrationConnectionStatus, LeetCodeSyncState } from '@avenza/shared';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { ConfirmationDialog } from '../../../components/ui/ConfirmationDialog';
import { Spinner } from '../../../components/ui/Spinner';
import {
  useConnectDirectIntegration,
  useDisconnectIntegration,
  useIntegrationActivities,
  useIntegrationStatus,
  useSyncIntegration,
} from '../hooks/useIntegrations';
import { useToast } from '../../../components/ui/Toast';
import {
  RefreshCw,
  Unlink,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Clock,
  Activity,
  AlertTriangle,
  Code2,
  Trophy,
} from 'lucide-react';

export const LeetCodeIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M16.102 17.93l-2.697 2.607c-.466.467-1.111.662-1.823.662s-1.357-.195-1.824-.662l-4.332-4.363c-.467-.467-.702-1.15-.702-1.863s.235-1.357.702-1.824l4.319-4.38c.467-.467 1.125-.645 1.837-.645s1.357.195 1.823.662l2.697 2.606c.514.515 1.365.497 1.9-.038.535-.536.553-1.387.039-1.901l-2.609-2.636a5.074 5.074 0 0 0-3.693-1.528c-1.42 0-2.73.559-3.714 1.543l-4.321 4.381c-.983.984-1.542 2.294-1.542 3.714 0 1.42.559 2.73 1.542 3.714l4.334 4.364c.984.984 2.294 1.543 3.714 1.543 1.42 0 2.73-.559 3.693-1.529l2.609-2.636c.514-.514.496-1.365-.039-1.9-.535-.536-1.386-.554-1.9-.039z" />
    <path d="M10.802 13.945h8.621c.745 0 1.349-.604 1.349-1.349s-.604-1.349-1.349-1.349h-8.621c-.745 0-1.349.604-1.349 1.349s.604 1.349 1.349 1.349z" />
  </svg>
);

interface LeetCodeConnectionCardProps {
  initialData?: IntegrationStatusResponseDto;
}

export const LeetCodeConnectionCard: React.FC<LeetCodeConnectionCardProps> = () => {
  const { data: statusData, isLoading, error: statusError } = useIntegrationStatus('leetcode');
  const connectMutation = useConnectDirectIntegration();
  const syncMutation = useSyncIntegration();
  const disconnectMutation = useDisconnectIntegration();
  const { showToast } = useToast();

  const [usernameInput, setUsernameInput] = useState('');
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);

  const connection = statusData?.connection;
  const isConnected = Boolean(statusData?.connected && connection && connection.status !== 'DISCONNECTED');
  const currentStatus: IntegrationConnectionStatus = connection?.status || 'DISCONNECTED';

  // Only fetch activities if connected
  const { data: activities, isLoading: activitiesLoading } = useIntegrationActivities('leetcode', isConnected);

  const syncState = (connection?.sync_state || {}) as Partial<LeetCodeSyncState>;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = usernameInput.trim();
    if (!trimmed) {
      showToast({
        type: 'error',
        title: 'Username Required',
        message: 'Please enter your public LeetCode username.',
      });
      return;
    }

    try {
      const result = await connectMutation.mutateAsync({
        provider: 'leetcode',
        username: trimmed,
      });

      showToast({
        type: 'success',
        title: 'LeetCode Connected',
        message: `Successfully connected LeetCode profile @${result.external_username || trimmed}. Initial statistics synced.`,
      });
      setUsernameInput('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect LeetCode profile.';
      showToast({
        type: 'error',
        title: 'Connection Failed',
        message,
      });
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync('leetcode');
      showToast({
        type: 'success',
        title: 'Sync Complete',
        message: `Synchronized ${result.activities_synced} recent LeetCode solves and updated profile metrics.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to synchronize LeetCode account.';
      showToast({
        type: 'error',
        title: 'Sync Failed',
        message,
      });
    }
  };

  const handleDisconnectConfirm = async () => {
    try {
      await disconnectMutation.mutateAsync('leetcode');
      setIsDisconnectDialogOpen(false);
      showToast({
        type: 'info',
        title: 'LeetCode Disconnected',
        message: 'Your LeetCode account has been disconnected.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect LeetCode account.';
      showToast({
        type: 'error',
        title: 'Disconnect Failed',
        message,
      });
    }
  };

  const renderStatusBadge = () => {
    switch (currentStatus) {
      case 'SYNCED':
        return <Badge variant="success">Synced</Badge>;
      case 'SYNCING':
        return (
          <Badge variant="info" className="animate-pulse">
            Syncing...
          </Badge>
        );
      case 'RATE_LIMITED':
        return <Badge variant="warning">Rate Limited</Badge>;
      case 'CONNECTED':
        return <Badge variant="info">Connected</Badge>;
      case 'NEEDS_REAUTHORIZATION':
      case 'PERMISSION_ERROR':
        return <Badge variant="danger">Error</Badge>;
      default:
        return <Badge variant="secondary">Not Connected</Badge>;
    }
  };

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return 'Never';
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Spinner className="w-5 h-5 text-primary" />
          <span className="text-xs text-muted-foreground">Checking LeetCode connection status...</span>
        </div>
      </Card>
    );
  }

  if (statusError) {
    return (
      <Card className="p-4 border-danger/30 bg-danger/5">
        <div className="flex items-center gap-2 text-danger text-xs">
          <AlertCircle className="w-4 h-4" />
          <span>Failed to load LeetCode integration status.</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-surface shadow-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <LeetCodeIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-foreground">LeetCode</CardTitle>
                {renderStatusBadge()}
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Connect your public LeetCode profile to ingest solved problems, ratings, and practice signals.
              </CardDescription>
            </div>
          </div>

          {isConnected && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncMutation.isPending || currentStatus === 'SYNCING'}
                className="h-8 text-xs gap-1.5"
                title="Synchronize recent LeetCode activity"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    syncMutation.isPending || currentStatus === 'SYNCING' ? 'animate-spin' : ''
                  }`}
                />
                Sync Now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDisconnectDialogOpen(true)}
                disabled={disconnectMutation.isPending}
                className="h-8 text-xs text-muted-foreground hover:text-danger hover:bg-danger/10 gap-1.5"
              >
                <Unlink className="w-3.5 h-3.5" />
                Disconnect
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {isConnected && connection ? (
          <>
            {/* Account Details & Metainfo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg bg-surface-2/60 border border-border/40 text-xs">
              <div>
                <span className="text-muted-foreground text-[11px] block">Public Account</span>
                <div className="flex items-center gap-2 mt-1">
                  {connection.external_avatar_url ? (
                    <img
                      src={connection.external_avatar_url}
                      alt={connection.external_username || 'LeetCode avatar'}
                      className="w-5 h-5 rounded-full object-cover border border-border/60"
                    />
                  ) : (
                    <Code2 className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-foreground">
                    @{connection.external_username || connection.external_account_id}
                  </span>
                  <a
                    href={`https://leetcode.com/u/${connection.external_username || connection.external_account_id}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 ml-1"
                    title="View public profile on LeetCode"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground text-[11px] block">Last Synced</span>
                <div className="flex items-center gap-1.5 mt-1 text-foreground">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{formatTimestamp(connection.last_synced_at)}</span>
                </div>
              </div>
            </div>

            {/* Solved Statistics & Ranking Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-lg bg-surface-2/40 border border-border/30 text-center">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider block">
                  Total Solved
                </span>
                <span className="text-lg font-bold text-foreground mt-0.5 block">
                  {syncState.totalSolved ?? 0}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wider block">
                  Easy
                </span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  {syncState.easySolved ?? 0}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wider block">
                  Medium
                </span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">
                  {syncState.mediumSolved ?? 0}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20 text-center">
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium uppercase tracking-wider block">
                  Hard
                </span>
                <span className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5 block">
                  {syncState.hardSolved ?? 0}
                </span>
              </div>
            </div>

            {/* Contest Info & Global Ranking (if available) */}
            {(syncState.contestRating || syncState.ranking) && (
              <div className="flex flex-wrap items-center gap-4 px-3 py-2 rounded-lg bg-surface-2/30 border border-border/30 text-xs">
                {syncState.contestRating ? (
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-muted-foreground">Contest Rating:</span>
                    <span className="font-semibold text-foreground">{syncState.contestRating}</span>
                  </div>
                ) : null}

                {syncState.ranking ? (
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-muted-foreground">Global Rank:</span>
                    <span className="font-semibold text-foreground">
                      #{syncState.ranking.toLocaleString()}
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            {/* Sync Error Alert Banner */}
            {connection.last_error_message && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 flex items-start gap-2.5 text-xs text-danger">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Synchronization Error</div>
                  <div className="mt-0.5 text-danger/90">{connection.last_error_message}</div>
                </div>
              </div>
            )}

            {/* Non-Authoritative Privacy / Isolation Badge */}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-2/30 border border-border/30 text-[11px] text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Read-Only Isolation:</strong> Avenza accesses only public LeetCode statistics and submission metadata. External activity does not automatically complete goals or mutate skill mastery.
              </span>
            </div>

            {/* Recent Solves Preview */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Recent Accepted Submissions</span>
                <span className="text-muted-foreground text-[11px]">
                  {activities?.length ?? 0} public solves synced
                </span>
              </div>

              {activitiesLoading ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  <Spinner className="w-4 h-4 inline-block mr-2" />
                  Loading submissions...
                </div>
              ) : activities && activities.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {activities.slice(0, 5).map((act) => (
                    <div
                      key={act.id}
                      className="p-2 rounded bg-surface-2/40 border border-border/20 flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2">
                        <span className="font-medium text-foreground">{act.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-muted-foreground">
                          {formatTimestamp(act.occurred_at)}
                        </span>
                        {act.external_url && (
                          <a
                            href={act.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            title="Open problem on LeetCode"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-muted-foreground bg-surface-2/20 rounded border border-dashed border-border/40">
                  No accepted submissions synced yet. Click &quot;Sync Now&quot; to fetch your latest solves.
                </div>
              )}
            </div>
          </>
        ) : (
          /* Disconnected State with Username Input */
          <form onSubmit={handleConnect} className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label htmlFor="leetcode-username-input" className="text-xs font-medium text-foreground">
                LeetCode Username
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    id="leetcode-username-input"
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="e.g. aswinofficial81"
                    disabled={connectMutation.isPending}
                    className="w-full px-3 py-1.5 text-xs bg-surface-2 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={connectMutation.isPending || !usernameInput.trim()}
                  className="h-8 text-xs gap-1.5 shrink-0"
                >
                  {connectMutation.isPending ? (
                    <>
                      <Spinner className="w-3.5 h-3.5 text-current" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Code2 className="w-3.5 h-3.5" />
                      Connect Account
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-muted-foreground pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span>
                Public profile synchronization only. No passwords, cookies, or private credentials are ever stored or requested.
              </span>
            </div>
          </form>
        )}
      </CardContent>

      {/* Disconnect Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDisconnectDialogOpen}
        onClose={() => setIsDisconnectDialogOpen(false)}
        onConfirm={handleDisconnectConfirm}
        title="Disconnect LeetCode Account"
        message="Are you sure you want to disconnect your LeetCode account? Previously ingested activity and evidence signals will be preserved in your historical logs."
        confirmLabel="Disconnect Account"
        variant="danger"
      />
    </Card>
  );
};
