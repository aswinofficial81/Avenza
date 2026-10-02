import React from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  icon?: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  icon,
  className,
  children,
  ...props
}) => {
  const variantStyles: Record<AlertVariant, { container: string; text: string; icon: React.ReactNode }> = {
    info: {
      container: 'bg-sky-500/10 border-sky-500/20 text-sky-900 dark:text-sky-200',
      text: 'text-sky-800 dark:text-sky-300',
      icon: <Info className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />,
    },
    success: {
      container: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200',
      text: 'text-emerald-800 dark:text-emerald-300',
      icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />,
    },
    warning: {
      container: 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200',
      text: 'text-amber-800 dark:text-amber-300',
      icon: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />,
    },
    danger: {
      container: 'bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-200',
      text: 'text-rose-800 dark:text-rose-300',
      icon: <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />,
    },
  };

  const current = variantStyles[variant];

  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded border p-3.5 text-xs flex items-start gap-2.5 transition-colors',
        current.container,
        className
      )}
      {...props}
    >
      {icon || current.icon}
      <div className="space-y-0.5 flex-1">
        {title && <h5 className="font-semibold leading-none tracking-tight">{title}</h5>}
        <div className={cn('leading-relaxed', current.text)}>{children}</div>
      </div>
    </div>
  );
};
