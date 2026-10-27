import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GitHubConnectionCard } from './GitHubConnectionCard';
import * as hooks from '../hooks/useIntegrations';
import { ToastProvider } from '../../../components/ui/Toast';
import type {
  ExternalRepositoryDto,
  ExternalActivityDto,
  IntegrationConnectionDto,
  IntegrationStatusResponseDto,
} from '@avenza/shared';

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('GitHubConnectionCard Component', () => {
  const mockConnectMutateAsync = vi.fn();
  const mockSyncMutateAsync = vi.fn();
  const mockDisconnectMutateAsync = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(hooks, 'useConnectIntegration').mockReturnValue({
      mutateAsync: mockConnectMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof hooks.useConnectIntegration>);

    vi.spyOn(hooks, 'useSyncIntegration').mockReturnValue({
      mutateAsync: mockSyncMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof hooks.useSyncIntegration>);

    vi.spyOn(hooks, 'useDisconnectIntegration').mockReturnValue({
      mutateAsync: mockDisconnectMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof hooks.useDisconnectIntegration>);

    vi.spyOn(hooks, 'useIntegrationRepositories').mockReturnValue({
      data: [] as ExternalRepositoryDto[],
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useIntegrationRepositories>);

    vi.spyOn(hooks, 'useIntegrationActivities').mockReturnValue({
      data: [] as ExternalActivityDto[],
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useIntegrationActivities>);
  });

  it('renders loading state correctly', () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<GitHubConnectionCard />);
    expect(screen.getByText('Loading GitHub integration status...')).toBeInTheDocument();
  });

  it('renders error state when status query fails', () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<GitHubConnectionCard />);
    expect(screen.getByText('Failed to load GitHub integration details.')).toBeInTheDocument();
  });

  it('renders Not Connected state with Connect GitHub CTA when disconnected', () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: false, connection: null },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<GitHubConnectionCard />);

    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Not Connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect github/i })).toBeInTheDocument();
  });

  it('initiates OAuth flow when Connect GitHub button is clicked', async () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: false, connection: null },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    mockConnectMutateAsync.mockResolvedValueOnce({
      authorization_url: 'https://github.com/login/oauth/authorize?mock=1',
      state: 'mock-state',
    });

    renderWithToast(<GitHubConnectionCard />);

    const connectButton = screen.getByRole('button', { name: /connect github/i });
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(mockConnectMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'github' })
      );
    });
  });

  it('renders Connected and Synced state with username, stats, and actions', () => {
    const mockConnection: IntegrationConnectionDto = {
      id: 'conn-1',
      provider: 'github',
      external_account_id: '583231',
      external_username: 'octocat',
      external_display_name: 'The Octocat',
      external_avatar_url: 'https://github.com/images/error/octocat_happy.gif',
      external_email: 'octocat@github.com',
      status: 'SYNCED',
      scopes: ['read:user', 'repo'],
      last_synced_at: '2026-10-04T12:00:00.000Z',
      last_sync_started_at: '2026-10-04T11:59:00.000Z',
      last_sync_completed_at: '2026-10-04T12:00:00.000Z',
      last_error_code: null,
      last_error_message: null,
      connected_at: '2026-10-01T00:00:00.000Z',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-04T12:00:00.000Z',
    };

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: true, connection: mockConnection } as IntegrationStatusResponseDto,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<GitHubConnectionCard />);

    expect(screen.getByText('Synced')).toBeInTheDocument();
    expect(screen.getByText('@octocat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });

  it('triggers manual sync when Sync Now is clicked', async () => {
    const mockConnection: IntegrationConnectionDto = {
      id: 'conn-1',
      provider: 'github',
      external_account_id: '583231',
      external_username: 'octocat',
      external_display_name: 'The Octocat',
      external_avatar_url: null,
      external_email: null,
      status: 'SYNCED',
      scopes: ['read:user'],
      last_synced_at: '2026-10-04T12:00:00.000Z',
      last_sync_started_at: null,
      last_sync_completed_at: null,
      last_error_code: null,
      last_error_message: null,
      connected_at: '2026-10-01T00:00:00.000Z',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-04T12:00:00.000Z',
    };

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: true, connection: mockConnection } as IntegrationStatusResponseDto,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    mockSyncMutateAsync.mockResolvedValueOnce({
      connection: mockConnection,
      job: { id: 'job-1', status: 'SUCCESS' },
      repositories_synced: 5,
      activities_synced: 12,
    });

    renderWithToast(<GitHubConnectionCard />);

    const syncButton = screen.getByRole('button', { name: /sync now/i });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(mockSyncMutateAsync).toHaveBeenCalledWith('github');
    });
  });

  it('renders Syncing state when status is SYNCING', () => {
    const mockConnection: IntegrationConnectionDto = {
      id: 'conn-1',
      provider: 'github',
      external_account_id: '583231',
      external_username: 'octocat',
      external_display_name: null,
      external_avatar_url: null,
      external_email: null,
      status: 'SYNCING',
      scopes: ['read:user'],
      last_synced_at: null,
      last_sync_started_at: '2026-10-04T12:00:00.000Z',
      last_sync_completed_at: null,
      last_error_code: null,
      last_error_message: null,
      connected_at: '2026-10-01T00:00:00.000Z',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-04T12:00:00.000Z',
    };

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: true, connection: mockConnection } as IntegrationStatusResponseDto,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<GitHubConnectionCard />);

    expect(screen.getByText('Syncing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /syncing\.\.\./i })).toBeDisabled();
  });

  it('opens confirmation modal and executes disconnect on confirmation', async () => {
    const mockConnection: IntegrationConnectionDto = {
      id: 'conn-1',
      provider: 'github',
      external_account_id: '583231',
      external_username: 'octocat',
      external_display_name: null,
      external_avatar_url: null,
      external_email: null,
      status: 'CONNECTED',
      scopes: ['read:user'],
      last_synced_at: null,
      last_sync_started_at: null,
      last_sync_completed_at: null,
      last_error_code: null,
      last_error_message: null,
      connected_at: '2026-10-01T00:00:00.000Z',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-04T12:00:00.000Z',
    };

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: true, connection: mockConnection } as IntegrationStatusResponseDto,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    mockDisconnectMutateAsync.mockResolvedValueOnce({
      ...mockConnection,
      status: 'DISCONNECTED',
    });

    renderWithToast(<GitHubConnectionCard />);

    const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
    fireEvent.click(disconnectButton);

    // Modal should now be open
    expect(screen.getByText('Disconnect GitHub Account')).toBeInTheDocument();
    expect(screen.getByText(/stored credentials will be revoked/i)).toBeInTheDocument();

    // Click confirm in the modal
    const confirmButtons = screen.getAllByRole('button', { name: /disconnect/i });
    const modalConfirmBtn = confirmButtons[confirmButtons.length - 1];
    expect(modalConfirmBtn).toBeDefined();
    fireEvent.click(modalConfirmBtn!);

    await waitFor(() => {
      expect(mockDisconnectMutateAsync).toHaveBeenCalledWith('github');
    });
  });

  it('renders Rate Limited warning when status is RATE_LIMITED', () => {
    const mockConnection: IntegrationConnectionDto = {
      id: 'conn-1',
      provider: 'github',
      external_account_id: '583231',
      external_username: 'octocat',
      external_display_name: null,
      external_avatar_url: null,
      external_email: null,
      status: 'RATE_LIMITED',
      scopes: ['read:user'],
      last_synced_at: null,
      last_sync_started_at: null,
      last_sync_completed_at: null,
      last_error_code: 'RATE_LIMITED',
      last_error_message: 'GitHub rate limit exceeded. Reset in 45 minutes.',
      connected_at: '2026-10-01T00:00:00.000Z',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-04T12:00:00.000Z',
    };

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: true, connection: mockConnection } as IntegrationStatusResponseDto,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<GitHubConnectionCard />);

    expect(screen.getByText('Rate Limited')).toBeInTheDocument();
    expect(screen.getByText('GitHub API Rate Limit Reached')).toBeInTheDocument();
    expect(screen.getByText(/Reset in 45 minutes/i)).toBeInTheDocument();
  });

  it('renders Reauthorization Required alert when status is NEEDS_REAUTHORIZATION', () => {
    const mockConnection: IntegrationConnectionDto = {
      id: 'conn-1',
      provider: 'github',
      external_account_id: '583231',
      external_username: 'octocat',
      external_display_name: null,
      external_avatar_url: null,
      external_email: null,
      status: 'NEEDS_REAUTHORIZATION',
      scopes: ['read:user'],
      last_synced_at: null,
      last_sync_started_at: null,
      last_sync_completed_at: null,
      last_error_code: 'BAD_CREDENTIALS',
      last_error_message: 'Bad credentials',
      connected_at: '2026-10-01T00:00:00.000Z',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-04T12:00:00.000Z',
    };

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: true, connection: mockConnection } as IntegrationStatusResponseDto,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<GitHubConnectionCard />);

    expect(screen.getByText('Needs Reauthorization')).toBeInTheDocument();
    expect(screen.getByText('Reauthorization Required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reconnect now/i })).toBeInTheDocument();
  });

  it('renders Permission Error alert when status is PERMISSION_ERROR', () => {
    const mockConnection: IntegrationConnectionDto = {
      id: 'conn-1',
      provider: 'github',
      external_account_id: '583231',
      external_username: 'octocat',
      external_display_name: null,
      external_avatar_url: null,
      external_email: null,
      status: 'PERMISSION_ERROR',
      scopes: ['read:user'],
      last_synced_at: null,
      last_sync_started_at: null,
      last_sync_completed_at: null,
      last_error_code: 'PERMISSION_DENIED',
      last_error_message: 'Resource inaccessible',
      connected_at: '2026-10-01T00:00:00.000Z',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-04T12:00:00.000Z',
    };

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: true, connection: mockConnection } as IntegrationStatusResponseDto,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<GitHubConnectionCard />);

    expect(screen.getAllByText('Permission Error')).toHaveLength(2);
    expect(screen.getByText('Resource inaccessible')).toBeInTheDocument();
  });

  it('renders Temporarily Unavailable alert when status is TEMPORARILY_UNAVAILABLE', () => {
    const mockConnection: IntegrationConnectionDto = {
      id: 'conn-1',
      provider: 'github',
      external_account_id: '583231',
      external_username: 'octocat',
      external_display_name: null,
      external_avatar_url: null,
      external_email: null,
      status: 'TEMPORARILY_UNAVAILABLE',
      scopes: ['read:user'],
      last_synced_at: null,
      last_sync_started_at: null,
      last_sync_completed_at: null,
      last_error_code: 'SERVER_ERROR',
      last_error_message: 'GitHub internal error',
      connected_at: '2026-10-01T00:00:00.000Z',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-04T12:00:00.000Z',
    };

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: true, connection: mockConnection } as IntegrationStatusResponseDto,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<GitHubConnectionCard />);

    expect(screen.getByText('Temporarily Unavailable')).toBeInTheDocument();
    expect(screen.getByText('GitHub Service Temporarily Unavailable')).toBeInTheDocument();
  });

  it('renders synced repositories preview when repos are returned', () => {
    const mockConnection: IntegrationConnectionDto = {
      id: 'conn-1',
      provider: 'github',
      external_account_id: '583231',
      external_username: 'octocat',
      external_display_name: null,
      external_avatar_url: null,
      external_email: null,
      status: 'SYNCED',
      scopes: ['read:user'],
      last_synced_at: '2026-10-04T12:00:00.000Z',
      last_sync_started_at: null,
      last_sync_completed_at: null,
      last_error_code: null,
      last_error_message: null,
      connected_at: '2026-10-01T00:00:00.000Z',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-04T12:00:00.000Z',
    };

    const mockRepos: ExternalRepositoryDto[] = [
      {
        id: 'repo-1',
        connection_id: 'conn-1',
        provider: 'github',
        external_id: '12345',
        name: 'avenza-project',
        full_name: 'octocat/avenza-project',
        owner: 'octocat',
        is_private: false,
        html_url: 'https://github.com/octocat/avenza-project',
        description: 'Personal OS for growth',
        default_branch: 'main',
        primary_language: 'TypeScript',
        languages: { TypeScript: 95000 },
        stars_count: 42,
        forks_count: 5,
        open_issues_count: 0,
        pushed_at: '2026-10-04T10:00:00Z',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-10-04T10:00:00Z',
      },
    ];

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: true, connection: mockConnection } as IntegrationStatusResponseDto,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    vi.spyOn(hooks, 'useIntegrationRepositories').mockReturnValue({
      data: mockRepos,
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useIntegrationRepositories>);

    renderWithToast(<GitHubConnectionCard />);

    expect(screen.getByText('Synced Repositories')).toBeInTheDocument();
    expect(screen.getByText('avenza-project')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });
});
