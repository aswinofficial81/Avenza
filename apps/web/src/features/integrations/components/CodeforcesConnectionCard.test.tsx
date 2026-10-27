import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CodeforcesConnectionCard } from './CodeforcesConnectionCard';
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

describe('CodeforcesConnectionCard Component', () => {
  const mockConnectDirectMutateAsync = vi.fn();
  const mockSyncMutateAsync = vi.fn();
  const mockDisconnectMutateAsync = vi.fn();

  const mockConnectedData: IntegrationStatusResponseDto = {
    connected: true,
    connection: {
      id: 'conn-cf-1',
      provider: 'codeforces',
      external_account_id: 'tourist',
      external_username: 'tourist',
      external_display_name: 'Gennady Korotkevich',
      external_avatar_url: 'https://userpic.codeforces.org/422/avatar/2b5dbe87f0d859a2.jpg',
      external_email: null,
      status: 'SYNCED',
      scopes: [],
      sync_state: {
        handle: 'tourist',
        rating: 3384,
        maxRating: 4009,
        rank: 'legendary grandmaster',
        maxRank: 'tourist',
        contribution: 112,
        ratedContestsParticipated: 125,
        lastContestId: 2268,
        lastContestName: 'Codeforces Round 1124 (Div. 1)',
        lastContestRank: 1,
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
      id: 'act-cf-1',
      connection_id: 'conn-cf-1',
      repository_id: null,
      provider: 'codeforces',
      external_id: 'submission:392217392',
      activity_type: 'dsa_solve',
      title: 'Solved AghaBalaSar and Hamed',
      summary: 'Solved AghaBalaSar and Hamed (2268D) on Codeforces',
      external_url: 'https://codeforces.com/contest/2268/problem/D',
      metadata: { platform: 'codeforces', contestId: 2268, index: 'D' },
      occurred_at: '2026-10-05T08:00:00.000Z',
      created_at: '2026-10-05T10:00:00.000Z',
      updated_at: '2026-10-05T10:00:00.000Z',
    },
    {
      id: 'act-cf-2',
      connection_id: 'conn-cf-1',
      repository_id: null,
      provider: 'codeforces',
      external_id: 'contest:2268',
      activity_type: 'contest_participation',
      title: 'Competed in Codeforces Round 1124 (Div. 1)',
      summary: 'Finished rank #1 in Codeforces Round 1124 (Div. 1)',
      external_url: 'https://codeforces.com/contest/2268',
      metadata: { platform: 'codeforces', contestId: 2268, rank: 1, ratingChange: 52 },
      occurred_at: '2026-10-05T09:00:00.000Z',
      created_at: '2026-10-05T10:00:00.000Z',
      updated_at: '2026-10-05T10:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: false, connection: null },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

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
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationActivities>);
  });

  it('renders disconnected state with handle input and Connect Account button', () => {
    renderWithToast(<CodeforcesConnectionCard />);

    expect(screen.getByText('Codeforces')).toBeInTheDocument();
    expect(screen.getByText('Not Connected')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. tourist/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect account/i })).toBeInTheDocument();
  });

  it('shows error toast when handle input is empty', () => {
    renderWithToast(<CodeforcesConnectionCard />);

    const connectBtn = screen.getByRole('button', { name: /connect account/i });
    expect(connectBtn).toBeDisabled();
  });

  it('connects Codeforces profile when valid handle is entered', async () => {
    mockConnectDirectMutateAsync.mockResolvedValueOnce({
      ...mockConnectedData.connection,
      external_username: 'tourist',
    });

    renderWithToast(<CodeforcesConnectionCard />);

    const input = screen.getByPlaceholderText(/e.g. tourist/i);
    fireEvent.change(input, { target: { value: 'tourist' } });

    const connectBtn = screen.getByRole('button', { name: /connect account/i });
    expect(connectBtn).not.toBeDisabled();
    fireEvent.click(connectBtn);

    await waitFor(() => {
      expect(mockConnectDirectMutateAsync).toHaveBeenCalledWith({
        provider: 'codeforces',
        handle: 'tourist',
      });
    });
  });

  it('renders connected state with ratings, rank, and activities', () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: mockConnectedData,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    vi.spyOn(hooks, 'useIntegrationActivities').mockReturnValue({
      data: mockActivities,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationActivities>);

    renderWithToast(<CodeforcesConnectionCard />);

    expect(screen.getByText('Gennady Korotkevich')).toBeInTheDocument();
    expect(screen.getByText(/legendary grandmaster/i)).toBeInTheDocument();
    expect(screen.getByText('3384')).toBeInTheDocument();
    expect(screen.getByText('4009')).toBeInTheDocument();
    expect(screen.getByText('125')).toBeInTheDocument();
    expect(screen.getByText('Solved AghaBalaSar and Hamed')).toBeInTheDocument();
    expect(screen.getByText('Competed in Codeforces Round 1124 (Div. 1)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });

  it('triggers manual sync when Sync Now is clicked', async () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: mockConnectedData,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    mockSyncMutateAsync.mockResolvedValueOnce({
      connection: mockConnectedData.connection!,
      job: {
        id: 'job-1',
        user_id: 'user_test_cf',
        provider: 'codeforces',
        job_type: 'sync',
        status: 'COMPLETED',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error_message: null,
        metadata: {},
        created_at: new Date().toISOString(),
      },
      repositories_synced: 0,
      activities_synced: 2,
    });

    renderWithToast(<CodeforcesConnectionCard />);

    const syncBtn = screen.getByRole('button', { name: /sync now/i });
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(mockSyncMutateAsync).toHaveBeenCalledWith('codeforces');
    });
  });

  it('opens confirmation modal and disconnects when confirmed', async () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: mockConnectedData,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    mockDisconnectMutateAsync.mockResolvedValueOnce({
      ...mockConnectedData.connection,
      status: 'DISCONNECTED',
    });

    renderWithToast(<CodeforcesConnectionCard />);

    const disconnectBtn = screen.getByRole('button', { name: /disconnect/i });
    fireEvent.click(disconnectBtn);

    expect(screen.getByText('Disconnect Codeforces Account')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: 'Disconnect Codeforces' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDisconnectMutateAsync).toHaveBeenCalledWith('codeforces');
    });
  });

  it('displays rate limited warning banner when status is RATE_LIMITED', () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: {
        ...mockConnectedData,
        connection: {
          ...mockConnectedData.connection!,
          status: 'RATE_LIMITED',
        },
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<CodeforcesConnectionCard />);

    expect(screen.getByText('Rate Limited')).toBeInTheDocument();
    expect(screen.getByText(/Codeforces API Limit Reached/i)).toBeInTheDocument();
  });
});
