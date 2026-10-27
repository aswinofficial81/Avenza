import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';

export const ProjectCardSkeleton: React.FC = () => {
  return (
    <Card className="p-5 flex flex-col justify-between border-border/70 space-y-5" data-testid="project-card-skeleton">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-2 w-full">
            <Skeleton className="h-5 w-48 rounded" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-14 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded shrink-0" />
        </div>

        <div className="space-y-1.5 pt-1">
          <Skeleton className="h-3.5 w-full rounded" />
          <Skeleton className="h-3.5 w-4/5 rounded" />
        </div>
      </div>

      <div className="pt-4 border-t border-border/50 space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Skeleton className="h-3.5 w-20 rounded" />
            <Skeleton className="h-3.5 w-8 rounded" />
          </div>
          <Skeleton className="h-1.5 w-full rounded" />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3.5 w-20 rounded" />
          </div>
          <Skeleton className="h-3.5 w-24 rounded" />
        </div>

        <div className="pt-1 flex gap-1.5">
          <Skeleton className="h-4 w-14 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
          <Skeleton className="h-4 w-12 rounded" />
        </div>
      </div>
    </Card>
  );
};
