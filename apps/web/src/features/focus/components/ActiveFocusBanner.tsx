import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useActiveFocusSession } from '../useFocusSession';
import { formatTime } from './FocusTimer';
import { Flame, ArrowUpRight } from 'lucide-react';

export const ActiveFocusBanner: React.FC = () => {
  const location = useLocation();
  const { data: activeSession } = useActiveFocusSession();

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (!activeSession?.started_at) return;

    const update = () => {
      const startMs = new Date(activeSession.started_at).getTime();
      const nowMs = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((nowMs - startMs) / 1000)));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeSession?.started_at]);

  // If no active session, or user is already on the /focus page, do not render banner
  if (!activeSession || activeSession.status !== 'active') {
    return null;
  }

  const isFocusPage = location.pathname === '/focus';
  if (isFocusPage) {
    return null;
  }

  const taskTitle = activeSession.task?.title || 'Active Focus Task';
  const sessionType = activeSession.session_type.replace('_', ' ').toUpperCase();

  return (
    <aside
      className="w-full bg-card/95 border-b border-primary/20 py-2 px-4 sm:px-6 transition-all"
      aria-label="Active Focus Session Announcement"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center gap-1 font-bold tracking-wider text-[10px] uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 flex-shrink-0">
            <Flame className="w-3 h-3 text-primary" />
            <span>{sessionType}</span>
          </span>

          <span className="font-medium text-foreground truncate max-w-[200px] sm:max-w-md">
            {taskTitle}
          </span>

          <span className="text-muted-foreground/40 hidden sm:inline">•</span>

          <span className="font-mono text-muted-foreground font-medium flex-shrink-0">
            {formatTime(elapsedSeconds)} elapsed
          </span>
        </div>

        <Link
          to="/focus"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex-shrink-0"
        >
          <span>Open Session</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </aside>
  );
};
