import React, { useId } from 'react';
import { cn } from '../../lib/utils';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  id?: string;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  description,
  id: customId,
  className,
}) => {
  const generatedId = useId();
  const id = customId || generatedId;

  return (
    <div className="flex items-center justify-between gap-3 select-none">
      {(label || description) && (
        <div className="space-y-0.5">
          {label && (
            <label
              htmlFor={id}
              className={cn(
                'text-xs font-semibold text-foreground cursor-pointer',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              {label}
            </label>
          )}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-surface-2 border border-border',
          className
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
};
