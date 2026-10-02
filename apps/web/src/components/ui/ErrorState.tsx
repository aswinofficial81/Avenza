import React from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'An error occurred',
  description = 'Failed to load content. Please try again.',
  onRetry,
  retryLabel = 'Retry',
  className,
}) => {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-lg border border-danger/30 bg-danger/5 max-w-md mx-auto',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-danger/10 text-danger mb-3.5 border border-danger/20">
        <AlertCircle className="h-6 w-6 stroke-[1.5]" />
      </div>
      <h4 className="text-sm font-semibold text-foreground mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground max-w-sm mb-4 leading-relaxed">
        {description}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
};
