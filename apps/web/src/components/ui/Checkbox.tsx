import React, { useId } from 'react';
import { cn } from '../../lib/utils';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: string;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, error, id: customId, disabled, checked, ...props }, ref) => {
    const generatedId = useId();
    const id = customId || generatedId;

    return (
      <div className="flex items-start space-x-2.5 select-none">
        <div className="relative flex items-center pt-0.5">
          <input
            id={id}
            ref={ref}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              'h-4 w-4 rounded-sm border border-border bg-surface transition-colors cursor-pointer',
              'peer-checked:bg-primary peer-checked:border-primary peer-checked:text-primary-foreground',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-focus-ring peer-focus-visible:ring-offset-1',
              'peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-disabled:bg-surface-2',
              error ? 'border-danger' : '',
              className
            )}
          >
            <Check className="h-3 w-3 mx-auto hidden peer-checked:block stroke-[3]" />
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
            {error && <p className="text-danger font-medium">{error}</p>}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
