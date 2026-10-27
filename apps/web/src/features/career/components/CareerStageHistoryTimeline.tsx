import React from 'react';
import type { CareerApplicationHistoryDto } from '@avenza/shared';
import { useCareerApplicationHistory } from '../hooks/useCareer';

interface CareerStageHistoryTimelineProps {
  applicationId: string;
  initialHistory?: CareerApplicationHistoryDto[];
}

const STAGE_COLORS: Record<string, string> = {
  saved: 'border-slate-500 bg-slate-500/10 text-slate-300',
  applied: 'border-blue-500 bg-blue-500/10 text-blue-300',
  screening: 'border-cyan-500 bg-cyan-500/10 text-cyan-300',
  assessment: 'border-purple-500 bg-purple-500/10 text-purple-300',
  interview: 'border-indigo-500 bg-indigo-500/10 text-indigo-300',
  offer: 'border-emerald-500 bg-emerald-500/10 text-emerald-300',
  accepted: 'border-green-600 bg-green-600/10 text-green-300',
  declined: 'border-zinc-500 bg-zinc-500/10 text-zinc-300',
  rejected: 'border-red-500 bg-red-500/10 text-red-300',
  withdrawn: 'border-amber-500 bg-amber-500/10 text-amber-300',
  closed: 'border-zinc-600 bg-zinc-600/10 text-zinc-400',
};

export const CareerStageHistoryTimeline: React.FC<CareerStageHistoryTimelineProps> = ({
  applicationId,
  initialHistory,
}) => {
  const { data: fetchedHistory, isLoading } = useCareerApplicationHistory(
    initialHistory ? undefined : applicationId
  );

  const history = initialHistory || fetchedHistory || [];

  if (isLoading && !initialHistory) {
    return (
      <div className="p-4 text-center text-sm text-foreground-muted animate-pulse">
        Loading stage history...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-foreground-muted border border-dashed border-border rounded-lg">
        No stage transitions recorded yet.
      </div>
    );
  }

  // Sort descending by changed_at so the latest event appears first
  const sorted = [...history].sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  );

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
      {sorted.map((item) => {
        const stageColor = STAGE_COLORS[item.to_stage] || 'border-border text-foreground';
        const formattedDate = new Date(item.changed_at).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        });

        return (
          <div key={item.id} className="relative group">
            {/* Timeline bullet */}
            <div
              className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 ${stageColor} bg-background group-hover:scale-125 transition-transform`}
            />

            <div className="bg-surface/50 border border-border/80 rounded-lg p-3 hover:border-border transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  {item.from_stage ? (
                    <>
                      <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded font-mono bg-surface-hover text-foreground-muted">
                        {item.from_stage}
                      </span>
                      <span className="text-foreground-muted text-xs">→</span>
                    </>
                  ) : null}
                  <span
                    className={`text-xs uppercase tracking-wider px-2 py-0.5 rounded font-semibold border ${stageColor}`}
                  >
                    {item.to_stage}
                  </span>
                </div>
                <time className="text-xs text-foreground-muted font-mono">{formattedDate}</time>
              </div>

              {item.notes && (
                <p className="text-sm text-foreground/90 mt-2 bg-surface-hover/50 p-2 rounded border border-border/50 whitespace-pre-wrap">
                  {item.notes}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
