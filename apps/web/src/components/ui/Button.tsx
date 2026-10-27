import React from 'react';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none';

    const variantStyles: Record<ButtonVariant, string> = {
      primary: 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm active:scale-[0.99]',
      secondary:
        'bg-surface-2 text-foreground hover:bg-surface border border-border-subtle shadow-sm active:scale-[0.99]',
      outline:
        'border border-border bg-transparent text-foreground hover:bg-surface-2 active:scale-[0.99]',
      ghost: 'bg-transparent text-foreground hover:bg-surface-2 active:scale-[0.99]',
      danger: 'bg-danger text-danger-foreground hover:opacity-90 shadow-sm active:scale-[0.99]',
      link: 'text-secondary underline-offset-4 hover:underline p-0 h-auto font-normal',
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
      md: 'h-9 px-4 text-sm rounded-xl gap-2',
      lg: 'h-11 px-5 text-base rounded-xl gap-2.5',
      icon: 'h-9 w-9 p-0 rounded-xl flex items-center justify-center',
    };

    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={isLoading ? 'true' : undefined}
        className={cn(
          baseStyles,
          variantStyles[variant],
          size !== 'icon' && variant === 'link' ? '' : sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <Spinner size="sm" className="shrink-0 text-current" />
            {size !== 'icon' && children}
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
