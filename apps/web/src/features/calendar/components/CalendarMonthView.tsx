import React from 'react';
import type { UnifiedCalendarEvent } from '../types';
import { cn } from '../../../lib/utils';

export interface CalendarMonthViewProps {
  currentDate: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  events: UnifiedCalendarEvent[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  currentDate,
  selectedDate,
  onSelectDate,
  events,
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const todayKey = React.useMemo(() => getLocalDateKey(new Date()), []);
  const selectedKey = React.useMemo(() => getLocalDateKey(selectedDate), [selectedDate]);

  // Compute 35-42 calendar days
  const calendarCells = React.useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: Array<{
      date: Date;
      dateKey: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    // Leading days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const key = getLocalDateKey(d);
      cells.push({
        date: d,
        dateKey: key,
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: key === todayKey,
        isSelected: key === selectedKey,
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const key = getLocalDateKey(dateObj);
      cells.push({
        date: dateObj,
        dateKey: key,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: key === todayKey,
        isSelected: key === selectedKey,
      });
    }

    // Trailing days to complete weeks (multiple of 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const dateObj = new Date(year, month + 1, d);
      const key = getLocalDateKey(dateObj);
      cells.push({
        date: dateObj,
        dateKey: key,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: key === todayKey,
        isSelected: key === selectedKey,
      });
    }

    return cells;
  }, [year, month, todayKey, selectedKey]);

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
      {/* Weekday Column Headers */}
      <div className="grid grid-cols-7 border-b border-border bg-surface-2 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2 select-none">
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border-subtle bg-surface/30">
        {calendarCells.map((cell) => {
          const dayEvents = eventsByDate.get(cell.dateKey) || [];
          const hasEvents = dayEvents.length > 0;

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => onSelectDate(cell.date)}
              className={cn(
                'min-h-[80px] sm:min-h-[105px] p-1.5 sm:p-2 text-left flex flex-col justify-between transition-colors focus:outline-none focus:ring-1 focus:ring-primary',
                cell.isCurrentMonth ? 'bg-surface' : 'bg-surface-2/40 text-muted-foreground/60',
                cell.isSelected && 'ring-2 ring-primary ring-inset bg-primary/5',
                'hover:bg-surface-2/80'
              )}
            >
              {/* Day Number Header */}
              <div className="flex items-center justify-between w-full">
                <span
                  className={cn(
                    'text-xs font-mono font-medium inline-flex items-center justify-center h-6 w-6 rounded-full',
                    cell.isToday && 'bg-primary text-primary-foreground font-bold shadow-xs',
                    !cell.isToday && cell.isCurrentMonth && 'text-foreground',
                    !cell.isCurrentMonth && 'text-muted-foreground'
                  )}
                >
                  {cell.dayNumber}
                </span>

                {/* Mobile Category Dots */}
                {hasEvents && (
                  <div className="flex sm:hidden items-center gap-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        className={cn('w-1.5 h-1.5 rounded-full', ev.color.dot)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop Event Chips */}
              <div className="hidden sm:flex flex-col gap-1 mt-1 w-full flex-1 justify-start">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded border truncate font-medium flex items-center gap-1',
                      ev.color.bg,
                      ev.color.border,
                      ev.color.text
                    )}
                    title={`${ev.title} (${ev.subtitle || ev.category})`}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', ev.color.dot)} />
                    <span className="truncate">{ev.title}</span>
                  </div>
                ))}

                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-muted-foreground font-mono pl-1">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
