import React, { useState, useMemo } from 'react';
import { BarChart3, Calendar, RotateCcw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { Card, CardContent } from '../components/ui/Card';
import { useAnalyticsSummary } from '../features/analytics/useAnalyticsSummary';
import {
  AnalyticsSummaryCards,
  AnalyticsFocusSection,
  AnalyticsDsaSection,
  AnalyticsGrowthSection,
  AnalyticsExecutionBreakdown,
} from '../features/analytics/components';

export type AnalyticsPreset = '7d' | '30d' | 'month';

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const AnalyticsPage: React.FC = () => {
  const [preset, setPreset] = useState<AnalyticsPreset>('7d');

  const userTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  }, []);

  // Compute dates based on preset
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const endStr = formatLocalDate(now);

    if (preset === '30d') {
      const past = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      return { startDate: formatLocalDate(past), endDate: endStr };
    }

    if (preset === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: formatLocalDate(startOfMonth), endDate: endStr };
    }

    // Default '7d'
    const past7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { startDate: formatLocalDate(past7), endDate: endStr };
  }, [preset]);

  const { data, isLoading, isError, error, refetch, isFetching } = useAnalyticsSummary(
    startDate,
    endDate,
    userTimezone
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            Analytics & Diagnostics
          </h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span>
              {startDate} to {endDate}
            </span>
            <span>•</span>
            <span className="font-semibold text-foreground/80">
              {data?.period?.timezone || userTimezone}
            </span>
          </p>
        </div>

        {/* Date presets & refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border-subtle p-0.5 bg-muted/20">
            <Button
              variant={preset === '7d' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs h-7 px-2.5"
              onClick={() => setPreset('7d')}
              data-testid="preset-7d"
            >
              Last 7 Days
            </Button>
            <Button
              variant={preset === '30d' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs h-7 px-2.5"
              onClick={() => setPreset('30d')}
              data-testid="preset-30d"
            >
              Last 30 Days
            </Button>
            <Button
              variant={preset === 'month' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs h-7 px-2.5"
              onClick={() => setPreset('month')}
              data-testid="preset-month"
            >
              This Month
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 px-2"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh analytics data"
            data-testid="refresh-button"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-6" data-testid="analytics-loading-skeleton">
          {/* Summary Stat Skeletons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Section Skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : isError ? (
        <div className="py-8" data-testid="analytics-error-state">
          <ErrorState
            title="Failed to Load Analytics"
            description={
              error instanceof Error
                ? error.message
                : 'An unexpected error occurred while fetching your analytics data.'
            }
            onRetry={() => refetch()}
          />
        </div>
      ) : data ? (
        <div className="space-y-6" data-testid="analytics-dashboard">
          {/* 1. Core Summary Cards */}
          <AnalyticsSummaryCards data={data} />

          {/* 2. Focus & DSA Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalyticsFocusSection focus={data.focus} />
            <AnalyticsDsaSection dsa={data.dsa} />
          </div>

          {/* 3. Milestones & Execution Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalyticsGrowthSection growth={data.growth} />
            <AnalyticsExecutionBreakdown execution={data.execution} />
          </div>
        </div>
      ) : null}
    </div>
  );
};
