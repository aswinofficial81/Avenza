import React from 'react';
import { cn } from '../../lib/utils';

export interface ProgressProps {
  value?: number; // 0 to 100
  isIndeterminate?: boolean;
  label?: string;
  showValue?: boolean;
  compact?: boolean;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value = 0,
  isIndeterminate = false,
  label = 'Progress',
  showValue = false,
  compact = false,
  className,
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('w-full space-y-1', className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center text-xs font-medium text-foreground">
          {label && <span>{label}</span>}
          {showValue && !isIndeterminate && (
            <span className="font-mono text-muted-foreground">{Math.round(clampedValue)}%</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={cn(
          'w-full bg-surface-2 rounded-full overflow-hidden border border-border-subtle relative',
          compact ? 'h-1.5' : 'h-2'
        )}
      >
        {isIndeterminate ? (
          <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full w-1/3 animate-[pulse_1.5s_ease-in-out_infinite]" />
        ) : (
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 dark:from-teal-400 dark:to-emerald-300 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${clampedValue}%` }}
          />
        )}
      </div>
    </div>
  );
};
