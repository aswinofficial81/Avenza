import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export interface TodayHeaderProps {
  currentDateStr: string; // "YYYY-MM-DD"
  timezone: string;
  selectedDate: string; // "YYYY-MM-DD"
  onDateChange: (date: string) => void;
  onCreateTask: () => void;
}

export const TodayHeader: React.FC<TodayHeaderProps> = ({
  currentDateStr,
  timezone,
  selectedDate,
  onDateChange,
  onCreateTask,
}) => {
  const isCurrentDay = selectedDate === currentDateStr;

  // Format selectedDate into human readable: e.g. "Saturday, October 3, 2026"
  const formattedDate = React.useMemo(() => {
    try {
      const parts = selectedDate.split('-').map(Number);
      const y = parts[0] || 2026;
      const m = parts[1] || 10;
      const d = parts[2] || 1;
      const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: timezone,
      }).format(dateObj);
    } catch {
      return selectedDate;
    }
  }, [selectedDate, timezone]);

  const handlePrevDay = () => {
    const parts = selectedDate.split('-').map(Number);
    const y = parts[0] || 2026;
    const m = parts[1] || 10;
    const d = parts[2] || 1;
    const dateObj = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0));
    const prevStr = dateObj.toISOString().split('T')[0] || '';
    if (prevStr) onDateChange(prevStr);
  };

  const handleNextDay = () => {
    const parts = selectedDate.split('-').map(Number);
    const y = parts[0] || 2026;
    const m = parts[1] || 10;
    const d = parts[2] || 1;
    const dateObj = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
    const nextStr = dateObj.toISOString().split('T')[0] || '';
    if (nextStr) onDateChange(nextStr);
  };

  const handleTodayClick = () => {
    onDateChange(currentDateStr);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Today</h1>
          {!isCurrentDay && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Viewing Custom Day
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-primary" />
          <span>{formattedDate}</span>
          <span className="text-xs text-muted-foreground/70">({timezone})</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Day Navigation */}
        <div className="flex items-center bg-card border border-border/80 rounded-xl p-0.5 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevDay}
            className="h-8 w-8 p-0"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            variant={isCurrentDay ? 'secondary' : 'ghost'}
            size="sm"
            onClick={handleTodayClick}
            className="h-8 px-2.5 text-xs font-medium"
            disabled={isCurrentDay}
          >
            Today
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextDay}
            className="h-8 w-8 p-0"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <Button onClick={onCreateTask} className="gap-2">
          <Plus className="w-4 h-4" />
          <span>Create Task</span>
        </Button>
      </div>
    </div>
  );
};
