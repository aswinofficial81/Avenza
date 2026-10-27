import React from 'react';
import { Calendar as CalendarIcon, Clock, ExternalLink, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { UnifiedCalendarEvent, EventCategory } from '../types';
import { cn } from '../../../lib/utils';

export interface CalendarAgendaViewProps {
  events: UnifiedCalendarEvent[];
  onSelectDate?: (date: Date) => void;
}

function getLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCategoryLabel(category: EventCategory): string {
  switch (category) {
    case 'external':
      return 'Google Calendar';
    case 'task':
      return 'Task';
    case 'academics':
      return 'Academics';
    case 'career':
      return 'Career';
    default:
      return category;
  }
}

function formatDayHeader(date: Date): { dayLabel: string; dateLabel: string; isToday: boolean } {
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  let dayLabel = date.toLocaleDateString(undefined, { weekday: 'long' });
  if (isToday) dayLabel = 'Today';
  else if (isTomorrow) dayLabel = 'Tomorrow';

  const dateLabel = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return { dayLabel, dateLabel, isToday };
}

function formatTime(d: Date): string {
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const CalendarAgendaView: React.FC<CalendarAgendaViewProps> = ({
  events,
  onSelectDate,
}) => {
  // Group events by dateKey
  const groupedEvents = React.useMemo(() => {
    const groups: Map<string, { date: Date; items: UnifiedCalendarEvent[] }> = new Map();

    const sorted = [...events].sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    );

    for (const ev of sorted) {
      if (isNaN(ev.startDate.getTime())) continue;
      const key = getLocalDateKey(ev.startDate);
      if (!groups.has(key)) {
        groups.set(key, { date: ev.startDate, items: [] });
      }
      groups.get(key)!.items.push(ev);
    }

    return Array.from(groups.values());
  }, [events]);

  if (groupedEvents.length === 0) {
    return (
      <div
        data-testid="calendar-agenda-view"
        className="rounded-lg border border-border bg-card p-12 text-center shadow-sm"
      >
        <CalendarIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-foreground">No scheduled events in this period</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Tasks with due dates, exams, interviews, and connected Google Calendar events will appear here in chronological order.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="calendar-agenda-view" className="space-y-4">
      {groupedEvents.map(({ date, items }) => {
        const { dayLabel, dateLabel, isToday } = formatDayHeader(date);

        return (
          <div
            key={getLocalDateKey(date)}
            className="rounded-lg border border-border bg-card p-4 shadow-sm transition-all"
          >
            <div
              className={cn(
                'flex items-center justify-between pb-3 mb-3 border-b border-border',
                onSelectDate && 'cursor-pointer hover:opacity-80'
              )}
              onClick={() => onSelectDate?.(date)}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isToday ? 'text-primary' : 'text-foreground'
                  )}
                >
                  {dayLabel}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {dateLabel}
                </span>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {items.length} event{items.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="space-y-2">
              {items.map((event) => {
                const startTimeStr = formatTime(event.startDate);
                const endTimeStr = event.endDate ? formatTime(event.endDate) : null;
                const timeRange = event.isAllDay
                  ? 'All day'
                  : endTimeStr && endTimeStr !== startTimeStr
                    ? `${startTimeStr} – ${endTimeStr}`
                    : startTimeStr;

                return (
                  <div
                    key={event.id}
                    className={cn(
                      'flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors',
                      event.color.bg,
                      event.color.border,
                      'hover:opacity-95'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 bg-surface border border-border-subtle', event.color.text)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', event.color.dot)} />
                          {getCategoryLabel(event.category)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-muted-foreground/70" />
                          {timeRange}
                        </span>
                        {event.isBusy && (
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20">
                            Busy
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                      {event.subtitle && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.subtitle}</p>
                      )}
                    </div>

                    {event.externalUrl ? (
                      <a
                        href={event.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary p-2 rounded-lg hover:bg-surface transition-colors"
                        title={event.category === 'external' ? 'Open in Google Calendar' : 'Open Link'}
                        aria-label="Open external link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : event.link ? (
                      <Link
                        to={event.link}
                        className="text-muted-foreground hover:text-primary p-2 rounded-lg hover:bg-surface transition-colors"
                        title="View details in Avenza"
                        aria-label="View details in Avenza"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
