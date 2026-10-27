import React from 'react';
import { ExternalLink, Calendar as CalendarIcon, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { UnifiedCalendarEvent, EventCategory } from '../types';
import { cn } from '../../../lib/utils';

export interface CalendarDayAgendaProps {
  selectedDate: Date;
  events: UnifiedCalendarEvent[];
  className?: string;
}

function getLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(d: Date): string {
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
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

function getDayTitle(date: Date): string {
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const formatted = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return isToday ? `Today — ${formatted}` : formatted;
}

export const CalendarDayAgenda: React.FC<CalendarDayAgendaProps> = ({
  selectedDate,
  events,
  className,
}) => {
  const targetKey = getLocalDateKey(selectedDate);

  const dayEvents = React.useMemo(() => {
    return events
      .filter((e) => getLocalDateKey(e.startDate) === targetKey)
      .sort((a, b) => {
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
        return a.startDate.getTime() - b.startDate.getTime();
      });
  }, [events, targetKey]);

  return (
    <div
      data-testid="calendar-day-agenda"
      className={cn('rounded-lg border border-border bg-card p-4 sm:p-5 flex flex-col shadow-sm', className)}
    >
      <div className="flex items-center justify-between pb-3.5 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{getDayTitle(selectedDate)}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {dayEvents.length === 0
              ? 'No scheduled events or deadlines'
              : `${dayEvents.length} item${dayEvents.length === 1 ? '' : 's'} scheduled`}
          </p>
        </div>
        <div className="p-1.5 rounded-md bg-surface-2 text-muted-foreground">
          <CalendarIcon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3.5 flex-1 overflow-y-auto space-y-2.5">
        {dayEvents.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-lg border border-dashed border-border-subtle bg-surface/30">
            <Clock className="w-7 h-7 text-muted-foreground/60 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">Nothing on your schedule</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              No tasks due, classes, exams, interviews, or Google Calendar meetings recorded for this day.
            </p>
            <div className="mt-3.5 flex items-center justify-center gap-3">
              <Link
                to="/tasks"
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                Plan tasks <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ) : (
          dayEvents.map((event) => {
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
                data-testid={`agenda-event-${event.id}`}
                className={cn(
                  'rounded-lg p-3 border transition-colors',
                  event.color.bg,
                  event.color.border,
                  'hover:opacity-95'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 bg-surface border border-border-subtle', event.color.text)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', event.color.dot)} />
                        {getCategoryLabel(event.category)}
                      </span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-muted-foreground/70" />
                        {timeRange}
                      </span>
                      {event.isBusy && (
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20">
                          Busy
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-foreground break-words">{event.title}</h4>
                    {event.subtitle && (
                      <p className="text-xs text-muted-foreground mt-0.5">{event.subtitle}</p>
                    )}
                  </div>

                  {event.externalUrl ? (
                    <a
                      href={event.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary p-1.5 rounded-md hover:bg-surface transition-colors"
                      title={event.category === 'external' ? 'Open in Google Calendar' : 'Open Link'}
                      aria-label="Open external link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : event.link ? (
                    <Link
                      to={event.link}
                      className="text-muted-foreground hover:text-primary p-1.5 rounded-md hover:bg-surface transition-colors"
                      title="View details in Avenza"
                      aria-label="View details in Avenza"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
