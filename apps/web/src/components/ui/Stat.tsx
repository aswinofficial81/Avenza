import React from 'react';
import { cn } from '../../lib/utils';
import { Card, CardContent } from './Card';

export interface StatProps {
  label: string;
  value: React.ReactNode;
  description?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  description,
  trend,
  icon,
  className,
}) => {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-4 pt-4 space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-semibold tracking-tight text-foreground font-mono">
            {value}
          </div>
          {trend && (
            <span
              className={cn(
                'text-xs font-mono font-medium',
                trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {trend.value}
            </span>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
};
