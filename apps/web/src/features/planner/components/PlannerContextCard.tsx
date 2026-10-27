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

  const proposedMinutes = totalProposedMinutes;

  const utilizationPercent =
    dailyTargetMinutes > 0
      ? Math.min(100, Math.round((proposedMinutes / dailyTargetMinutes) * 100))
      : 0;

  // The dedicated warning below already explains that Google Calendar
  // is disconnected. Hide duplicate calendar warnings, but preserve
  // other warnings such as provisional task estimates.
  const visibleWarnings = warnings.filter(
    (warning) => isExternalCalendarAvailable || !/google calendar/i.test(warning)
  );

  return (
    <div className="space-y-3">
      {/* Show the Google Calendar warning only once. */}
      {!isExternalCalendarAvailable && (
        <Alert variant="warning" title="Google Calendar Offline">
          Busy intervals could not be verified. This draft accounts for Avenza commitments and
          your study window only. Check your external calendar before applying.
        </Alert>
      )}

      {/* Preserve all other warnings, such as provisional task estimates. */}
      {visibleWarnings.length > 0 && (
        <div className="space-y-1.5">
          {visibleWarnings.map((warning, idx) => (
            <Alert key={`${warning}-${idx}`} variant="info" className="py-2 text-xs">
              {warning}
            </Alert>
          ))}
        </div>
      )}

      <Card className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] overflow-hidden">
        <div className="grid grid-cols-1 divide-y divide-[var(--color-border-subtle)] md:grid-cols-3 md:divide-y-0 md:divide-x">
          {/* Study Window */}
          <div className="flex min-w-0 flex-col gap-1.5 p-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Study Window
            </span>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="whitespace-nowrap text-base font-bold text-[var(--color-text-primary)]">
                {studyWindow.start} – {studyWindow.end}
              </span>

              <Badge variant="secondary" size="sm" className="max-w-full shrink-0 truncate">
                {timezone}
              </Badge>
            </div>

            <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              Deterministic single-day planning slot
            </p>
          </div>

          {/* Daily Study Target */}
          <div className="flex min-w-0 flex-col gap-3 p-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Daily Study Target
            </span>

            <div
              role="progressbar"
              aria-label="Daily study target progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={utilizationPercent}
              className="w-full min-w-0"
            >
              <Progress value={utilizationPercent} compact className="w-full" />
            </div>

            {/* Keep the values readable on narrow screens. */}
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p className="min-w-0 text-xs leading-relaxed text-[var(--color-text-muted)]">
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {proposedMinutes}m
                </span>
                {' proposed of '}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {dailyTargetMinutes}m
                </span>
                {' target'}
              </p>

              <span className="shrink-0 font-mono text-xs font-semibold text-[var(--color-primary)]">
                {utilizationPercent}%
              </span>
            </div>

            <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
              Max allowed:{' '}
              <span className="font-medium text-[var(--color-text-primary)]">
                {maxDailyStudyMinutes != null ? `${maxDailyStudyMinutes}m` : 'No limit'}
              </span>
            </p>
          </div>

          {/* Calendar Source */}
          <div className="flex min-w-0 flex-col gap-1.5 p-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Calendar Source
            </span>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {isExternalCalendarAvailable ? (
                <Badge variant="success" size="sm">
                  ● Calendar Synced
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  ▲ Avenza Only
                </Badge>
              )}

              <span className="text-[11px] text-[var(--color-text-muted)]">
                {proposal.existingCommitments.length} commitment
                {proposal.existingCommitments.length !== 1 ? 's' : ''}
              </span>
            </div>

            <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              Fixed intervals are preserved and cannot be overwritten.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};