import React, { useState } from 'react';
import type {
  CodeforcesSyncState,
  IntegrationConnectionStatus,
  IntegrationStatusResponseDto,
} from '@avenza/shared';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import { ConfirmationDialog } from '../../../components/ui/ConfirmationDialog';
import { useToast } from '../../../components/ui/Toast';
import {
  useIntegrationStatus,
  useSyncIntegration,
  useDisconnectIntegration,
  useIntegrationActivities,
  useConnectDirectIntegration,
} from '../hooks/useIntegrations';
import {
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  Trophy,
  Flame,
  Calendar,
} from 'lucide-react';

const CodeforcesIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path fill="#4F81C7" d="M4.5 7.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-3 0V9a1.5 1.5 0 0 1 1.5-1.5z" />
    <path fill="#2E5B9A" d="M12 3a1.5 1.5 0 0 1 1.5 1.5v13.5a1.5 1.5 0 0 1-3 0V4.5A1.5 1.5 0 0 1 12 3z" />
    <path fill="#E65353" d="M19.5 12a1.5 1.5 0 0 1 1.5 1.5v4.5a1.5 1.5 0 0 1-3 0v-4.5a1.5 1.5 0 0 1 1.5-1.5z" />
  </svg>
);

interface CodeforcesConnectionCardProps {
  initialData?: IntegrationStatusResponseDto;
}

