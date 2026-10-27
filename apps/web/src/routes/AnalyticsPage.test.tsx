import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnalyticsPage } from './AnalyticsPage';
import * as analyticsHooks from '../features/analytics/useAnalyticsSummary';
import type { AnalyticsSummaryDto } from '@avenza/shared';

const mockAnalyticsData: AnalyticsSummaryDto = {
  period: {
    startDate: '2026-10-12',
    endDate: '2026-10-18',
    timezone: 'Asia/Kolkata',
    startUtc: '2026-10-11T18:30:00.000Z',
    endUtc: '2026-10-18T18:30:00.000Z',
    asOf: '2026-10-18T01:00:00.000Z',
  },
  execution: {
    completedTaskCount: 8,
    openTasksDueInPeriodCount: 2,
    completionRate: 80.0,
    zeroDemand: false,
    currentOverdueCount: 3,
    completedByPriority: {
      critical: 2,
      high: 3,
      medium: 2,
      low: 1,
    },
    completedByType: {
      study: 4,
      practice: 2,
      revision: 1,
      assignment: 1,
      exam_preparation: 0,
      dsa: 0,
      project: 0,
      career: 0,
      administrative: 0,
      personal: 0,
      custom: 0,
    },
  },
  focus: {
    recordedFocusMinutes: 240,
    completedSessionCount: 4,
    cancelledSessionCount: 1,
    averageSessionMinutes: 60.0,
    dailyDistribution: [
      { date: '2026-10-12', focusMinutes: 60, completedSessionCount: 1 },
      { date: '2026-10-13', focusMinutes: 0, completedSessionCount: 0 },
      { date: '2026-10-14', focusMinutes: 90, completedSessionCount: 1 },
      { date: '2026-10-15', focusMinutes: 45, completedSessionCount: 1 },
      { date: '2026-10-16', focusMinutes: 0, completedSessionCount: 0 },
      { date: '2026-10-17', focusMinutes: 45, completedSessionCount: 1 },
      { date: '2026-10-18', focusMinutes: 0, completedSessionCount: 0 },
    ],
  },
  dsa: {
    totalAttempts: 5,
    uniqueProblemsSolved: 2,
    solvedByDifficulty: {
      easy: 1,
      medium: 1,
      hard: 0,
    },
    currentRevisionDueCount: 4,
  },
  growth: {
    newEvidenceCount: 3,
    completedGoalMilestonesCount: 2,
    completedProjectMilestonesCount: 1,
    currentActiveGoalsCount: 3,
  },
};

