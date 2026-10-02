import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ThemeProvider } from '../../lib/theme';

// Mock Clerk UserButton
vi.mock('@clerk/clerk-react', () => ({
  UserButton: () => <div data-testid="mock-user-button">UserButton</div>,
}));

describe('AppShell & Navigation Foundation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderShell = (initialEntries = ['/overview']) => {
    return render(
      <ThemeProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <AppShell>
            <div data-testid="page-content">Main Page Content</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );
  };

  it('renders the application shell with content, topbar, and sidebar', () => {
    renderShell();

    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    expect(screen.getByTestId('mock-user-button')).toBeInTheDocument();
    // Brand title
    expect(screen.getAllByText('Avenza')[0]).toBeInTheDocument();
  });

  it('renders all primary navigation sections and items', () => {
    renderShell();

    // Check navigation groups
    expect(screen.getAllByText(/Overview/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Today/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Terms/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Subjects/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Exams/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/DSA/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Projects/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Career/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Goals/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Calendar/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Planner/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Analytics/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Weekly Review/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/AI Coach/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Settings/i)[0]).toBeInTheDocument();
  });

  it('collapses and expands the desktop sidebar and persists preference', () => {
    renderShell();

    const collapseBtn = screen.getByLabelText(/Collapse sidebar/i);
    expect(collapseBtn).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(collapseBtn);
    expect(localStorage.getItem('avenza-sidebar-collapsed')).toBe('true');
    expect(screen.getByLabelText(/Expand sidebar/i)).toBeInTheDocument();

    // Click to expand
    const expandBtn = screen.getByLabelText(/Expand sidebar/i);
    fireEvent.click(expandBtn);
    expect(localStorage.getItem('avenza-sidebar-collapsed')).toBe('false');
  });

  it('opens and closes mobile navigation drawer', () => {
    renderShell();

    const mobileMenuBtn = screen.getByLabelText(/Open navigation menu/i);
    expect(mobileMenuBtn).toBeInTheDocument();

    fireEvent.click(mobileMenuBtn);

    const closeBtn = screen.getByLabelText(/Close navigation/i);
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);
  });

  it('renders breadcrumbs corresponding to route', () => {
    renderShell(['/academics/subjects']);

    const breadcrumbsNav = screen.getByRole('navigation', { name: /Breadcrumbs/i });
    expect(breadcrumbsNav).toBeInTheDocument();
    expect(breadcrumbsNav).toHaveTextContent('Academics');
    expect(breadcrumbsNav).toHaveTextContent('Subjects');
  });
});
