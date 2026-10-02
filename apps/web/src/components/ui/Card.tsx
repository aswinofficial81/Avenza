import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'outline';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantStyles = {
      default: 'bg-surface border border-border shadow-sm',
      subtle: 'bg-surface-2 border border-border-subtle shadow-none',
      outline: 'bg-transparent border border-border shadow-none',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-lg transition-colors', variantStyles[variant], className)}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col space-y-1 p-5 pb-3', className)}
        {...props}
      />
    );
  }
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn('text-base font-semibold leading-none tracking-tight text-foreground', className)}
        {...props}
      >
        {children}
      </h3>
    );
  }
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn('text-xs text-muted-foreground leading-relaxed', className)}
      {...props}
    />
  );
});
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />;
  }
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center p-5 pt-0 border-t border-border-subtle mt-4', className)}
        {...props}
      />
    );
  }
);
CardFooter.displayName = 'CardFooter';
