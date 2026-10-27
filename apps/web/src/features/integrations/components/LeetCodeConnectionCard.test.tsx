import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LeetCodeConnectionCard } from './LeetCodeConnectionCard';
import * as hooks from '../hooks/useIntegrations';
import { ToastProvider } from '../../../components/ui/Toast';
import type {
  ExternalActivityDto,
  IntegrationConnectionDto,
  IntegrationStatusResponseDto,
} from '@avenza/shared';

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('LeetCodeConnectionCard Component', () => {
  const mockConnectDirectMutateAsync = vi.fn();
  const mockSyncMutateAsync = vi.fn();
  const mockDisconnectMutateAsync = vi.fn();

  const mockConnectedData: IntegrationStatusResponseDto = {
    connected: true,
    connection: {
      id: 'conn-lc-1',
      provider: 'leetcode',
      external_account_id: 'aswinofficial81',
      external_username: 'aswinofficial81',
      external_display_name: 'Aswin Babu',
      external_avatar_url: 'https://assets.leetcode.com/users/aswinofficial81/avatar.png',
      external_email: null,
      status: 'SYNCED',
      scopes: [],
      sync_state: {
        totalSolved: 185,
        easySolved: 95,
        mediumSolved: 78,
        hardSolved: 12,
        ranking: 154200,
        contestRating: 1646,
        attendedContests: 8,
      },
      last_synced_at: '2026-10-05T10:00:00.000Z',
      last_sync_started_at: '2026-10-05T09:59:50.000Z',
      last_sync_completed_at: '2026-10-05T10:00:00.000Z',
      last_error_code: null,
      last_error_message: null,
      connected_at: '2026-10-05T09:00:00.000Z',
      created_at: '2026-10-05T09:00:00.000Z',
      updated_at: '2026-10-05T10:00:00.000Z',
    } as IntegrationConnectionDto,
  };

  const mockActivities: ExternalActivityDto[] = [
    {
      id: 'act-lc-1',
      connection_id: 'conn-lc-1',
      repository_id: null,
      provider: 'leetcode',
      external_id: 'submission:1145293812',
      activity_type: 'dsa_solve',
      occurred_at: '2026-10-05T09:30:00.000Z',
      title: 'Solved Two Sum',
      summary: 'Solved on LeetCode: Two Sum',
      external_url: 'https://leetcode.com/problems/two-sum/',
      metadata: { platform: 'leetcode', titleSlug: 'two-sum', submissionId: '1145293812' },
      created_at: '2026-10-05T10:00:00.000Z',
      updated_at: '2026-10-05T10:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(hooks, 'useConnectDirectIntegration').mockReturnValue({
      mutateAsync: mockConnectDirectMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof hooks.useConnectDirectIntegration>);

    vi.spyOn(hooks, 'useSyncIntegration').mockReturnValue({
      mutateAsync: mockSyncMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof hooks.useSyncIntegration>);

    vi.spyOn(hooks, 'useDisconnectIntegration').mockReturnValue({
      mutateAsync: mockDisconnectMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof hooks.useDisconnectIntegration>);

    vi.spyOn(hooks, 'useIntegrationActivities').mockReturnValue({
      data: mockActivities,
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useIntegrationActivities>);
  });

  it('renders loading state', () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<LeetCodeConnectionCard />);
    expect(screen.getByText('Checking LeetCode connection status...')).toBeInTheDocument();
  });

  it('renders error state when status query fails', () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<LeetCodeConnectionCard />);
    expect(screen.getByText('Failed to load LeetCode integration status.')).toBeInTheDocument();
  });

  it('renders disconnected state with username input and Connect button', () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: false, connection: null },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<LeetCodeConnectionCard />);
    expect(screen.getByText('LeetCode')).toBeInTheDocument();
    expect(screen.getByText('Not Connected')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. aswinofficial81')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect Account/i })).toBeInTheDocument();
  });

  it('connects account when username is entered and form is submitted', async () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: false, connection: null },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    mockConnectDirectMutateAsync.mockResolvedValueOnce({
      external_username: 'aswinofficial81',
    });

    renderWithToast(<LeetCodeConnectionCard />);

    const input = screen.getByPlaceholderText('e.g. aswinofficial81');
    fireEvent.change(input, { target: { value: 'aswinofficial81' } });

    const submitBtn = screen.getByRole('button', { name: /Connect Account/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockConnectDirectMutateAsync).toHaveBeenCalledWith({
        provider: 'leetcode',
        username: 'aswinofficial81',
      });
    });
  });

  it('renders connected state with solved statistics, contest rating, and ranking', () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: mockConnectedData,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<LeetCodeConnectionCard />);

    expect(screen.getByText('@aswinofficial81')).toBeInTheDocument();
    expect(screen.getByText('Synced')).toBeInTheDocument();

    // Check solved chips
    expect(screen.getByText('185')).toBeInTheDocument(); // Total
    expect(screen.getByText('95')).toBeInTheDocument(); // Easy
    expect(screen.getByText('78')).toBeInTheDocument(); // Medium
    expect(screen.getByText('12')).toBeInTheDocument(); // Hard

    // Check contest & rank
    expect(screen.getByText('1646')).toBeInTheDocument();
    expect(screen.getByText(/Global Rank/i)).toBeInTheDocument();

    // Check actions & recent solves
    expect(screen.getByRole('button', { name: /Sync Now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument();
    expect(screen.getByText('Solved Two Sum')).toBeInTheDocument();
  });

  it('triggers manual sync when Sync Now is clicked', async () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: mockConnectedData,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    mockSyncMutateAsync.mockResolvedValueOnce({
      activities_synced: 1,
    });

    renderWithToast(<LeetCodeConnectionCard />);

    const syncBtn = screen.getByRole('button', { name: /Sync Now/i });
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(mockSyncMutateAsync).toHaveBeenCalledWith('leetcode');
    });
  });

  it('opens confirmation dialog and disconnects when confirmed', async () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: mockConnectedData,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    mockDisconnectMutateAsync.mockResolvedValueOnce({});

    renderWithToast(<LeetCodeConnectionCard />);

    const disconnectBtn = screen.getByRole('button', { name: /Disconnect/i });
    fireEvent.click(disconnectBtn);

    expect(screen.getByText('Disconnect LeetCode Account')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Disconnect Account' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDisconnectMutateAsync).toHaveBeenCalledWith('leetcode');
    });
  });
});
