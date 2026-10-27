import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPage } from './SettingsPage';
import { ThemeProvider } from '../lib/theme';
import { ToastProvider } from '../components/ui/Toast';
import * as hooks from '../features/integrations/hooks/useIntegrations';

const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue(undefined);
const mockGetToken = vi.fn().mockResolvedValue('test-mock-token');

let mockUser: {
  fullName: string;
  firstName: string;
  primaryEmailAddress: { emailAddress: string };
  passwordEnabled: boolean;
} = {
  fullName: 'Avenza Explorer',
  firstName: 'Avenza',
  primaryEmailAddress: { emailAddress: 'explorer@avenza.test' },
  passwordEnabled: true,
};

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: mockUser }),
  useAuth: () => ({ getToken: mockGetToken }),
  useClerk: () => ({
    session: {
      getToken: mockGetToken,
    },
    signOut: mockSignOut,
  }),
}));

vi.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: mockGet,
    post: vi.fn(),
    patch: vi.fn(),
    delete: mockDelete,
  }),
}));

function renderSettings(initialRoute = '/settings') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <ThemeProvider>
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[initialRoute]}>
            <SettingsPage />
          </MemoryRouter>
        </QueryClientProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

describe('SettingsPage Component with Phase 14 Connected Accounts', () => {
  const mockProcessCallback = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUser = {
      fullName: 'Avenza Explorer',
      firstName: 'Avenza',
      primaryEmailAddress: { emailAddress: 'explorer@avenza.test' },
      passwordEnabled: true,
    };

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: false, connection: null },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    vi.spyOn(hooks, 'useConnectIntegration').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof hooks.useConnectIntegration>);

    vi.spyOn(hooks, 'useProcessOAuthCallback').mockReturnValue({
      mutateAsync: mockProcessCallback,
      isPending: false,
    } as unknown as ReturnType<typeof hooks.useProcessOAuthCallback>);

    vi.spyOn(hooks, 'useIntegrationRepositories').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useIntegrationRepositories>);

    vi.spyOn(hooks, 'useIntegrationCalendarEvents').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useIntegrationCalendarEvents>);
  });

  it('renders Settings page header and Appearance section', () => {
    renderSettings();

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Appearance & Theme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument();
  });

  it('renders Connected Accounts section with GitHub, LeetCode, Codeforces, and Google Calendar cards', () => {
    renderSettings();

    expect(screen.getByText('Connected Accounts')).toBeInTheDocument();
    expect(screen.getByText('Phase 14')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('LeetCode')).toBeInTheDocument();
    expect(screen.getByText('Codeforces')).toBeInTheDocument();
    expect(screen.getByText('Google Calendar')).toBeInTheDocument();
    expect(screen.getAllByText('Not Connected').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole('button', { name: /connect github/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect google calendar/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /connect account/i }).length).toBe(2);
  });

  it('renders upcoming planned providers placeholders without active actions', () => {
    renderSettings();

    expect(screen.getByText(/Competitive Programming Platforms/i)).toBeInTheDocument();
    expect(screen.getByText('Planned')).toBeInTheDocument();
  });

  it('automatically processes OAuth callback when code and state are in URL', async () => {
    mockProcessCallback.mockResolvedValueOnce({
      id: 'conn-1',
      provider: 'github',
      external_username: 'octocat',
      status: 'CONNECTED',
    });

    renderSettings('/settings?code=valid-auth-code&state=valid-oauth-state');

    await waitFor(() => {
      expect(mockProcessCallback).toHaveBeenCalledWith({
        provider: 'github',
        code: 'valid-auth-code',
        state: 'valid-oauth-state',
      });
    });
  });

  it('processes Google Calendar OAuth callback when provider=google_calendar is in URL', async () => {
    mockProcessCallback.mockResolvedValueOnce({
      id: 'conn-2',
      provider: 'google_calendar',
      external_username: 'student@example.com',
      status: 'CONNECTED',
    });

    renderSettings('/settings?provider=google_calendar&code=google-code&state=google-state');

    await waitFor(() => {
      expect(mockProcessCallback).toHaveBeenCalledWith({
        provider: 'google_calendar',
        code: 'google-code',
        state: 'google-state',
      });
    });
  });
});

