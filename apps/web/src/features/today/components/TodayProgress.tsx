import React from 'react';
import type { TodaySummary } from '@avenza/shared';
import { Card } from '../../../components/ui/Card';
import { Progress } from '../../../components/ui/Progress';
import { CheckCircle2, Clock, Target, Zap } from 'lucide-react';

export interface TodayProgressProps {
  summary: TodaySummary;
}

export const TodayProgress: React.FC<TodayProgressProps> = ({ summary }) => {
  const {
    completedTaskCount,
    meaningfulMinutes,
    focusMinutes = 0,
    fallbackTaskActualMinutes = 0,
    estimatedMinutesWithoutActual,
    dailyMinimum,
    dailyTarget,
    minimumProgress,
    targetProgress,
  } = summary;

  return (
    <Card className="p-5 sm:p-6 bg-card border-border shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left: Summary Metrics */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span>Daily Execution Summary</span>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-foreground">
                {meaningfulMinutes}
              </span>
              <span className="text-sm font-medium text-muted-foreground">actual min</span>
            </div>

            {focusMinutes > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                {focusMinutes}m focus
              </span>
            )}

            {fallbackTaskActualMinutes > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                {fallbackTaskActualMinutes}m manual
              </span>
            )}

            {estimatedMinutesWithoutActual > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                +{estimatedMinutesWithoutActual}m estimated
              </span>
            )}

            <span className="text-muted-foreground/40 hidden sm:inline">•</span>

            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>
                {completedTaskCount} task{completedTaskCount === 1 ? '' : 's'} completed
              </span>
            </div>
          </div>
        </div>

        {/* Right: Targets Progress Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:w-1/2">
          {/* Daily Minimum */}
          <div className="space-y-1.5 p-3 rounded-lg bg-background/50 border border-border/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Minimum
              </span>
              <span className="font-semibold text-foreground">
                {meaningfulMinutes}/{dailyMinimum}m ({minimumProgress}%)
              </span>
            </div>
            <Progress value={minimumProgress} />
          </div>

          {/* Daily Target */}
          <div className="space-y-1.5 p-3 rounded-lg bg-background/50 border border-border/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-primary" />
                Target
              </span>
              <span className="font-semibold text-foreground">
                {meaningfulMinutes}/{dailyTarget}m ({targetProgress}%)
              </span>
            </div>
            <Progress value={targetProgress} />
          </div>
        </div>
      </div>
    </Card>
  );
};
