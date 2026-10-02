import React, { useId } from 'react';
import { cn } from '../../lib/utils';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, description, id: customId, disabled, checked, ...props }, ref) => {
    const generatedId = useId();
    const id = customId || generatedId;

    return (
      <div className="flex items-start space-x-2.5 select-none">
        <div className="relative flex items-center pt-0.5">
          <input
            id={id}
            ref={ref}
            type="radio"
            checked={checked}
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              'h-4 w-4 rounded-full border border-border bg-surface transition-colors cursor-pointer flex items-center justify-center',
              'peer-checked:border-primary',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-focus-ring peer-focus-visible:ring-offset-1',
              'peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-disabled:bg-surface-2',
              className
            )}
          >
            <div className="h-2 w-2 rounded-full bg-primary hidden peer-checked:block" />
          </div>
        </div>
        {(label || description) && (
          <div className="text-xs space-y-0.5">
            {label && (
              <label
                htmlFor={id}
                className={cn(
                  'font-medium text-foreground cursor-pointer',
                  disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                {label}
              </label>
            )}
            {description && <p className="text-muted-foreground">{description}</p>}
          </div>
        )}
      </div>
    );
  }
);

Radio.displayName = 'Radio';
