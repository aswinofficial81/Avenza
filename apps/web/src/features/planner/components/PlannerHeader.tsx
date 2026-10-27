import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';

interface PlannerHeaderProps {
  selectedDate: string;
  onDateChange: (newDate: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const PlannerHeader: React.FC<PlannerHeaderProps> = ({
  selectedDate,
  onDateChange,
  onRefresh,
  isLoading,
}) => {
  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    onDateChange(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    onDateChange(d.toISOString().slice(0, 10));
  };

  const handleToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    onDateChange(today);
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[var(--color-border-subtle)]">
      <div>
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-1">
          <Link to="/today" className="hover:underline hover:text-[var(--color-text-primary)] transition-colors">
            Today
          </Link>
          <span>/</span>
          <Link to="/tasks" className="hover:underline hover:text-[var(--color-text-primary)] transition-colors">
            Tasks
          </Link>
          <span>/</span>
          <span className="text-[var(--color-text-primary)] font-medium">Adaptive Planner</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
          Adaptive Planner
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Deterministic single-day schedule optimization respecting your commitments and preferences.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-[var(--color-bg-subtle)] p-1 rounded-lg border border-[var(--color-border-subtle)]">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevDay}
            aria-label="Previous day"
            title="Previous day"
          >
            ←
          </Button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) {
                onDateChange(e.target.value);
              }
            }}
            aria-label="Select target date"
            className="px-2 py-1 text-sm bg-transparent border-0 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] rounded font-medium cursor-pointer"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextDay}
            aria-label="Next day"
            title="Next day"
          >
            →
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="ml-1 text-xs"
          >
            Today
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Optimizing...' : 'Refresh Plan'}
        </Button>
      </div>
    </div>
  );
};
