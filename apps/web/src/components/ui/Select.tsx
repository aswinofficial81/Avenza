import React, { useId } from 'react';
import { cn } from '../../lib/utils';
import { Label } from './Label';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  description?: string;
  error?: string;
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      description,
      error,
      id: customId,
      disabled,
      required,
      options,
      children,
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
          <select
            id={id}
            ref={ref}
            disabled={disabled}
            required={required}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            className={cn(
              'w-full h-9 pl-3 pr-8 rounded bg-surface border text-foreground text-sm appearance-none cursor-pointer transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring focus-visible:border-focus-ring',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-2',
              error ? 'border-danger focus-visible:ring-danger' : 'border-border',
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="absolute right-2.5 pointer-events-none text-muted-foreground">
            <ChevronDown className="w-4 h-4" />
          </div>
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

Select.displayName = 'Select';
