import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  width,
  height,
  style,
  ...props
}) => {
  return (
    <div
      role="status"
      aria-label="Loading..."
      className={cn('animate-pulse rounded bg-surface-2', className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      {...props}
    />
  );
};
