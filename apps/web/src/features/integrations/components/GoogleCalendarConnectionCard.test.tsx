import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GoogleCalendarConnectionCard } from './GoogleCalendarConnectionCard';
import * as hooks from '../hooks/useIntegrations';
import { ToastProvider } from '../../../components/ui/Toast';
import type {
  ExternalCalendarEventDto,
  IntegrationConnectionDto,
  IntegrationStatusResponseDto,
} from '@avenza/shared';

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('GoogleCalendarConnectionCard Component', () => {
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

    vi.spyOn(hooks, 'useIntegrationCalendarEvents').mockReturnValue({
      data: [] as ExternalCalendarEventDto[],
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useIntegrationCalendarEvents>);
  });

  it('renders loading state correctly', () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<GoogleCalendarConnectionCard />);
    expect(screen.getByText('Loading Google Calendar integration status...')).toBeInTheDocument();
  });

  it('renders error state when status query fails', () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<GoogleCalendarConnectionCard />);
    expect(screen.getByText('Failed to load Google Calendar integration details.')).toBeInTheDocument();
  });

  it('renders Not Connected state with Connect Google Calendar CTA when disconnected', () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: false, connection: null },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<GoogleCalendarConnectionCard />);

    expect(screen.getByText('Google Calendar')).toBeInTheDocument();
    expect(screen.getByText('Not Connected')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Connect your Google Calendar to allow Avenza to understand your schedule and provide intelligent planning context.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect google calendar/i })).toBeInTheDocument();
  });

  it('shows Redirecting to Google... when connect mutation is pending', () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: false, connection: null },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    vi.spyOn(hooks, 'useConnectIntegration').mockReturnValue({
      mutateAsync: mockConnectMutateAsync,
      isPending: true,
    } as unknown as ReturnType<typeof hooks.useConnectIntegration>);

    renderWithToast(<GoogleCalendarConnectionCard />);
    expect(screen.getByText('Redirecting to Google...')).toBeInTheDocument();
  });

  it('initiates OAuth flow when Connect Google Calendar button is clicked', async () => {
    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: false, connection: null },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    mockConnectMutateAsync.mockResolvedValueOnce({
      authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth?mock=1',
      state: 'mock-state',
    });

    renderWithToast(<GoogleCalendarConnectionCard />);

    const connectBtn = screen.getByRole('button', { name: /connect google calendar/i });
    fireEvent.click(connectBtn);

    await waitFor(() => {
      expect(mockConnectMutateAsync).toHaveBeenCalledWith({
        provider: 'google_calendar',
        redirectUrl: expect.stringContaining('/settings?provider=google_calendar'),
      });
    });
  });

  it('renders connected state with Google account, primary calendar, timezone, upcoming count and sync info', () => {
    const mockConnection: IntegrationConnectionDto = {
      id: 'conn-1',
      provider: 'google_calendar',
      external_account_id: 'google-sub-123',
      external_username: 'student@example.com',
      external_display_name: 'Student User',
      external_avatar_url: 'https://lh3.googleusercontent.com/avatar.jpg',
      external_email: 'student@example.com',
      scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/calendar.readonly'],
      status: 'CONNECTED',
      sync_state: {
        primaryCalendarId: 'student@example.com',
        primaryCalendarTimeZone: 'America/New_York',
        selectedCalendarIds: ['student@example.com'],
        calendars: [
          {
            id: 'student@example.com',
            summary: 'Personal Calendar',
            timeZone: 'America/New_York',
            primary: true,
            accessRole: 'owner',
          },
        ],
        syncTokens: { 'student@example.com': 'token-1' },
        lastSyncedAt: '2026-10-05T10:00:00.000Z',
      },
      last_synced_at: '2026-10-05T10:00:00.000Z',
      last_sync_started_at: null,
      last_sync_completed_at: '2026-10-05T10:00:00.000Z',
      last_error_code: null,
      last_error_message: null,
      connected_at: '2026-10-05T09:00:00.000Z',
      disconnected_at: null,
      created_at: '2026-10-05T09:00:00.000Z',
      updated_at: '2026-10-05T10:00:00.000Z',
    };

    const mockEvents: ExternalCalendarEventDto[] = [
      {
        id: 'event-1',
        connection_id: 'conn-1',
        calendar_id: 'student@example.com',
        external_event_id: 'evt-1',
        title: 'Algorithms Lecture',
        status: 'confirmed',
        start_time: '2026-10-05T14:00:00.000Z',
        end_time: '2026-10-05T15:30:00.000Z',
        is_all_day: false,
        time_zone: 'America/New_York',
        is_busy: true,
        is_recurring: false,
        recurring_event_id: null,
        html_link: 'https://calendar.google.com/event?eid=1',
        created_at: '2026-10-05T09:00:00.000Z',
        updated_at: '2026-10-05T10:00:00.000Z',
      },
    ];

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: true, connection: mockConnection } as IntegrationStatusResponseDto,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    vi.spyOn(hooks, 'useIntegrationCalendarEvents').mockReturnValue({
      data: mockEvents,
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useIntegrationCalendarEvents>);

    renderWithToast(<GoogleCalendarConnectionCard />);

    expect(screen.getByText('Google Calendar')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('student@example.com')).toBeInTheDocument();
    expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
    expect(screen.getByText('America/New_York')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
    expect(screen.getByText('Read-Only Scheduling Context:')).toBeInTheDocument();
  });

  it('triggers manual sync and shows success toast', async () => {
    const mockConnection: IntegrationConnectionDto = {
      id: 'conn-1',
      provider: 'google_calendar',
      external_account_id: 'google-sub-123',
      external_username: 'student@example.com',
      external_display_name: null,
      external_avatar_url: null,
      external_email: 'student@example.com',
      scopes: ['openid', 'email'],
      status: 'CONNECTED',
      sync_state: null,
      last_synced_at: null,
      last_sync_started_at: null,
      last_sync_completed_at: null,
      last_error_code: null,
      last_error_message: null,
      connected_at: '2026-10-05T09:00:00.000Z',
      disconnected_at: null,
      created_at: '2026-10-05T09:00:00.000Z',
      updated_at: '2026-10-05T10:00:00.000Z',
    };

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: true, connection: mockConnection } as IntegrationStatusResponseDto,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    mockSyncMutateAsync.mockResolvedValueOnce({
      success: true,
      provider: 'google_calendar',
      events_synced: 12,
      synced_at: new Date().toISOString(),
    });

    renderWithToast(<GoogleCalendarConnectionCard />);

    const syncBtn = screen.getByRole('button', { name: /sync now/i });
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(mockSyncMutateAsync).toHaveBeenCalledWith('google_calendar');
    });
  });

  it('opens confirmation modal and triggers disconnect', async () => {
    const mockConnection: IntegrationConnectionDto = {
      id: 'conn-1',
      provider: 'google_calendar',
      external_account_id: 'google-sub-123',
      external_username: 'student@example.com',
      external_display_name: null,
      external_avatar_url: null,
      external_email: 'student@example.com',
      scopes: ['openid', 'email'],
      status: 'CONNECTED',
      sync_state: null,
      last_synced_at: null,
      last_sync_started_at: null,
      last_sync_completed_at: null,
      last_error_code: null,
      last_error_message: null,
      connected_at: '2026-10-05T09:00:00.000Z',
      disconnected_at: null,
      created_at: '2026-10-05T09:00:00.000Z',
      updated_at: '2026-10-05T10:00:00.000Z',
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

    renderWithToast(<GoogleCalendarConnectionCard />);

    const disconnectBtn = screen.getByRole('button', { name: /disconnect/i });
    fireEvent.click(disconnectBtn);

    expect(screen.getByText('Disconnect Google Calendar')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to disconnect your Google Calendar\?/)
    ).toBeInTheDocument();

    const disconnectButtons = screen.getAllByRole('button', { name: /^disconnect$/i });
    const confirmBtn = disconnectButtons[disconnectButtons.length - 1];
    expect(confirmBtn).toBeDefined();
    if (confirmBtn) {
      fireEvent.click(confirmBtn);
    }

    await waitFor(() => {
      expect(mockDisconnectMutateAsync).toHaveBeenCalledWith('google_calendar');
    });
  });

  it('renders reauthorization banner when status is NEEDS_REAUTHORIZATION', () => {
    const mockConnection: IntegrationConnectionDto = {
      id: 'conn-1',
      provider: 'google_calendar',
      external_account_id: 'google-sub-123',
      external_username: 'student@example.com',
      external_display_name: null,
      external_avatar_url: null,
      external_email: 'student@example.com',
      scopes: ['openid'],
      status: 'NEEDS_REAUTHORIZATION',
      sync_state: null,
      last_synced_at: null,
      last_sync_started_at: null,
      last_sync_completed_at: null,
      last_error_code: 'AUTH_FAILED',
      last_error_message: 'Token expired',
      connected_at: '2026-10-05T09:00:00.000Z',
      disconnected_at: null,
      created_at: '2026-10-05T09:00:00.000Z',
      updated_at: '2026-10-05T10:00:00.000Z',
    };

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: true, connection: mockConnection } as IntegrationStatusResponseDto,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    renderWithToast(<GoogleCalendarConnectionCard />);

    expect(screen.getByText('Needs Reauthorization')).toBeInTheDocument();
    expect(screen.getByText('Reauthorization Required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reconnect now/i })).toBeInTheDocument();
  });
});
