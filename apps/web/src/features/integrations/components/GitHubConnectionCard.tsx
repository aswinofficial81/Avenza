import React, { useState } from 'react';
import type { IntegrationStatusResponseDto, IntegrationConnectionStatus } from '@avenza/shared';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { ConfirmationDialog } from '../../../components/ui/ConfirmationDialog';
import { Spinner } from '../../../components/ui/Spinner';
import {
  useConnectIntegration,
  useDisconnectIntegration,
  useIntegrationActivities,
  useIntegrationRepositories,
  useIntegrationStatus,
  useSyncIntegration,
} from '../hooks/useIntegrations';
import { useToast } from '../../../components/ui/Toast';
import {
  RefreshCw,
  Unlink,
  AlertCircle,
  ExternalLink,
  GitBranch,
  ShieldCheck,
  Clock,
  Activity,
  AlertTriangle,
} from 'lucide-react';

export const GitHubIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

interface GitHubConnectionCardProps {
  initialData?: IntegrationStatusResponseDto;
}

export const GitHubConnectionCard: React.FC<GitHubConnectionCardProps> = () => {
  const { data: statusData, isLoading, error: statusError } = useIntegrationStatus('github');
  const connectMutation = useConnectIntegration();
  const syncMutation = useSyncIntegration();
  const disconnectMutation = useDisconnectIntegration();
  const { showToast } = useToast();

  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);

  const connection = statusData?.connection;
  const isConnected = Boolean(statusData?.connected && connection && connection.status !== 'DISCONNECTED');
  const currentStatus: IntegrationConnectionStatus = connection?.status || 'DISCONNECTED';

  // Only fetch repositories & activity if connected
  const { data: repos } = useIntegrationRepositories('github', isConnected);
  const { data: activities } = useIntegrationActivities('github', isConnected);

  const handleConnect = async () => {
    try {
      const redirectUrl = `${window.location.origin}/settings?provider=github`;
      const result = await connectMutation.mutateAsync({
        provider: 'github',
        redirectUrl,
      });

      if (result.authorization_url) {
        window.location.href = result.authorization_url;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initialize GitHub OAuth.';
      showToast({
        type: 'error',
        title: 'Connection Failed',
        message,
      });
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync('github');
      showToast({
        type: 'success',
        title: 'GitHub Sync Completed',
        message: `Synchronized ${result.repositories_synced} repositories and ${result.activities_synced} activities.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sync GitHub data.';
      showToast({
        type: 'error',
        title: 'Sync Failed',
        message,
      });
    }
  };

  const handleDisconnectConfirm = async () => {
    try {
      await disconnectMutation.mutateAsync('github');
      setIsDisconnectDialogOpen(false);
      showToast({
        type: 'info',
        title: 'GitHub Disconnected',
        message: 'Your GitHub account was successfully disconnected.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect GitHub.';
      showToast({
        type: 'error',
        title: 'Disconnect Failed',
        message,
      });
    }
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return 'Never';
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const renderStatusBadge = () => {
    if (connectMutation.isPending) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Spinner size="sm" className="w-2.5 h-2.5" />
          <span>Connecting...</span>
        </Badge>
      );
    }

    if (syncMutation.isPending || currentStatus === 'SYNCING') {
      return (
        <Badge variant="info" className="flex items-center gap-1">
          <Spinner size="sm" className="w-2.5 h-2.5" />
          <span>Syncing</span>
        </Badge>
      );
    }

    switch (currentStatus) {
      case 'SYNCED':
        return <Badge variant="success">Synced</Badge>;
      case 'CONNECTED':
        return <Badge variant="success">Connected</Badge>;
      case 'NEEDS_REAUTHORIZATION':
        return <Badge variant="danger">Needs Reauthorization</Badge>;
      case 'PERMISSION_ERROR':
        return <Badge variant="danger">Permission Error</Badge>;
      case 'RATE_LIMITED':
        return <Badge variant="warning">Rate Limited</Badge>;
      case 'TEMPORARILY_UNAVAILABLE':
        return <Badge variant="warning">Temporarily Unavailable</Badge>;
      case 'DISCONNECTED':
      default:
        return <Badge variant="secondary">Not Connected</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Spinner size="sm" />
          <span>Loading GitHub integration status...</span>
        </CardContent>
      </Card>
    );
  }

  if (statusError) {
    return (
      <Card>
        <CardContent className="py-4 text-xs text-rose-500 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Failed to load GitHub integration details.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center text-foreground shrink-0">
                <GitHubIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">GitHub</CardTitle>
                  {renderStatusBadge()}
                </div>
                <CardDescription className="text-xs">
                  Connect your GitHub account to sync public repositories and activity signals.
                </CardDescription>
              </div>
            </div>

            {/* Top action button */}
            <div className="flex items-center gap-2 shrink-0">
              {isConnected ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSync}
                    disabled={syncMutation.isPending || currentStatus === 'SYNCING'}
                    leftIcon={
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          syncMutation.isPending || currentStatus === 'SYNCING' ? 'animate-spin' : ''
                        }`}
                      />
                    }
                  >
                    {syncMutation.isPending || currentStatus === 'SYNCING' ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDisconnectDialogOpen(true)}
                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-border-subtle"
                    leftIcon={<Unlink className="w-3.5 h-3.5" />}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConnect}
                  disabled={connectMutation.isPending}
                  leftIcon={<GitHubIcon className="w-4 h-4" />}
                >
                  {connectMutation.isPending ? 'Connecting...' : 'Connect GitHub'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {/* Status-specific warning banners */}
          {currentStatus === 'RATE_LIMITED' && (
            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">GitHub API Rate Limit Reached</p>
                <p className="text-[11px] leading-relaxed">
                  {connection?.last_error_message ||
                    'GitHub rate limit exceeded. Sync will resume automatically after the rate limit resets.'}
                </p>
              </div>
            </div>
          )}

          {currentStatus === 'NEEDS_REAUTHORIZATION' && (
            <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Reauthorization Required</p>
                <p className="text-[11px] leading-relaxed">
                  Your GitHub authorization has expired or was revoked. Please reconnect your account.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConnect}
                  disabled={connectMutation.isPending}
                  className="mt-1"
                >
                  Reconnect Now
                </Button>
              </div>
            </div>
          )}

          {currentStatus === 'PERMISSION_ERROR' && (
            <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Permission Error</p>
                <p className="text-[11px] leading-relaxed">
                  {connection?.last_error_message ||
                    'Avenza encountered a permission error accessing your GitHub resources.'}
                </p>
              </div>
            </div>
          )}

          {currentStatus === 'TEMPORARILY_UNAVAILABLE' && (
            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">GitHub Service Temporarily Unavailable</p>
                <p className="text-[11px] leading-relaxed">
                  GitHub API returned a temporary service error. Please try syncing again shortly.
                </p>
              </div>
            </div>
          )}

          {/* Connected Details Grid */}
          {isConnected && connection && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-2 border border-border-subtle space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                  <GitHubIcon className="w-3 h-3 text-muted-foreground" />
                  Account
                </span>
                <p className="font-semibold text-foreground truncate">
                  {connection.external_username ? `@${connection.external_username}` : connection.external_account_id}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-border-subtle space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  Last Synced
                </span>
                <p className="font-semibold text-foreground truncate">
                  {formatDateTime(connection.last_synced_at)}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-border-subtle space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                  <GitBranch className="w-3 h-3 text-muted-foreground" />
                  Repositories
                </span>
                <p className="font-semibold text-foreground">
                  {repos ? repos.length : '—'}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-border-subtle space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                  <Activity className="w-3 h-3 text-muted-foreground" />
                  Activity Events
                </span>
                <p className="font-semibold text-foreground">
                  {activities ? activities.length : '—'}
                </p>
              </div>
            </div>
          )}

          {/* Security & Invariants Footnote */}
          <div className="flex items-start gap-2 pt-1 text-[11px] text-muted-foreground leading-relaxed">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground">Read-Only Isolation:</strong> Avenza accesses only public profile and repository metadata. External tokens are encrypted via AES-256-GCM and never exposed to the browser. External activity does not automatically complete Goals or Tasks.
            </p>
          </div>

          {/* Synced Repositories Preview (if any) */}
          {isConnected && repos && repos.length > 0 && (
            <div className="pt-2 border-t border-border-subtle space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Synced Repositories</span>
                <span className="text-[11px] text-muted-foreground">{repos.length} found</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {repos.slice(0, 6).map((repo) => (
                  <a
                    key={repo.id}
                    href={repo.html_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded bg-surface-2 hover:bg-surface-3 border border-border-subtle transition-colors flex items-center justify-between text-xs group"
                  >
                    <div className="space-y-0.5 truncate mr-2">
                      <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {repo.name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {repo.primary_language && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            {repo.primary_language}
                          </span>
                        )}
                        <span>{repo.is_private ? 'Private' : 'Public'}</span>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Modal */}
      <ConfirmationDialog
        isOpen={isDisconnectDialogOpen}
        onClose={() => setIsDisconnectDialogOpen(false)}
        onConfirm={handleDisconnectConfirm}
        title="Disconnect GitHub Account"
        message={
          <div className="space-y-2">
            <p>
              Are you sure you want to disconnect your GitHub account?
            </p>
            <p className="text-[11px] text-muted-foreground">
              Stored credentials will be revoked and deleted. Previously synced repositories and activities will remain in Avenza as historical signals until manually pruned.
            </p>
          </div>
        }
        confirmLabel="Disconnect"
        variant="danger"
        isLoading={disconnectMutation.isPending}
      />
    </>
  );
};
