import React from 'react';
import { cn } from '../../lib/utils';

export interface ActivityFeedItemProps {
  actor?: string;
  action: string;
  target?: string;
  timestamp?: string;
  icon?: React.ReactNode;
}

export const ActivityFeedItem: React.FC<ActivityFeedItemProps> = ({
  actor,
  action,
  target,
  timestamp,
  icon,
}) => {
  return (
    <div className="flex items-start gap-3 py-2 text-xs border-b border-border-subtle last:border-0">
      {icon && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-surface-2 text-muted-foreground border border-border-subtle mt-0.5">
          {icon}
        </div>
      )}
      <div className="flex-1 space-y-0.5">
        <p className="text-foreground leading-snug">
          {actor && <span className="font-semibold text-foreground mr-1">{actor}</span>}
          <span className="text-muted-foreground">{action}</span>
          {target && <span className="font-medium text-foreground ml-1">{target}</span>}
        </p>
        {timestamp && <span className="block font-mono text-[11px] text-muted-foreground">{timestamp}</span>}
      </div>
    </div>
  );
};

export interface ActivityFeedProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ className, children, ...props }) => {
  return (
    <div className={cn('divide-y divide-border-subtle', className)} {...props}>
      {children}
    </div>
  );
};
