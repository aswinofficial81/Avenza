import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, RefreshCw, ExternalLink, CheckCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import type { IntegrationStatusResponseDto } from '@avenza/shared';

export interface GoogleCalendarBannerProps {
  isConnected: boolean;
  isSyncing: boolean;
  onSync: () => void;
  statusData?: IntegrationStatusResponseDto;
}

export const GoogleCalendarBanner: React.FC<GoogleCalendarBannerProps> = ({
  isConnected,
  isSyncing,
  onSync,
  statusData,
}) => {
  if (isConnected) {
    const email = statusData?.connection?.external_email;
    const updatedAt = statusData?.connection?.updated_at;

    return (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 px-4 rounded-lg bg-surface-2 border border-border-subtle text-xs">
        <div className="flex items-center gap-2.5">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">Google Calendar Active</span>
            {email && (
              <span className="text-muted-foreground font-mono text-[11px] truncate">
                ({email})
              </span>
            )}
            <Badge variant="info" size="sm">
              Read-Only
            </Badge>
            {updatedAt && (
              <span className="text-[11px] text-muted-foreground">
                • Last synced {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={isSyncing}
            className="text-xs h-7 gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </Button>
          <Link to="/settings">
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
              Settings
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 px-4 rounded-lg bg-surface border border-dashed border-border text-xs">
      <div className="flex items-center gap-2.5">
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
        <div>
          <span className="font-semibold text-foreground">Connect Google Calendar</span>
          <p className="text-muted-foreground text-[11px]">
            Sync external events and busy times into your unified schedule. External events remain strictly read-only.
          </p>
        </div>
      </div>

      <Link to="/settings" className="shrink-0">
        <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5">
          <span>Connect in Settings</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </Link>
    </div>
  );
};
