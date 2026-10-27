import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Timer, ArrowRight } from 'lucide-react';
import { useActiveFocusSession } from '../../focus/useFocusSession';
import { Button } from '../../../components/ui/Button';

export const OverviewFocusBanner: React.FC = () => {
  const { data: activeSession, isLoading, isError } = useActiveFocusSession();

  if (isLoading || isError || !activeSession || activeSession.status !== 'active') {
    return null;
  }

  const plannedMinutes = activeSession.planned_minutes || 25;

  return (
    <div
      role="region"
      aria-label="Active focus session"
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 px-4 rounded-lg bg-primary/10 border border-primary/20 text-foreground"
    >
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
        </span>
        <Timer className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-semibold">
          Focus Session in Progress ({plannedMinutes}m target)
        </span>
      </div>

      <Link to="/focus" className="shrink-0">
        <Button size="sm" variant="primary" className="text-xs h-8">
          <Play className="w-3.5 h-3.5 mr-1 fill-current" />
          Resume Focus
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </Link>
    </div>
  );
};
