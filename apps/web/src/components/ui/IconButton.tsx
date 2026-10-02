import React from 'react';
import { cn } from '../../lib/utils';
import { Button, ButtonVariant, ButtonSize } from './Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, className, 'aria-label': ariaLabel, size = 'icon', variant = 'ghost', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        aria-label={ariaLabel}
        className={cn('shrink-0', className)}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton';
