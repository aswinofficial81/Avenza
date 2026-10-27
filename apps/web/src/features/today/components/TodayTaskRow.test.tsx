import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { TodayTaskRow } from './TodayTaskRow';
import type { TodayTaskItem } from '@avenza/shared';

const mockBlockedTask: TodayTaskItem = {
  id: 'task-blocked-1',
  user_id: 'user_123',
  title: 'Blocked Database Migration',
  description: null,
  status: 'planned',
  priority: 'high',
  task_type: 'project',
  goal_id: 'goal-1',
  goal_title: 'Infrastructure Upgrade',
  milestone_id: 'ms-1',
  milestone_title: 'Database V2',
  estimated_minutes: 60,
  actual_minutes: null,
  due_at: '2026-10-15T10:00:00.000Z',
  scheduled_start: null,
  scheduled_end: null,
  completed_at: null,
  notes: null,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
  is_blocked: true,
  blocking_task_count: 2,
  blocked_by: [
    { id: 'task-prereq-1', title: 'Backup DB', status: 'planned' },
    { id: 'task-prereq-2', title: 'Provision Node', status: 'planned' },
  ],
  metrics: {
    is_blocked: true,
    blocking_task_count: 2,
    blocked_by: [
      { id: 'task-prereq-1', title: 'Backup DB', status: 'planned' },
      { id: 'task-prereq-2', title: 'Provision Node', status: 'planned' },
    ],
  },
};

const mockUnblockedTask: TodayTaskItem = {
  id: 'task-unblocked-2',
  user_id: 'user_123',
  title: 'Unblocked Unit Tests',
  description: null,
  status: 'planned',
  priority: 'medium',
  task_type: 'practice',
  goal_id: null,
  goal_title: null,
  milestone_id: null,
  milestone_title: null,
  estimated_minutes: 30,
  actual_minutes: null,
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

function renderRow(props: Partial<Parameters<typeof TodayTaskRow>[0]> = {}) {
  const onComplete = vi.fn();
  const onDefer = vi.fn();
  const onSkip = vi.fn();
  const onStartFocus = vi.fn();

  const defaultProps = {
    task: mockUnblockedTask,
    onComplete,
    onDefer,
    onSkip,
    onStartFocus,
    activeFocusTaskId: null,
    isActionLoading: false,
    ...props,
  };

  const result = render(
    <BrowserRouter>
      <TodayTaskRow {...defaultProps} />
    </BrowserRouter>
  );

  return { ...result, onComplete, onDefer, onSkip, onStartFocus };
}

describe('TodayTaskRow Component', () => {
  it('disables completion button and provides accessible label/title when task is blocked', () => {
    const { onComplete } = renderRow({ task: mockBlockedTask });

    const completeBtn = screen.getByRole('button', {
      name: 'Cannot complete: task has incomplete prerequisites',
    });
    expect(completeBtn).toBeDisabled();
    expect(completeBtn).toHaveAttribute(
      'title',
      'Cannot complete: task has incomplete prerequisites'
    );

    fireEvent.click(completeBtn);
    expect(onComplete).not.toHaveBeenCalled();

    // Blocked badge is rendered
    expect(screen.getByText('Blocked (2)')).toBeInTheDocument();
  });

  it('allows completion toggle when task is unblocked', () => {
    const { onComplete } = renderRow({ task: mockUnblockedTask });

    const completeBtn = screen.getByRole('button', {
      name: 'Mark task as completed',
    });
    expect(completeBtn).not.toBeDisabled();
    expect(completeBtn).toHaveAttribute('title', 'Mark task as completed');

    fireEvent.click(completeBtn);
    expect(onComplete).toHaveBeenCalledWith('task-unblocked-2');
  });

  it('does not disable unrelated actions (defer, skip) when task is blocked', () => {
    const { onDefer, onSkip } = renderRow({ task: mockBlockedTask });

    const deferBtn = screen.getByRole('button', { name: /Defer/i });
    expect(deferBtn).not.toBeDisabled();
    fireEvent.click(deferBtn);
    expect(onDefer).toHaveBeenCalledWith('task-blocked-1');

    const skipBtn = screen.getByRole('button', { name: /Skip/i });
    expect(skipBtn).not.toBeDisabled();
    fireEvent.click(skipBtn);
    expect(onSkip).toHaveBeenCalledWith('task-blocked-1');
  });

  it('disables completion button when isActionLoading is true even if task is unblocked', () => {
    const { onComplete } = renderRow({ task: mockUnblockedTask, isActionLoading: true });

    const completeBtn = screen.getByRole('button', {
      name: 'Mark task as completed',
    });
    expect(completeBtn).toBeDisabled();
    fireEvent.click(completeBtn);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('renders completed task with Completed label and allows interaction', () => {
    const completedTask: TodayTaskItem = {
      ...mockUnblockedTask,
      status: 'completed',
    };

    const { onComplete } = renderRow({ task: completedTask });

    const completeBtn = screen.getByRole('button', {
      name: 'Completed task',
    });
    expect(completeBtn).not.toBeDisabled();
    fireEvent.click(completeBtn);
    expect(onComplete).toHaveBeenCalledWith('task-unblocked-2');
  });
});