const mockZeroDemandData: AnalyticsSummaryDto = {
  ...mockAnalyticsData,
  execution: {
    completedTaskCount: 0,
    openTasksDueInPeriodCount: 0,
    completionRate: null,
    zeroDemand: true,
    currentOverdueCount: 0,
    completedByPriority: { critical: 0, high: 0, medium: 0, low: 0 },
    completedByType: {
      study: 0,
      practice: 0,
      revision: 0,
      assignment: 0,
      exam_preparation: 0,
      dsa: 0,
      project: 0,
      career: 0,
      administrative: 0,
      personal: 0,
      custom: 0,
    },
  },
  focus: {
    recordedFocusMinutes: 0,
    completedSessionCount: 0,
    cancelledSessionCount: 0,
    averageSessionMinutes: null,
    dailyDistribution: [],
  },
  dsa: {
    totalAttempts: 0,
    uniqueProblemsSolved: 0,
    solvedByDifficulty: { easy: 0, medium: 0, hard: 0 },
    currentRevisionDueCount: 0,
  },
  growth: {
    newEvidenceCount: 0,
    completedGoalMilestonesCount: 0,
    completedProjectMilestonesCount: 0,
    currentActiveGoalsCount: 0,
  },
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('AnalyticsPage Route (/analytics)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders analytics dashboard and no longer renders PlaceholderPage', () => {
    vi.spyOn(analyticsHooks, 'useAnalyticsSummary').mockReturnValue({
      data: mockAnalyticsData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof analyticsHooks.useAnalyticsSummary>);

    renderWithClient(<AnalyticsPage />);

    expect(screen.getByText('Analytics & Diagnostics')).toBeInTheDocument();
    expect(screen.queryByText('Personal velocity, focus metrics, and productivity diagnostics.')).not.toBeInTheDocument();
    expect(screen.queryByText('Analytics Phase')).not.toBeInTheDocument();
    expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
  });

  it('renders core summary metrics from real response shape', () => {
    vi.spyOn(analyticsHooks, 'useAnalyticsSummary').mockReturnValue({
      data: mockAnalyticsData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof analyticsHooks.useAnalyticsSummary>);

    renderWithClient(<AnalyticsPage />);

    // Tasks Completed: 8
    expect(screen.getByTestId('tasks-completed-value')).toHaveTextContent('8');
    // Completion rate: 80%
    expect(screen.getByTestId('completion-rate-value')).toHaveTextContent('80%');
    // Current overdue: 3
    expect(screen.getByTestId('current-overdue-value')).toHaveTextContent('3');
    // Recorded focus: 4h 0m
    expect(screen.getByTestId('recorded-focus-value')).toHaveTextContent('4h 0m');
    // Unique DSA Solves: 2
    expect(screen.getByTestId('dsa-solved-value')).toHaveTextContent('2');
  });

  it('labels current overdue backlog distinctly from selected-period metrics', () => {
    vi.spyOn(analyticsHooks, 'useAnalyticsSummary').mockReturnValue({
      data: mockAnalyticsData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof analyticsHooks.useAnalyticsSummary>);

    renderWithClient(<AnalyticsPage />);

    expect(screen.getByText('Overdue Backlog')).toBeInTheDocument();
    expect(screen.getAllByText('Current').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Unresolved open tasks due before now')).toBeInTheDocument();
  });

  it('displays completion rate explanation footnote including the inbox due date policy', () => {
    vi.spyOn(analyticsHooks, 'useAnalyticsSummary').mockReturnValue({
      data: mockAnalyticsData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof analyticsHooks.useAnalyticsSummary>);

    renderWithClient(<AnalyticsPage />);

    expect(screen.getByText(/Completion Rate formula:/)).toBeInTheDocument();
    expect(screen.getByText(/Inbox tasks are included only when assigned a due date in this period/)).toBeInTheDocument();
  });

  it('handles zero demand and null completion rate gracefully without crashing', () => {
    vi.spyOn(analyticsHooks, 'useAnalyticsSummary').mockReturnValue({
      data: mockZeroDemandData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof analyticsHooks.useAnalyticsSummary>);

    renderWithClient(<AnalyticsPage />);

    expect(screen.getByTestId('completion-rate-value')).toHaveTextContent('—');
    expect(screen.getByText('No demand in period')).toBeInTheDocument();
  });

  it('switches date presets and updates the query range', () => {
    const useSummarySpy = vi.spyOn(analyticsHooks, 'useAnalyticsSummary').mockReturnValue({
      data: mockAnalyticsData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof analyticsHooks.useAnalyticsSummary>);

    renderWithClient(<AnalyticsPage />);

    // Switch to Last 30 Days
    const preset30d = screen.getByTestId('preset-30d');
    fireEvent.click(preset30d);

    // Switch to This Month
    const presetMonth = screen.getByTestId('preset-month');
    fireEvent.click(presetMonth);

    // Switch back to Last 7 Days
    const preset7d = screen.getByTestId('preset-7d');
    fireEvent.click(preset7d);

    expect(useSummarySpy).toHaveBeenCalled();
  });

  it('renders loading skeleton state when isLoading is true', () => {
    vi.spyOn(analyticsHooks, 'useAnalyticsSummary').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: true,
    } as unknown as ReturnType<typeof analyticsHooks.useAnalyticsSummary>);

    renderWithClient(<AnalyticsPage />);

    expect(screen.getByTestId('analytics-loading-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('analytics-dashboard')).not.toBeInTheDocument();
  });

  it('renders ErrorState with retry button when isError is true', () => {
    const refetchMock = vi.fn();
    vi.spyOn(analyticsHooks, 'useAnalyticsSummary').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network timeout'),
      refetch: refetchMock,
      isFetching: false,
    } as unknown as ReturnType<typeof analyticsHooks.useAnalyticsSummary>);

    renderWithClient(<AnalyticsPage />);

    expect(screen.getByTestId('analytics-error-state')).toBeInTheDocument();
    expect(screen.getByText('Failed to Load Analytics')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(refetchMock).toHaveBeenCalled();
  });

  it('renders daily focus distribution and wall-clock disclaimer', () => {
    vi.spyOn(analyticsHooks, 'useAnalyticsSummary').mockReturnValue({
      data: mockAnalyticsData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof analyticsHooks.useAnalyticsSummary>);

    renderWithClient(<AnalyticsPage />);

    expect(screen.getByText('Focus & Deep Work Diagnostics')).toBeInTheDocument();
    expect(screen.getByText('60m')).toBeInTheDocument(); // avg session
    expect(screen.getByText(/measures elapsed wall-clock duration/)).toBeInTheDocument();
  });

  it('renders DSA unique solves and revision backlog current snapshot', () => {
    vi.spyOn(analyticsHooks, 'useAnalyticsSummary').mockReturnValue({
      data: mockAnalyticsData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof analyticsHooks.useAnalyticsSummary>);

    renderWithClient(<AnalyticsPage />);

    expect(screen.getByText('DSA Problem Solving & Retention')).toBeInTheDocument();
    expect(screen.getByText('Revision Workload Due')).toBeInTheDocument();
    expect(screen.getByTestId('dsa-revision-due-value')).toHaveTextContent('4');
    expect(screen.getByText('Deduplicated Solves')).toBeInTheDocument();
  });

  it('renders milestones, evidence, and mastery omission notice', () => {
    vi.spyOn(analyticsHooks, 'useAnalyticsSummary').mockReturnValue({
      data: mockAnalyticsData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof analyticsHooks.useAnalyticsSummary>);

    renderWithClient(<AnalyticsPage />);

    expect(screen.getByText('Milestones & Verified Evidence')).toBeInTheDocument();
    expect(screen.getByText('New Evidence')).toBeInTheDocument();
    expect(screen.getByText('Goal Milestones')).toBeInTheDocument();
    expect(screen.getByText('Project Milestones')).toBeInTheDocument();
    expect(screen.getByText(/Skill Mastery Notice:/)).toBeInTheDocument();
    expect(screen.getByText(/Historical mastery time series are omitted because prior snapshots were not stored/)).toBeInTheDocument();
  });
});