export const CodeforcesConnectionCard: React.FC<CodeforcesConnectionCardProps> = () => {
  const { data: statusData, isLoading, error: statusError } = useIntegrationStatus('codeforces');
  const connectMutation = useConnectDirectIntegration();
  const syncMutation = useSyncIntegration();
  const disconnectMutation = useDisconnectIntegration();
  const { showToast } = useToast();

  const [handleInput, setHandleInput] = useState('');
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);

  const connection = statusData?.connection;
  const isConnected = Boolean(statusData?.connected && connection && connection.status !== 'DISCONNECTED');
  const currentStatus: IntegrationConnectionStatus = connection?.status || 'DISCONNECTED';

  // Only fetch activities if connected
  const { data: activities, isLoading: activitiesLoading } = useIntegrationActivities('codeforces', isConnected);

  const syncState = (connection?.sync_state || {}) as Partial<CodeforcesSyncState>;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = handleInput.trim();
    if (!trimmed) {
      showToast({
        type: 'error',
        title: 'Handle Required',
        message: 'Please enter your public Codeforces handle.',
      });
      return;
    }

    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(trimmed)) {
      showToast({
        type: 'error',
        title: 'Invalid Handle',
        message: 'Codeforces handle must be 3-24 characters containing letters, numbers, underscores, periods, or dashes.',
      });
      return;
    }

    try {
      const result = await connectMutation.mutateAsync({
        provider: 'codeforces',
        handle: trimmed,
      });

      showToast({
        type: 'success',
        title: 'Codeforces Connected',
        message: `Successfully connected Codeforces handle @${result.external_username || trimmed}. Initial profile metrics synced.`,
      });
      setHandleInput('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect Codeforces profile.';
      showToast({
        type: 'error',
        title: 'Connection Failed',
        message,
      });
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync('codeforces');
      showToast({
        type: 'success',
        title: 'Sync Complete',
        message: `Synchronized ${result.activities_synced} recent Codeforces activities and updated ratings.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to synchronize Codeforces account.';
      showToast({
        type: 'error',
        title: 'Sync Failed',
        message,
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectMutation.mutateAsync('codeforces');
      showToast({
        type: 'success',
        title: 'Codeforces Disconnected',
        message: 'Your Codeforces account has been disconnected. Historical activities have been retained.',
      });
      setIsDisconnectDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect Codeforces integration.';
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
          <Badge variant="warning" className="flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
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
      return iso;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center items-center">
          <Spinner size="md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-surface-2 border border-border-subtle shrink-0">
                <CodeforcesIcon className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span>Codeforces</span>
                  {renderStatusBadge()}
                </CardTitle>
                <CardDescription className="text-xs">
                  Ingest competitive programming ratings, rated contest participations, and accepted solves via public handle.
                </CardDescription>
              </div>
            </div>

            {/* Top Right Action: Sync button if connected */}
            {isConnected && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncMutation.isPending || currentStatus === 'SYNCING'}
                  className="gap-1.5 text-xs h-8"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {statusError && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 rounded flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Failed to load Codeforces integration status. Please try refreshing.</span>
            </div>
          )}

          {currentStatus === 'RATE_LIMITED' && (
            <div className="p-3 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded flex items-start gap-2">
              <Clock className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Codeforces API Limit Reached: </span>
                Codeforces throttles requests strictly. Automatic backoff is active. Please wait a few minutes before syncing again.
              </div>
            </div>
          )}

          {/* CONNECTED STATE */}
          {isConnected && connection && (
            <div className="space-y-4">
              {/* Profile Details Header */}
              <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-2/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {connection.external_avatar_url ? (
                    <img
                      src={connection.external_avatar_url}
                      alt={connection.external_username || 'Codeforces Avatar'}
                      className="w-10 h-10 rounded-full border border-border object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full border border-border bg-surface-2 flex items-center justify-center font-bold text-sm text-foreground">
                      {(connection.external_username || 'CF').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground">
                        {connection.external_display_name || connection.external_username}
                      </span>
                      <a
                        href={`https://codeforces.com/profile/${connection.external_username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="View Codeforces Profile"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      @{connection.external_username}
                      {syncState.rank && ` • ${syncState.rank}`}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-muted-foreground self-start sm:self-auto">
                  <div>
                    Last synced: <span className="font-medium text-foreground">{formatTimestamp(connection.last_synced_at)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                    Connected: {formatTimestamp(connection.connected_at)}
                  </div>
                </div>
              </div>

              {/* Solved Statistics & Contest Ratings Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-md border border-border-subtle bg-surface flex flex-col">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-500" /> Current Rating
                  </span>
                  <span className="text-base font-bold font-mono text-foreground mt-0.5">
                    {syncState.rating !== undefined && syncState.rating !== null ? syncState.rating : '—'}
                  </span>
                </div>

                <div className="p-2.5 rounded-md border border-border-subtle bg-surface flex flex-col">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Award className="w-3 h-3 text-emerald-500" /> Max Rating
                  </span>
                  <span className="text-base font-bold font-mono text-foreground mt-0.5">
                    {syncState.maxRating !== undefined && syncState.maxRating !== null ? syncState.maxRating : '—'}
                  </span>
                </div>

                <div className="p-2.5 rounded-md border border-border-subtle bg-surface flex flex-col">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-sky-500" /> Rated Contests
                  </span>
                  <span className="text-base font-bold font-mono text-foreground mt-0.5">
                    {syncState.ratedContestsParticipated ?? 0}
                  </span>
                </div>

                <div className="p-2.5 rounded-md border border-border-subtle bg-surface flex flex-col">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Flame className="w-3 h-3 text-rose-500" /> Contribution
                  </span>
                  <span className="text-base font-bold font-mono text-foreground mt-0.5">
                    {syncState.contribution !== undefined ? (syncState.contribution >= 0 ? `+${syncState.contribution}` : syncState.contribution) : '0'}
                  </span>
                </div>
              </div>

              {/* Latest Rated Contest Card if available */}
              {syncState.lastContestName && (
                <div className="p-2.5 rounded border border-border-subtle bg-surface text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-muted-foreground">Latest Rated Contest:</span>
                    <span className="font-medium text-foreground truncate">{syncState.lastContestName}</span>
                  </div>
                  {syncState.lastContestRank && (
                    <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                      Rank #{syncState.lastContestRank}
                    </Badge>
                  )}
                </div>
              )}

              {/* Recent Activities Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Ingested Activities & Solves
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {activities ? `${activities.length} activities` : 'Loading...'}
                  </span>
                </div>

                {activitiesLoading ? (
                  <div className="p-4 flex justify-center">
                    <Spinner size="sm" />
                  </div>
                ) : activities && activities.length > 0 ? (
                  <div className="border border-border-subtle rounded-md divide-y divide-border-subtle max-h-48 overflow-y-auto bg-surface">
                    {activities.slice(0, 10).map((act) => (
                      <div key={act.id} className="p-2.5 text-xs flex items-center justify-between hover:bg-surface-2 transition-colors">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          {act.activity_type === 'contest_participation' ? (
                            <Badge variant="info" className="text-[10px] shrink-0">Contest</Badge>
                          ) : (
                            <Badge variant="success" className="text-[10px] shrink-0">Solved</Badge>
                          )}
                          <span className="font-medium text-foreground truncate">{act.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(act.occurred_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                          {act.external_url && (
                            <a
                              href={act.external_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic p-2 border border-dashed border-border-subtle rounded">
                    No recent Codeforces activities ingested yet. Click &quot;Sync Now&quot; to ingest your latest accepted submissions and contest ratings.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* DISCONNECTED STATE (Connect Form) */}
          {!isConnected && (
            <div className="space-y-3.5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect your public Codeforces profile by entering your handle. Avenza will query public statistics, rated contests, and accepted solutions. No passwords, tokens, or cookies are ever required.
              </p>

              <form onSubmit={handleConnect} className="flex flex-col sm:flex-row gap-2 max-w-md">
                <div className="flex-1">
                  <Input
                    placeholder="e.g. tourist"
                    value={handleInput}
                    onChange={(e) => setHandleInput(e.target.value)}
                    disabled={connectMutation.isPending}
                    className="h-8 text-xs font-mono"
                    aria-label="Codeforces Handle"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={connectMutation.isPending || !handleInput.trim()}
                  className="gap-1.5 text-xs h-8 whitespace-nowrap"
                >
                  {connectMutation.isPending ? <Spinner size="sm" /> : <CodeforcesIcon className="w-3.5 h-3.5" />}
                  {connectMutation.isPending ? 'Verifying...' : 'Connect Account'}
                </Button>
              </form>
            </div>
          )}
        </CardContent>

        {/* Card Footer: Disconnect Option */}
        {isConnected && (
          <CardFooter className="pt-2 border-t border-border-subtle flex justify-between items-center text-xs">
            <span className="text-[11px] text-muted-foreground">
              Observational evidence only. Does not alter DSA problem mastery or skill levels.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDisconnectDialogOpen(true)}
              className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 h-7"
            >
              Disconnect
            </Button>
          </CardFooter>
        )}
      </Card>

      <ConfirmationDialog
        isOpen={isDisconnectDialogOpen}
        onClose={() => setIsDisconnectDialogOpen(false)}
        onConfirm={handleDisconnect}
        title="Disconnect Codeforces Account"
        message="Are you sure you want to disconnect your Codeforces account? Existing synchronized activities and evidence will remain in Avenza, but no new activities will be ingested."
        confirmLabel="Disconnect Codeforces"
        variant="danger"
        isLoading={disconnectMutation.isPending}
      />
    </>
  );
};
