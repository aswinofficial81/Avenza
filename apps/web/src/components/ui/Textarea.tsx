import React, { useId } from 'react';
import { cn } from '../../lib/utils';
import { Label } from './Label';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      description,
      error,
      id: customId,
      disabled,
      required,
      rows = 3,
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
        <textarea
          id={id}
          ref={ref}
          rows={rows}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full p-3 rounded bg-surface border text-foreground placeholder:text-muted-foreground text-sm transition-colors resize-y',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring focus-visible:border-focus-ring',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-2',
            error ? 'border-danger focus-visible:ring-danger' : 'border-border',
            className
          )}
          {...props}
        />
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

Textarea.displayName = 'Textarea';
