import React from 'react';
import { cn } from '../../lib/utils';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'text-xs font-semibold text-foreground flex items-center gap-1 select-none',
          className
        )}
        {...props}
      >
        {children}
        {required && <span className="text-danger" aria-hidden="true">*</span>}
      </label>
    );
  }
);

Label.displayName = 'Label';
