import React from 'react';
import { Link } from 'react-router-dom';
import { Target, ArrowRight, Milestone } from 'lucide-react';
import { useGoals } from '../../goals/useGoals';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Progress } from '../../../components/ui/Progress';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { GoalPriorityBadge, GoalTypeBadge } from '../../goals/components/GoalBadges';

export const OverviewGoalsWidget: React.FC = () => {
  const { data: goalsResponse, isLoading, isError, error, refetch } = useGoals({
    status: 'active',
    pageSize: 3,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-14" />
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <Skeleton className="h-16 w-full rounded" />
          <Skeleton className="h-16 w-full rounded" />
          <Skeleton className="h-16 w-full rounded" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3 border-b border-border-subtle">
          <CardTitle className="text-sm font-semibold">Active Goals</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ErrorState
            title="Unable to load goals"
            description={(error as Error)?.message || 'Failed to fetch active goals.'}
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  const goals = goalsResponse?.data || [];

  return (
    <Card className="h-full flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Active Goals</CardTitle>
            </div>
            <Link to="/goals">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                View all
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-3">
          {goals.length > 0 ? (
            goals.map((goal) => {
              const metrics = goal.metrics;
              const progress = Math.round(metrics?.progressPercentage ?? 0);
              const milestoneText = `${metrics?.completedMilestoneCount ?? 0}/${metrics?.milestoneCount ?? 0} milestones`;

              return (
                <div
                  key={goal.id}
                  className="p-3 rounded-lg bg-surface border border-border-subtle space-y-2 hover:border-border transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <Link
                        to="/goals"
                        className="text-xs font-semibold text-foreground hover:text-primary transition-colors line-clamp-1"
                      >
                        {goal.title}
                      </Link>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {goal.goal_type && <GoalTypeBadge type={goal.goal_type} />}
                        {goal.priority && <GoalPriorityBadge priority={goal.priority} />}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-foreground shrink-0">
                      {progress}%
                    </span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <Progress value={progress} className="h-1.5" />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Milestone className="w-3 h-3" />
                        {milestoneText}
                      </span>
                      {goal.target_date && (
                        <span>Target: {new Date(goal.target_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              icon={<Target className="w-6 h-6 text-muted-foreground" />}
              title="No active goals"
              description="Set strategic objectives and track milestones to focus your efforts."
              action={
                <Link to="/goals">
                  <Button variant="outline" size="sm" className="text-xs">
                    Set a Goal
                  </Button>
                </Link>
              }
              className="py-6 border-none bg-transparent"
            />
          )}
        </CardContent>
      </div>
    </Card>
  );
};
