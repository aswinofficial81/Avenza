import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

export interface FocusTimerProps {
  startedAt: string;
  plannedMinutes: number;
  className?: string;
}

export function formatTime(seconds: number): string {
  const isNegative = seconds < 0;
  const absSeconds = Math.abs(seconds);
  const hrs = Math.floor(absSeconds / 3600);
  const mins = Math.floor((absSeconds % 3600) / 60);
  const secs = absSeconds % 60;

  const paddedMins = String(mins).padStart(2, '0');
  const paddedSecs = String(secs).padStart(2, '0');

  if (hrs > 0) {
    const paddedHrs = String(hrs).padStart(2, '0');
    return `${isNegative ? '-' : ''}${paddedHrs}:${paddedMins}:${paddedSecs}`;
  }

  return `${isNegative ? '-' : ''}${paddedMins}:${paddedSecs}`;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({
  startedAt,
  plannedMinutes,
  className = '',
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    const startMs = new Date(startedAt).getTime();
    const nowMs = Date.now();
    return Math.max(0, Math.floor((nowMs - startMs) / 1000));
  });

  // Calculate elapsed time from authoritative started_at directly on every tick to avoid drift
  useEffect(() => {
    const updateElapsed = () => {
      const startMs = new Date(startedAt).getTime();
      const nowMs = Date.now();
      const diffSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(diffSecs);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const plannedSeconds = plannedMinutes * 60;
  const progressPercent = Math.min(100, Math.round((elapsedSeconds / plannedSeconds) * 100));
  const isOvertime = elapsedSeconds > plannedSeconds;
  const overtimeSeconds = isOvertime ? elapsedSeconds - plannedSeconds : 0;

  // Accessible summary for assistive technology
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const ariaLabel = `${elapsedMinutes} minutes elapsed of ${plannedMinutes} minute planned focus session`;

  return (
    <div
      className={`flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl bg-card border border-border/80 shadow-xs relative overflow-hidden ${className}`}
      role="region"
      aria-label="Focus Timer"
    >
      {/* Calm Circular / Radial Progress or Technical Indicator */}
      <div className="relative flex items-center justify-center w-56 h-56 sm:w-64 sm:h-64 my-2">
        <svg
          className="w-full h-full transform -rotate-90"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="50"
            cy="50"
            r="42"
            className="stroke-muted/40"
            strokeWidth="5"
            fill="transparent"
          />
          {/* Progress fill */}
          <circle
            cx="50"
            cy="50"
            r="42"
            className={`transition-all duration-500 ease-out ${
              isOvertime ? 'stroke-amber-500' : 'stroke-primary'
            }`}
            strokeWidth="5"
            strokeDasharray={264}
            strokeDashoffset={264 - (264 * Math.min(100, progressPercent)) / 100}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Center Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>{isOvertime ? 'Overtime' : 'Elapsed'}</span>
          </div>

          <div
            className="text-4xl sm:text-5xl font-mono font-bold tracking-tight text-foreground"
            aria-live="off"
            title={ariaLabel}
          >
            {formatTime(elapsedSeconds)}
          </div>

          <div className="mt-2 text-xs text-muted-foreground font-medium">
            <span>Target: {plannedMinutes} min</span>
            {isOvertime && (
              <span className="text-amber-600 dark:text-amber-400 block font-semibold">
                +{formatTime(overtimeSeconds)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Accessible text summary for screen readers (aria-live="polite" periodically or static) */}
      <div className="sr-only" aria-live="polite">
        {ariaLabel}
      </div>

      {/* Progress pill bar */}
      <div className="w-full max-w-xs mt-4">
        <div className="flex justify-between items-center text-xs text-muted-foreground mb-1.5 font-medium">
          <span>0m</span>
          <span>{progressPercent}%</span>
          <span>{plannedMinutes}m</span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isOvertime ? 'bg-amber-500' : 'bg-primary'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {isOvertime && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Session has passed the planned duration. You can wrap up anytime.</span>
        </div>
      )}
    </div>
  );
};
