import React from 'react';
import type { AnalyticsDsaSummary } from '@avenza/shared';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Code2, BookOpen, CheckCircle } from 'lucide-react';

export interface AnalyticsDsaSectionProps {
  dsa: AnalyticsDsaSummary;
}

export const AnalyticsDsaSection: React.FC<AnalyticsDsaSectionProps> = ({ dsa }) => {
  const { solvedByDifficulty } = dsa;
  const totalSolved =
    solvedByDifficulty.easy + solvedByDifficulty.medium + solvedByDifficulty.hard;

  const easyPct = totalSolved > 0 ? (solvedByDifficulty.easy / totalSolved) * 100 : 0;
  const medPct = totalSolved > 0 ? (solvedByDifficulty.medium / totalSolved) * 100 : 0;
  const hardPct = totalSolved > 0 ? (solvedByDifficulty.hard / totalSolved) * 100 : 0;

  const hasRevisionDue = dsa.currentRevisionDueCount > 0;

  return (
    <Card className="overflow-hidden border-border/60 bg-surface/80 backdrop-blur-xs flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-border-subtle flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Code2 className="w-4 h-4 text-amber-500" />
              DSA Problem Solving & Retention
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Unique problems solved and active spaced-repetition workload
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono">
              {dsa.totalAttempts} Attempt{dsa.totalAttempts !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Difficulty breakdown visual bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-wide text-[10px]">
                Solves Distribution
              </span>
              <span className="font-mono text-[11px] text-foreground font-semibold">
                {dsa.uniqueProblemsSolved} unique problem{dsa.uniqueProblemsSolved !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-2/60 overflow-hidden flex">
              {totalSolved > 0 ? (
                <>
                  {easyPct > 0 && (
                    <div
                      style={{ width: `${easyPct}%` }}
                      className="bg-emerald-500 transition-all duration-300"
                      title={`Easy: ${solvedByDifficulty.easy}`}
                    />
                  )}
                  {medPct > 0 && (
                    <div
                      style={{ width: `${medPct}%` }}
                      className="bg-amber-500 transition-all duration-300"
                      title={`Medium: ${solvedByDifficulty.medium}`}
                    />
                  )}
                  {hardPct > 0 && (
                    <div
                      style={{ width: `${hardPct}%` }}
                      className="bg-rose-500 transition-all duration-300"
                      title={`Hard: ${solvedByDifficulty.hard}`}
                    />
                  )}
                </>
              ) : (
                <div className="w-full h-full bg-border/40" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Difficulty breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Unique Solves by Difficulty
              </h4>
              <div className="space-y-2">
                {/* Easy */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border-subtle bg-surface-2/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                    <span className="text-xs font-medium">Easy</span>
                  </div>
                  <span className="text-xs font-bold font-mono text-foreground">
                    {solvedByDifficulty.easy}
                  </span>
                </div>

                {/* Medium */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border-subtle bg-surface-2/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
                    <span className="text-xs font-medium">Medium</span>
                  </div>
                  <span className="text-xs font-bold font-mono text-foreground">
                    {solvedByDifficulty.medium}
                  </span>
                </div>

                {/* Hard */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border-subtle bg-surface-2/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]" />
                    <span className="text-xs font-medium">Hard</span>
                  </div>
                  <span className="text-xs font-bold font-mono text-foreground">
                    {solvedByDifficulty.hard}
                  </span>
                </div>
              </div>
            </div>

            {/* Revision due & practice insights */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Spaced Repetition & Retention
              </h4>

              <div
                className={`p-3.5 rounded-lg border transition-all ${
                  hasRevisionDue
                    ? 'border-amber-500/30 bg-amber-500/[0.04]'
                    : 'border-border-subtle bg-surface-2/30'
                } space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-medium flex items-center gap-1.5 ${
                      hasRevisionDue
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-foreground'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 text-amber-500" />
                    Revision Workload Due
                  </span>
                  <Badge
                    variant={hasRevisionDue ? 'secondary' : 'default'}
                    className={`text-[10px] px-1.5 py-0 h-4 font-mono ${
                      hasRevisionDue
                        ? 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                        : 'border-border-subtle text-muted-foreground'
                    }`}
                  >
                    Current Snapshot
                  </Badge>
                </div>
                <div
                  className={`text-2xl font-bold font-mono ${
                    hasRevisionDue
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-foreground'
                  }`}
                  data-testid="dsa-revision-due-value"
                >
                  {dsa.currentRevisionDueCount}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {hasRevisionDue
                    ? 'Problems currently scheduled for spaced revision'
                    : 'Problems currently scheduled for spaced revision'}
                </p>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface-2/20 text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center gap-1 text-foreground font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Deduplicated Solves
                </div>
                <p>
                  Repeated solved attempts on the same problem during this period are counted as practice attempts but do not inflate the unique problem count.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
};
