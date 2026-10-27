import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { CalendarViewMode } from '../types';

export interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  viewMode,
  onViewModeChange,
  onPrev,
  onNext,
  onToday,
  onRefresh,
  isRefreshing,
}) => {
  // Format period title based on viewMode
  const periodTitle = React.useMemo(() => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    }

    if (viewMode === 'week') {
      // Find start and end of week (Sunday to Saturday)
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const startMonth = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const endMonth = end.toLocaleDateString(undefined, {
        month: start.getMonth() === end.getMonth() ? undefined : 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${startMonth} – ${endMonth}`;
    }

    // Agenda view
    return currentDate.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }, [currentDate, viewMode]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border-subtle">
      {/* Title & Period */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">Calendar</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Unified schedule, work sessions, and cross-domain deadlines
        </p>
      </div>

      {/* Period Navigation & View Mode */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center bg-surface-2 p-0.5 rounded-lg border border-border-subtle">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrev}
            aria-label="Previous period"
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToday}
            className="text-xs font-semibold px-2.5 h-7"
          >
            Today
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onNext}
            aria-label="Next period"
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <span className="text-sm font-semibold text-foreground font-mono min-w-[140px] text-center">
          {periodTitle}
        </span>

        {/* View Switcher */}
        <div className="flex items-center bg-surface-2 p-0.5 rounded-lg border border-border-subtle text-xs">
          <button
            type="button"
            onClick={() => onViewModeChange('month')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              viewMode === 'month'
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('week')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              viewMode === 'week'
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('agenda')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              viewMode === 'agenda'
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Agenda
          </button>
        </div>

        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh calendar events"
            className="h-8 px-2.5 text-xs gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
        )}
      </div>
    </div>
  );
};
