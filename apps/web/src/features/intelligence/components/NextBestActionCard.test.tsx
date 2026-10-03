import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { NextBestActionCard } from './NextBestActionCard';
import type { NextActionResponseData, TodayTaskItem } from '@avenza/shared';

const mockActionData: NextActionResponseData = {
  action: {
    type: 'focus_task',
    taskId: '11111111-2222-3333-4444-555555555555',
    title: 'Practice Binary Search Patterns',
    score: 85,
    goalId: 'goal-1',
    goalTitle: 'DSA Mastery',
    milestoneId: 'ms-1',
    milestoneTitle: 'Binary Search',
    priority: 'high',
    taskType: 'dsa',
    status: 'planned',
    dueAt: '2026-10-03T18:00:00.000Z',
    estimatedMinutes: 45,
  },
  reason: {
    code: 'due_today',
    label: 'Due today',
    explanation: 'This task is due today and is currently actionable.',
  },
  confidence: 'high',
  generatedAt: '2026-10-03T10:00:00.000Z',
  scoreBreakdown: {
    prioritySignal: 30,
    urgencySignal: 20,
    goalSignal: 15,
    dependencySignal: 0,
    scheduleSignal: 15,
    continuationSignal: 0,
    stalenessSignal: 0,
    totalScore: 80,
  },
};

describe('NextBestActionCard Component', () => {
  it('renders loading skeleton when isLoading is true and no fallback task', () => {
    const { container } = render(
      <BrowserRouter>
        <NextBestActionCard isLoading={true} />
      </BrowserRouter>
    );

    expect(screen.queryByText('Practice Binary Search Patterns')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state and invokes onRetry when retry button clicked', () => {
    const onRetry = vi.fn();
    render(
      <BrowserRouter>
        <NextBestActionCard
          isError={true}
          error={new Error('Failed to evaluate signals')}
          onRetry={onRetry}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Unable to compute Next Best Action')).toBeInTheDocument();
    expect(screen.getByText('Failed to evaluate signals')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders calm empty state when no action is available', () => {
    const noActionData: NextActionResponseData = {
      action: null,
      reason: {
        code: 'no_actionable_tasks',
        label: 'Nothing urgent',
        explanation: 'There are no actionable tasks available right now.',
      },
      confidence: 'high',
      generatedAt: '2026-10-03T10:00:00.000Z',
      scoreBreakdown: null,
    };

    render(
      <BrowserRouter>
        <NextBestActionCard data={noActionData} />
      </BrowserRouter>
    );

    expect(screen.getByText('All Clear')).toBeInTheDocument();
    expect(screen.getByText('There are no actionable tasks available right now.')).toBeInTheDocument();
  });

  it('renders recommendation with reason, confidence, explanation, and metadata', () => {
    render(
      <BrowserRouter>
        <NextBestActionCard data={mockActionData} />
      </BrowserRouter>
    );

    expect(screen.getByText('Next Best Action')).toBeInTheDocument();
    expect(screen.getByText('Practice Binary Search Patterns')).toBeInTheDocument();
    expect(screen.getByText('Due today')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText(/This task is due today and is currently actionable/i)).toBeInTheDocument();
    expect(screen.getByText('DSA Mastery')).toBeInTheDocument();
    expect(screen.getByText('› Binary Search')).toBeInTheDocument();
    expect(screen.getByText('45m est')).toBeInTheDocument();
  });

  it('triggers onStartFocus when Start Focus CTA is clicked', () => {
    const onStartFocus = vi.fn();
    render(
      <BrowserRouter>
        <NextBestActionCard data={mockActionData} onStartFocus={onStartFocus} />
      </BrowserRouter>
    );

    const startFocusBtn = screen.getByRole('button', { name: /Start Focus/i });
    fireEvent.click(startFocusBtn);

    expect(onStartFocus).toHaveBeenCalledWith({
      id: '11111111-2222-3333-4444-555555555555',
      title: 'Practice Binary Search Patterns',
    });
  });

  it('triggers onComplete when Complete button is clicked', () => {
    const onComplete = vi.fn();
    render(
      <BrowserRouter>
        <NextBestActionCard data={mockActionData} onComplete={onComplete} />
      </BrowserRouter>
    );

    const completeBtn = screen.getByRole('button', { name: /Complete/i });
    fireEvent.click(completeBtn);

    expect(onComplete).toHaveBeenCalledWith('11111111-2222-3333-4444-555555555555');
  });

  it('renders seamless fallback task when intelligence query is pending', () => {
    const fallbackTask: TodayTaskItem = {
      id: 'fallback-task-1',
      user_id: 'user-1',
      title: 'Fallback Task Title',
      description: null,
      status: 'planned',
      priority: 'critical',
      task_type: 'study',
      goal_id: 'goal-fallback',
      goal_title: 'Algorithms',
      milestone_id: null,
      milestone_title: null,
      estimated_minutes: 60,
      actual_minutes: 0,
      due_at: null,
      scheduled_start: null,
      scheduled_end: null,
      completed_at: null,
      notes: null,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
      is_blocked: false,
      blocking_task_count: 0,
      blocked_by: [],
      metrics: {
        is_blocked: false,
        blocking_task_count: 0,
        blocked_by: [],
      },
    };

    render(
      <BrowserRouter>
        <NextBestActionCard fallbackTask={fallbackTask} isLoading={true} />
      </BrowserRouter>
    );

    expect(screen.getByText('Fallback Task Title')).toBeInTheDocument();
    expect(screen.getByText('Next Best Action')).toBeInTheDocument();
    expect(screen.getByText('Next Up')).toBeInTheDocument();
    expect(screen.getByText('Algorithms')).toBeInTheDocument();
  });
});
