import React from 'react';
import type { AnalyticsExecutionSummary, TaskPriority } from '@avenza/shared';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Layers, Inbox } from 'lucide-react';

export interface AnalyticsExecutionBreakdownProps {
  execution: AnalyticsExecutionSummary;
}

const PRIORITY_LABELS: Record<
  TaskPriority,
  { label: string; dotColor: string; barColor: string }
> = {
  critical: {
    label: 'Critical',
    dotColor: 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]',
    barColor: 'bg-rose-500',
  },
  high: {
    label: 'High',
    dotColor: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]',
    barColor: 'bg-amber-500',
  },
  medium: {
    label: 'Medium',
    dotColor: 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.4)]',
    barColor: 'bg-indigo-500',
  },
  low: {
    label: 'Low',
    dotColor: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]',
    barColor: 'bg-emerald-500',
  },
};

export const AnalyticsExecutionBreakdown: React.FC<AnalyticsExecutionBreakdownProps> = ({
  execution,
}) => {
  const { completedByPriority, completedByType, completedTaskCount } = execution;

  // Filter types with at least 1 completed task for compact display
  const activeTypes = Object.entries(completedByType)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <Card className="overflow-hidden border-border/60 bg-surface/80 backdrop-blur-xs flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-border-subtle">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-500" />
            Execution Breakdown
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Distribution of completed work across priority tiers and activity types
          </p>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priority breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Completed by Priority
              </h4>
              <div className="space-y-2">
                {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => {
                  const count = completedByPriority[p] || 0;
                  const percent =
                    completedTaskCount > 0
                      ? Math.round((count / completedTaskCount) * 100)
                      : 0;
                  const { label, dotColor, barColor } = PRIORITY_LABELS[p];

                  return (
                    <div
                      key={p}
                      className="p-2.5 rounded-lg border border-border-subtle bg-surface-2/30 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                          <span className="text-xs font-medium">{label}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-xs font-bold text-foreground">
                            {count}
                          </span>
                          <span className="text-[10px] text-muted-foreground w-9 text-right">
                            ({percent}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface-2/60 overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className={`h-full rounded-full ${barColor} transition-all duration-300`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activity type breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Completed by Task Type
              </h4>
              {activeTypes.length > 0 ? (
                <div className="space-y-2">
                  {activeTypes.map(([typeKey, count]) => {
                    const formattedType = typeKey
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase());
                    const percent =
                      completedTaskCount > 0
                        ? Math.round((count / completedTaskCount) * 100)
                        : 0;

                    return (
                      <div
                        key={typeKey}
                        className="p-2.5 rounded-lg border border-border-subtle bg-surface-2/30 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{formattedType}</span>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-xs font-bold text-foreground">
                              {count}
                            </span>
                            <span className="text-[10px] text-muted-foreground w-9 text-right">
                              ({percent}%)
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-surface-2/60 overflow-hidden">
                          <div
                            style={{ width: `${percent}%` }}
                            className="h-full rounded-full bg-cyan-500 transition-all duration-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 rounded-lg border border-dashed border-border-subtle bg-surface-2/20 text-center space-y-2">
                  <Inbox className="w-6 h-6 text-muted-foreground/60" />
                  <p className="text-xs text-muted-foreground">
                    No task type activity recorded in this period.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
};
