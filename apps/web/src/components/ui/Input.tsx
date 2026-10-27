import React, { useId } from 'react';
import { cn } from '../../lib/utils';
import { Label } from './Label';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      description,
      error,
      id: customId,
      disabled,
      required,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = customId || generatedId;
    const descId = description ? `${id}-desc` : undefined;
    const errorId = error ? `${id}-error` : undefined;

    const describedBy = [descId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <Label htmlFor={id} required={required}>
            {label}
          </Label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-muted-foreground">
              {leftIcon}
            </div>
          )}
          <input
            id={id}
            ref={ref}
            type={type}
            disabled={disabled}
            required={required}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            className={cn(
              'w-full h-10 px-3.5 rounded-xl bg-surface border text-foreground placeholder:text-muted-foreground text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30 focus-visible:border-focus-ring',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-2',
              error ? 'border-danger focus-visible:ring-danger' : 'border-border',
              leftIcon ? 'pl-9' : '',
              rightIcon ? 'pr-9' : '',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-muted-foreground">
              {rightIcon}
            </div>
          )}
        </div>
        {description && !error && (
          <p id={descId} className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-danger font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
