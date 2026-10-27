import React from 'react';
import type { UnifiedCalendarEvent } from '../types';
import { cn } from '../../../lib/utils';

export interface CalendarWeekViewProps {
  currentDate: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  events: UnifiedCalendarEvent[];
}

function getLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  currentDate,
  selectedDate,
  onSelectDate,
  events,
}) => {
  const todayKey = React.useMemo(() => getLocalDateKey(new Date()), []);
  const selectedKey = React.useMemo(() => getLocalDateKey(selectedDate), [selectedDate]);

  // Compute 7 days of the week starting from Sunday
  const weekDays = React.useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());

    const days: Array<{
      date: Date;
      dateKey: string;
      dayName: string;
      dayNumber: number;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = getLocalDateKey(d);

      days.push({
        date: d,
        dateKey: key,
        dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
        dayNumber: d.getDate(),
        isToday: key === todayKey,
        isSelected: key === selectedKey,
      });
    }

    return days;
  }, [currentDate, todayKey, selectedKey]);

  // Map events to dateKey
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, UnifiedCalendarEvent[]>();
    events.forEach((ev) => {
      const key = getLocalDateKey(ev.startDate);
      const list = map.get(key) || [];
      list.push(ev);
      map.set(key, list);
    });
    return map;
  }, [events]);

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {weekDays.map((day) => {
          const dayEvents = eventsByDate.get(day.dateKey) || [];

          return (
            <div
              key={day.dateKey}
              onClick={() => onSelectDate(day.date)}
              className={cn(
                'min-h-[160px] sm:min-h-[300px] p-3 flex flex-col cursor-pointer transition-colors hover:bg-surface-2/60',
                day.isSelected && 'bg-primary/5 ring-1 ring-primary ring-inset'
              )}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between sm:flex-col sm:items-start gap-1 pb-2 border-b border-border-subtle">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {day.dayName}
                </span>
                <span
                  className={cn(
                    'text-sm font-mono font-medium inline-flex items-center justify-center h-7 w-7 rounded-full',
                    day.isToday && 'bg-primary text-primary-foreground font-bold shadow-xs',
                    !day.isToday && 'text-foreground'
                  )}
                >
                  {day.dayNumber}
                </span>
              </div>

              {/* Day Events Stack */}
              <div className="flex-1 space-y-1.5 pt-2">
                {dayEvents.length > 0 ? (
                  dayEvents.map((ev) => {
                    const timeStr = ev.isAllDay
                      ? 'All day'
                      : ev.startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div
                        key={ev.id}
                        className={cn(
                          'p-1.5 rounded border text-xs space-y-0.5 transition-colors',
                          ev.color.bg,
                          ev.color.border,
                          ev.color.text
                        )}
                        title={`${ev.title} (${ev.subtitle || ev.category})`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
                          <span>{timeStr}</span>
                          <span className={cn('w-1.5 h-1.5 rounded-full', ev.color.dot)} />
                        </div>
                        <p className="font-semibold line-clamp-2 leading-snug">{ev.title}</p>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-[11px] text-muted-foreground/50 italic block pt-2">
                    No events
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