describe('SettingsPage Danger Zone — Account Deletion & Data Export', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGet.mockReset();
    mockDelete.mockReset();
    mockSignOut.mockReset();
    mockGetToken.mockReset().mockResolvedValue('fresh-stepup-token');

    mockUser = {
      fullName: 'Avenza Explorer',
      firstName: 'Avenza',
      primaryEmailAddress: { emailAddress: 'explorer@avenza.test' },
      passwordEnabled: true,
    };

    vi.spyOn(hooks, 'useIntegrationStatus').mockReturnValue({
      data: { connected: false, connection: null },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useIntegrationStatus>);

    vi.spyOn(hooks, 'useConnectIntegration').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof hooks.useConnectIntegration>);

    vi.spyOn(hooks, 'useProcessOAuthCallback').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof hooks.useProcessOAuthCallback>);

    vi.spyOn(hooks, 'useIntegrationRepositories').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useIntegrationRepositories>);

    vi.spyOn(hooks, 'useIntegrationCalendarEvents').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useIntegrationCalendarEvents>);
  });

  it('renders Data & Privacy export and Danger Zone account deletion card', () => {
    renderSettings();

    expect(screen.getByText('Data & Privacy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export All Account Data \(JSON\)/i })).toBeInTheDocument();
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Account\.\.\./i })).toBeInTheDocument();
  });

  it('triggers account data export and download on click', async () => {
    const mockExportData = { version: '1.0', exportTimestamp: '2026-10-15T00:00:00Z', profile: {} };
    mockGet.mockResolvedValueOnce(mockExportData);

    const createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi.fn();
    window.URL.createObjectURL = createObjectURLSpy;
    window.URL.revokeObjectURL = revokeObjectURLSpy;

    renderSettings();

    const exportBtn = screen.getByRole('button', { name: /Export All Account Data \(JSON\)/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/v1/account/export');
      expect(createObjectURLSpy).toHaveBeenCalled();
    });
  });

  it('opens delete confirmation modal when Delete Account button is clicked and closes on Cancel', () => {
    renderSettings();

    const deleteBtn = screen.getByRole('button', { name: /Delete Account\.\.\./i });
    fireEvent.click(deleteBtn);

    expect(screen.getByText('Delete Account Permanently')).toBeInTheDocument();
    expect(screen.getByText(/This action is irreversible/i)).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText('Delete Account Permanently')).not.toBeInTheDocument();
  });

  it('disables deletion submission until confirmation text matches and password is provided', () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /Delete Account\.\.\./i }));

    const submitBtn = screen.getByRole('button', { name: /Permanently Delete Account/i });
    expect(submitBtn).toBeDisabled();

    // Partial text
    const textInput = screen.getByPlaceholderText('DELETE MY ACCOUNT');
    fireEvent.change(textInput, { target: { value: 'DELETE' } });
    expect(submitBtn).toBeDisabled();

    // Complete text but missing password
    fireEvent.change(textInput, { target: { value: 'DELETE MY ACCOUNT' } });
    expect(submitBtn).toBeDisabled();

    // Add password
    const passwordInput = screen.getByPlaceholderText('Enter your current password to authenticate');
    fireEvent.change(passwordInput, { target: { value: 'my-secure-password' } });
    expect(submitBtn).not.toBeDisabled();
  });

  it('executes deletion successfully for password user and initiates sign-out', async () => {
    mockDelete.mockResolvedValueOnce({
      success: true,
      profileId: 'prof-123',
      clerkUserId: 'user_123',
      status: 'DELETED',
    });

    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /Delete Account\.\.\./i }));

    const textInput = screen.getByPlaceholderText('DELETE MY ACCOUNT');
    fireEvent.change(textInput, { target: { value: 'DELETE MY ACCOUNT' } });

    const passwordInput = screen.getByPlaceholderText('Enter your current password to authenticate');
    fireEvent.change(passwordInput, { target: { value: 'CorrectPassword123!' } });

    const submitBtn = screen.getByRole('button', { name: /Permanently Delete Account/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/api/v1/auth/me', {
        confirmation: 'DELETE MY ACCOUNT',
        password: 'CorrectPassword123!',
        authMethod: 'password',
      });
    });

    expect(await screen.findByText(/Your account has been deleted successfully/i)).toBeInTheDocument();
  });

  it('handles deletion failure and displays error message', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Invalid password provided'));

    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /Delete Account\.\.\./i }));

    const textInput = screen.getByPlaceholderText('DELETE MY ACCOUNT');
    fireEvent.change(textInput, { target: { value: 'DELETE MY ACCOUNT' } });

    const passwordInput = screen.getByPlaceholderText('Enter your current password to authenticate');
    fireEvent.change(passwordInput, { target: { value: 'WrongPassword' } });

    fireEvent.click(screen.getByRole('button', { name: /Permanently Delete Account/i }));

    expect(await screen.findByText('Invalid password provided')).toBeInTheDocument();
  });

  it('prevents duplicate submissions while deletion is in flight', async () => {
    let resolveDeletePromise: (value: unknown) => void = () => {};
    const deletePromise = new Promise((resolve) => {
      resolveDeletePromise = resolve;
    });
    mockDelete.mockReturnValueOnce(deletePromise);

    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /Delete Account\.\.\./i }));

    const textInput = screen.getByPlaceholderText('DELETE MY ACCOUNT');
    fireEvent.change(textInput, { target: { value: 'DELETE MY ACCOUNT' } });

    const passwordInput = screen.getByPlaceholderText('Enter your current password to authenticate');
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });

    const submitBtn = screen.getByRole('button', { name: /Permanently Delete Account/i });
    fireEvent.click(submitBtn);

    // During flight, submit button and input should be disabled
    expect(submitBtn).toBeDisabled();
    expect(textInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();

    // Click again while in-flight
    fireEvent.click(submitBtn);
    expect(mockDelete).toHaveBeenCalledTimes(1);

    resolveDeletePromise({ success: true, status: 'DELETED' });
    await waitFor(() => {
      expect(screen.getByText(/Your account has been deleted successfully/i)).toBeInTheDocument();
    });
  });

  it('explains OAuth restriction and disables self-service deletion when user has no password', () => {
    mockUser = {
      fullName: 'Avenza Explorer',
      firstName: 'Avenza',
      primaryEmailAddress: { emailAddress: 'explorer@avenza.test' },
      passwordEnabled: false,
    };

    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /Delete Account\.\.\./i }));

    // Password field should not be present for OAuth user
    expect(screen.queryByPlaceholderText('Enter your current password to authenticate')).not.toBeInTheDocument();
    expect(screen.getByText('Password Required for Self-Service Deletion')).toBeInTheDocument();
    expect(
      screen.getByText(/Your account is authenticated via OAuth\/social login without a password/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Please add a password to your account in your Clerk profile settings/i)
    ).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Password Required to Delete/i });
    expect(submitBtn).toBeDisabled();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
