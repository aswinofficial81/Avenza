import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';

// Mock Clerk React hooks and components
vi.mock('@clerk/clerk-react', () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="signed-in">{children}</div>
  ),
  SignedOut: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="signed-out">{children}</div>
  ),
  SignInButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  UserButton: () => <div data-testid="user-button">UserButton</div>,
  useUser: () => ({
    user: {
      id: 'user_clerk_123',
      fullName: 'Avenza Explorer',
      primaryEmailAddress: { emailAddress: 'explorer@avenza.dev' },
    },
  }),
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-clerk-token'),
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>);
}

describe('App Component', () => {
  it('renders branding and configuration notice when key is missing', () => {
    renderWithClient(<App isMissingKey={true} />);

    expect(screen.getByRole('heading', { level: 1, name: /Avenza/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Plan\. Execute\. Evolve\./i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Clerk Configuration Notice/i)).toBeInTheDocument();
  });

  it('renders sign-in and sign-up buttons in signed-out state when configured', () => {
    renderWithClient(<App isMissingKey={false} />);

    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Get Started/i })).toBeInTheDocument();
  });

  it('renders authenticated user information when signed in', async () => {
    renderWithClient(<App isMissingKey={false} />);

    expect(screen.getByTestId('signed-in')).toBeInTheDocument();
    expect(screen.getAllByText(/^Avenza$/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('user-button')).toBeInTheDocument();
  });
});
