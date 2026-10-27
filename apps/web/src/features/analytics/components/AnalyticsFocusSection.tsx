import React from 'react';
import type { AnalyticsFocusSummary } from '@avenza/shared';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Clock, Info, Flame, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface AnalyticsFocusSectionProps {
  focus: AnalyticsFocusSummary;
}

function formatDayLabel(dateStr: string): { weekday: string; day: string } {
  try {
    const parts = dateStr.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const d = new Date(year, month, day);
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    return { weekday, day: String(day) };
  } catch {
    return { weekday: '', day: dateStr.slice(-2) };
  }
}

export const AnalyticsFocusSection: React.FC<AnalyticsFocusSectionProps> = ({ focus }) => {
  const maxRecorded = Math.max(...focus.dailyDistribution.map((d) => d.focusMinutes), 0);
  // Scale ceiling: round up to nearest 30 or 60 min, with minimum 60 min
  const maxMinutes = Math.max(60, Math.ceil(maxRecorded / 30) * 30);
  const midMinutes = Math.round(maxMinutes / 2);

  const hasAnyActivity = focus.recordedFocusMinutes > 0;

  return (
    <Card className="overflow-hidden border-border/60 bg-surface/80 backdrop-blur-xs flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Focus & Deep Work Diagnostics
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Daily focus distribution and session volume over the selected period
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="bg-surface-2/60 border border-border-subtle px-2 py-1 rounded">
              <span className="text-muted-foreground mr-1.5">Avg:</span>
              <span className="font-semibold text-foreground">
                {focus.averageSessionMinutes !== null
                  ? `${focus.averageSessionMinutes}m`
                  : '—'}
              </span>
            </div>
            <div className="bg-surface-2/60 border border-border-subtle px-2 py-1 rounded">
              <span className="text-muted-foreground mr-1.5">Cancelled:</span>
              <span className="font-semibold text-foreground">
                {focus.cancelledSessionCount}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {focus.dailyDistribution.length > 0 ? (
            <div className="space-y-2">
              {/* Chart container with Y-axis guides */}
              <div className="relative pt-6 pb-2">
                {/* Horizontal Guide Lines */}
                <div className="absolute inset-x-0 top-6 bottom-8 flex flex-col justify-between pointer-events-none text-[10px] font-mono text-muted-foreground/50">
                  <div className="border-b border-dashed border-border-subtle/50 flex justify-between pr-1 pb-0.5">
                    <span>{maxMinutes}m</span>
                  </div>
                  <div className="border-b border-dashed border-border-subtle/40 flex justify-between pr-1 pb-0.5">
                    <span>{midMinutes}m</span>
                  </div>
                  <div className="border-b border-border-subtle flex justify-between pr-1 pb-0.5">
                    <span>0m</span>
                  </div>
                </div>

                {/* Bars Area */}
                <div className="h-36 flex items-end gap-2 sm:gap-3 px-3 relative z-10">
                  {focus.dailyDistribution.map((day) => {
                    const heightPercent =
                      day.focusMinutes > 0
                        ? Math.max(8, Math.round((day.focusMinutes / maxMinutes) * 100))
                        : 0;
                    const hasActivity = day.focusMinutes > 0;
                    const { weekday, day: dayNum } = formatDayLabel(day.date);

                    return (
                      <div
                        key={day.date}
                        className="flex-1 flex flex-col items-center justify-end h-full group relative"
                      >
                        {/* Interactive Tooltip on hover */}
                        <div className="absolute -top-9 hidden group-hover:flex flex-col items-center z-30 pointer-events-none transition-all">
                          <div className="bg-popover text-popover-foreground text-[10px] font-mono px-2 py-1 rounded-md shadow-lg border border-border whitespace-nowrap">
                            <span className="font-semibold">{day.date}</span>: {day.focusMinutes}m ({day.completedSessionCount} session{day.completedSessionCount !== 1 ? 's' : ''})
                          </div>
                          <div className="w-1.5 h-1.5 bg-popover border-b border-r border-border transform rotate-45 -mt-1" />
                        </div>

                        {/* Column Bar with Track */}
                        <div className="w-full max-w-[36px] h-full flex flex-col justify-end items-center rounded-t bg-muted/10 group-hover:bg-muted/25 transition-colors p-0.5">
                          {hasActivity ? (
                            <div
                              style={{ height: `${heightPercent}%` }}
                              className="w-full rounded-t bg-gradient-to-t from-indigo-600 to-indigo-400 dark:from-indigo-600 dark:to-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)] group-hover:brightness-110 transition-all duration-300"
                            />
                          ) : (
                            <div className="w-full h-1 rounded-full bg-border/60 group-hover:bg-muted-foreground/40 transition-colors" />
                          )}
                        </div>

                        {/* Day & Date Label */}
                        <div className="mt-2 text-center select-none font-mono">
                          <div className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                            {weekday}
                          </div>
                          <div className="text-[9px] text-muted-foreground/70">
                            {dayNum}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Informative empty state overlay if 0 minutes in entire period */}
              {!hasAnyActivity && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-surface-2/40 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Flame className="w-4 h-4 text-indigo-400" />
                    <span>No focus sessions recorded in this period yet.</span>
                  </div>
                  <Link
                    to="/focus"
                    className="inline-flex items-center gap-1 font-medium text-indigo-500 hover:text-indigo-400 text-xs"
                  >
                    Start Focus Session
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No daily distribution available for this period.
            </div>
          )}
        </CardContent>
      </div>

      <div className="px-4 pb-4">
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-2 border-t border-border-subtle">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            <strong>Recorded focus time</strong> measures elapsed wall-clock duration between session start and completion. Pauses and interruptions are not modeled.
          </span>
        </p>
      </div>
    </Card>
  );
};
