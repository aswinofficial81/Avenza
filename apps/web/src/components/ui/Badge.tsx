import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'sm',
  children,
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-surface-2 text-foreground border-border-subtle',
    secondary: 'bg-surface text-muted-foreground border-border',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20',
    info: 'bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/20',
  };

  const sizeStyles: Record<BadgeSize, string> = {
    sm: 'text-[11px] px-2 py-0.5 font-medium rounded-sm',
    md: 'text-xs px-2.5 py-1 font-medium rounded',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border transition-colors select-none font-mono',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
