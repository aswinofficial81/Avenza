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
  useIntegrationCalendarEvents,
  useIntegrationStatus,
  useSyncIntegration,
} from '../hooks/useIntegrations';
import { useToast } from '../../../components/ui/Toast';
import {
  RefreshCw,
  Unlink,
  AlertCircle,
  ExternalLink,
  Calendar,
  ShieldCheck,
  Clock,
  Globe,
  Mail,
  AlertTriangle,
  CalendarCheck,
} from 'lucide-react';

export const GoogleCalendarIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
    <path
      d="M19 4H18V2H16V4H8V2H6V4H5C3.89 4 3 4.9 3 6V20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V9H19V20ZM7 11H12V16H7V11Z"
      fill="currentColor"
    />
  </svg>
);

interface GoogleCalendarConnectionCardProps {
  initialData?: IntegrationStatusResponseDto;
}

export const GoogleCalendarConnectionCard: React.FC<GoogleCalendarConnectionCardProps> = () => {
  const { data: statusData, isLoading, error: statusError } = useIntegrationStatus('google_calendar');
  const connectMutation = useConnectIntegration();
  const syncMutation = useSyncIntegration();
  const disconnectMutation = useDisconnectIntegration();
  const { showToast } = useToast();

  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);

  const connection = statusData?.connection;
  const isConnected = Boolean(statusData?.connected && connection && connection.status !== 'DISCONNECTED');
  const currentStatus: IntegrationConnectionStatus = connection?.status || 'DISCONNECTED';

  // Only fetch calendar events if connected
  const { data: events } = useIntegrationCalendarEvents('google_calendar', isConnected);

  const handleConnect = async () => {
    try {
      const redirectUrl = `${window.location.origin}/settings?provider=google_calendar`;
      const result = await connectMutation.mutateAsync({
        provider: 'google_calendar',
        redirectUrl,
      });

      if (result.authorization_url) {
        window.location.href = result.authorization_url;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initialize Google Calendar OAuth.';
      showToast({
        type: 'error',
        title: 'Connection Failed',
        message,
      });
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync('google_calendar');
      const count = result.events_synced ?? 0;
      showToast({
        type: 'success',
        title: 'Google Calendar Sync Completed',
        message: `Synchronized ${count} calendar events.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sync Google Calendar data.';
      showToast({
        type: 'error',
        title: 'Sync Failed',
        message,
      });
    }
  };

  const handleDisconnectConfirm = async () => {
    try {
      await disconnectMutation.mutateAsync('google_calendar');
      setIsDisconnectDialogOpen(false);
      showToast({
        type: 'info',
        title: 'Google Calendar Disconnected',
        message: 'Your Google Calendar account was successfully disconnected and its events cleared.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect Google Calendar.';
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
          <span>Loading Google Calendar integration status...</span>
        </CardContent>
      </Card>
    );
  }

  if (statusError) {
    return (
      <Card>
        <CardContent className="py-4 text-xs text-rose-500 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Failed to load Google Calendar integration details.</span>
        </CardContent>
      </Card>
    );
  }

  const syncState = connection?.sync_state as {
    primaryCalendarId?: string;
    primaryCalendarTimeZone?: string;
    calendars?: Array<{ id: string; summary: string; timeZone: string; primary: boolean }>;
  } | null;

  const primaryCalendar = syncState?.calendars?.find((c) => c.primary) || syncState?.calendars?.[0];
  const primaryCalendarName = primaryCalendar?.summary || 'Primary Calendar';
  const timeZone = syncState?.primaryCalendarTimeZone || primaryCalendar?.timeZone || 'UTC';
  const email = connection?.external_email || connection?.external_username || connection?.external_account_id;
  const avatarUrl = connection?.external_avatar_url;

  // Active / upcoming events
  const now = new Date();
  const upcomingEvents = events?.filter((e) => new Date(e.end_time) >= now && e.status !== 'cancelled') || [];

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center text-primary shrink-0">
                <GoogleCalendarIcon className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">Google Calendar</CardTitle>
                  {renderStatusBadge()}
                </div>
                <CardDescription className="text-xs">
                  Connect your Google Calendar to allow Avenza to understand your schedule and provide intelligent planning context.
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
                  leftIcon={<GoogleCalendarIcon className="w-4 h-4 text-white" />}
                >
                  {connectMutation.isPending ? 'Redirecting to Google...' : 'Connect Google Calendar'}
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
                <p className="font-semibold">Google API Rate Limit Reached</p>
                <p className="text-[11px] leading-relaxed">
                  {connection?.last_error_message ||
                    'Google Calendar API rate limit reached. Synchronization will resume shortly.'}
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
                  Your Google Calendar authorization has expired or was revoked. Please reconnect your account.
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
                    'Avenza encountered a permission error accessing your Google Calendar.'}
                </p>
              </div>
            </div>
          )}

          {currentStatus === 'TEMPORARILY_UNAVAILABLE' && (
            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Google Calendar Service Temporarily Unavailable</p>
                <p className="text-[11px] leading-relaxed">
                  Google Calendar API returned a temporary error. Please try syncing again shortly.
                </p>
              </div>
            </div>
          )}

          {/* Connected Details Grid */}
          {isConnected && connection && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-2 border border-border-subtle space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                  <Mail className="w-3 h-3 text-muted-foreground" />
                  Google Account
                </span>
                <div className="flex items-center gap-2">
                  {avatarUrl && (
                    <img
                      src={avatarUrl}
                      alt="Google Avatar"
                      className="w-4 h-4 rounded-full object-cover shrink-0"
                    />
                  )}
                  <p className="font-semibold text-foreground truncate" title={email || undefined}>
                    {email || 'Connected'}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-border-subtle space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  Primary Calendar
                </span>
                <p className="font-semibold text-foreground truncate" title={primaryCalendarName}>
                  {primaryCalendarName}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-border-subtle space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                  <Globe className="w-3 h-3 text-muted-foreground" />
                  Timezone
                </span>
                <p className="font-semibold text-foreground truncate" title={timeZone}>
                  {timeZone}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-border-subtle space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                  <CalendarCheck className="w-3 h-3 text-muted-foreground" />
                  Upcoming Events
                </span>
                <p className="font-semibold text-foreground">
                  {events ? upcomingEvents.length : '—'}
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
            </div>
          )}

          {/* Security & Invariants Footnote */}
          <div className="flex items-start gap-2 pt-1 text-[11px] text-muted-foreground leading-relaxed">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground">Read-Only Scheduling Context:</strong> Avenza accesses your calendar in read-only mode to provide schedule awareness for planning. Calendar events are external scheduling constraints and never create DSA/mastery evidence, complete tasks, or modify goals.
            </p>
          </div>

          {/* Synced Events Preview (if any) */}
          {isConnected && upcomingEvents.length > 0 && (
            <div className="pt-2 border-t border-border-subtle space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Upcoming Schedule Preview</span>
                <span className="text-[11px] text-muted-foreground">{upcomingEvents.length} events scheduled</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {upcomingEvents.slice(0, 6).map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2.5 rounded bg-surface-2 border border-border-subtle flex items-center justify-between text-xs group"
                  >
                    <div className="space-y-0.5 truncate mr-2">
                      <p className="font-medium text-foreground truncate">
                        {evt.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{formatDateTime(evt.start_time)}</span>
                        <span>•</span>
                        <span>{evt.is_busy ? 'Busy' : 'Free'}</span>
                        {evt.is_recurring && <span>• Recurring</span>}
                      </div>
                    </div>
                    {evt.html_link && (
                      <a
                        href={evt.html_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground shrink-0 p-1"
                        aria-label="View on Google Calendar"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
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
        title="Disconnect Google Calendar"
        message={
          <div className="space-y-2">
            <p>
              Are you sure you want to disconnect your Google Calendar?
            </p>
            <p className="text-[11px] text-muted-foreground">
              Stored credentials will be revoked and deleted. Synced calendar events will be cleared from Avenza. Your goals, tasks, DSA, and skills will remain unaffected.
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
