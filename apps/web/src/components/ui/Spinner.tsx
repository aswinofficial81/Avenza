import React from 'react';
import { cn } from '../../lib/utils';

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className,
  label = 'Loading...',
  ...props
}) => {
  const sizeMap = {
    sm: 'h-3.5 w-3.5',
    md: 'h-5 w-5',
    lg: 'h-8 w-8',
  };

  return (
    <svg
      role="status"
      aria-label={label}
      className={cn('animate-spin text-current', sizeMap[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
      />
    </svg>
  );
};
