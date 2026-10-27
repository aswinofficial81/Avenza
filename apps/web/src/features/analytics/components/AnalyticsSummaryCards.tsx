import React from 'react';
import type { AnalyticsSummaryDto } from '@avenza/shared';
import { CheckCircle2, Clock, Code2, AlertTriangle, Percent, Info } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';

export interface AnalyticsSummaryCardsProps {
  data: AnalyticsSummaryDto;
}

export const AnalyticsSummaryCards: React.FC<AnalyticsSummaryCardsProps> = ({ data }) => {
  const { execution, focus, dsa } = data;

  // Format focus hours and minutes
  const focusHours = Math.floor(focus.recordedFocusMinutes / 60);
  const remainingMins = focus.recordedFocusMinutes % 60;
  const focusTimeDisplay =
    focusHours > 0
      ? `${focusHours}h ${remainingMins}m`
      : `${focus.recordedFocusMinutes}m`;

  const hasOverdue = execution.currentOverdueCount > 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Tasks Completed */}
        <Card className="overflow-hidden border-border/60 bg-surface/80 backdrop-blur-xs transition-all hover:border-emerald-500/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground/90">
                Tasks Completed
              </span>
              <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div
              className="text-2xl font-bold font-mono text-foreground"
              data-testid="tasks-completed-value"
            >
              {execution.completedTaskCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Completed during selected period
            </p>
          </CardContent>
        </Card>

        {/* 2. Completion Rate */}
        <Card className="overflow-hidden border-border/60 bg-surface/80 backdrop-blur-xs transition-all hover:border-cyan-500/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground/90">
                Completion Rate
              </span>
              <div className="p-1 rounded-md bg-cyan-500/10 text-cyan-500">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div
              className="text-2xl font-bold font-mono text-foreground"
              data-testid="completion-rate-value"
            >
              {execution.completionRate !== null
                ? `${execution.completionRate}%`
                : '—'}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {execution.zeroDemand ? (
                'No demand in period'
              ) : (
                <span>
                  {execution.completedTaskCount} of{' '}
                  {execution.completedTaskCount + execution.openTasksDueInPeriodCount} due
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* 3. Current Overdue Backlog (Snapshot) */}
        <Card
          className={`overflow-hidden backdrop-blur-xs transition-all ${
            hasOverdue
              ? 'border-rose-500/30 bg-rose-500/[0.03] hover:border-rose-500/50'
              : 'border-border/60 bg-surface/80 hover:border-emerald-500/30'
          }`}
        >
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xs font-semibold tracking-wide uppercase ${
                    hasOverdue
                      ? 'text-rose-500 dark:text-rose-400'
                      : 'text-muted-foreground/90'
                  }`}
                >
                  Overdue Backlog
                </span>
                <Badge
                  variant={hasOverdue ? 'secondary' : 'default'}
                  className={`text-[10px] px-1 py-0 h-4 font-mono ${
                    hasOverdue
                      ? 'border-rose-500/30 text-rose-600 dark:text-rose-400'
                      : 'border-border-subtle text-muted-foreground'
                  }`}
                >
                  Current
                </Badge>
              </div>
              <div
                className={`p-1 rounded-md ${
                  hasOverdue
                    ? 'bg-rose-500/10 text-rose-500'
                    : 'bg-emerald-500/10 text-emerald-500'
                }`}
              >
                {hasOverdue ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </div>
            </div>
            <div
              className={`text-2xl font-bold font-mono ${
                hasOverdue
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-foreground'
              }`}
              data-testid="current-overdue-value"
            >
              {execution.currentOverdueCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasOverdue
                ? 'Unresolved open tasks due before now'
                : 'Unresolved open tasks due before now'}
            </p>
          </CardContent>
        </Card>

        {/* 4. Recorded Focus Time */}
        <Card className="overflow-hidden border-border/60 bg-surface/80 backdrop-blur-xs transition-all hover:border-indigo-500/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground/90">
                Recorded Focus
              </span>
              <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-500">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div
              className="text-2xl font-bold font-mono text-foreground"
              data-testid="recorded-focus-value"
            >
              {focusTimeDisplay}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {focus.completedSessionCount} completed session{focus.completedSessionCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        {/* 5. DSA Problems Solved */}
        <Card className="overflow-hidden border-border/60 bg-surface/80 backdrop-blur-xs transition-all hover:border-amber-500/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground/90">
                DSA Solved
              </span>
              <div className="p-1 rounded-md bg-amber-500/10 text-amber-500">
                <Code2 className="w-4 h-4" />
              </div>
            </div>
            <div
              className="text-2xl font-bold font-mono text-foreground"
              data-testid="dsa-solved-value"
            >
              {dsa.uniqueProblemsSolved}
            </div>
            <p className="text-xs text-muted-foreground">
              Unique problems ({dsa.totalAttempts} total attempts)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Metric policy callout */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-subtle bg-surface-2/30 text-[11px] text-muted-foreground">
        <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span>
          <strong>Completion Rate formula:</strong> <em>C / (C + O)</em> where C = completed tasks in period, O = open tasks due in period. Inbox tasks are included only when assigned a due date in this period; undated inbox tasks are excluded.
        </span>
      </div>
    </div>
  );
};
