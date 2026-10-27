import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Progress } from '../../../components/ui/Progress';
import { Alert } from '../../../components/ui/Alert';
import type { ScheduleProposalResponseDto } from '@avenza/shared';

interface PlannerContextCardProps {
  proposal: ScheduleProposalResponseDto;
}

export const PlannerContextCard: React.FC<PlannerContextCardProps> = ({ proposal }) => {
  const {
    studyWindow,
    timezone,
    dailyTargetMinutes,
    maxDailyStudyMinutes,
    totalProposedMinutes,
    isExternalCalendarAvailable,
    warnings,
  } = proposal;

  const targetMinutes = dailyTargetMinutes;
  const proposedMinutes = totalProposedMinutes;
  const utilizationPercent = targetMinutes > 0
    ? Math.min(100, Math.round((proposedMinutes / targetMinutes) * 100))
    : 0;

  return (
    <div className="space-y-3">
      {/* Calendar unavailability warning */}
      {!isExternalCalendarAvailable && (
        <Alert
          variant="warning"
          title="Google Calendar Offline"
          className="border-amber-500/30 bg-amber-500/5 text-amber-200"
        >
          Google Calendar busy intervals could not be verified. This draft accounts for Avenza commitments and your study window only. Check your external calendar before applying.
        </Alert>
      )}

      {/* Defaulted estimate warning */}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, idx) => (
            <Alert key={idx} variant="info" className="py-2 text-xs">
              {w}
            </Alert>
          ))}
        </div>
      )}

      <Card className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 divide-y md:divide-y-0 md:divide-x divide-[var(--color-border-subtle)]">
          {/* Study Window */}
          <div className="pr-4">
            <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
              Study Window
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-base font-bold text-[var(--color-text-primary)]">
                {studyWindow.start} – {studyWindow.end}
              </span>
              <Badge variant="secondary" size="sm" className="text-xs">
                {timezone}
              </Badge>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Deterministic single-day planning slot
            </p>
          </div>

          {/* Daily Work Target */}
          <div className="pt-3 md:pt-0 md:px-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
                Daily Study Target
              </span>
              <span className="text-xs font-medium text-[var(--color-text-muted)]">
                {proposedMinutes} / {targetMinutes} min ({utilizationPercent}%)
              </span>
            </div>
            <div className="mt-2">
              <Progress value={utilizationPercent} className="h-2" />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-[var(--color-text-muted)]">
              <span>Max allowed: {maxDailyStudyMinutes ?? 'None'}m</span>
              <span>Proposed: {proposedMinutes}m</span>
            </div>
          </div>

          {/* Calendar Status */}
          <div className="pt-3 md:pt-0 md:pl-4 flex flex-col justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
                Calendar Source
              </span>
              <div className="mt-1 flex items-center gap-2">
                {isExternalCalendarAvailable ? (
                  <Badge variant="success" size="sm">
                    ● Calendar Synced
                  </Badge>
                ) : (
                  <Badge variant="warning" size="sm">
                    ▲ Avenza Only
                  </Badge>
                )}
                <span className="text-xs text-[var(--color-text-muted)]">
                  {proposal.existingCommitments.length} existing commitment(s)
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              Fixed intervals are preserved and cannot be overwritten.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
