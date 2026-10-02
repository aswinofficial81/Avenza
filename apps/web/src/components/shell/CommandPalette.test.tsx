import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import { ThemeProvider } from '../../lib/theme';

describe('Command Palette Foundation', () => {
  const renderPalette = (isOpen = true, onClose = vi.fn()) => {
    return render(
      <ThemeProvider>
        <MemoryRouter>
          <CommandPalette isOpen={isOpen} onClose={onClose} />
        </MemoryRouter>
      </ThemeProvider>
    );
  };

  it('renders command palette when open with search input and initial commands', () => {
    renderPalette(true);

    expect(screen.getByRole('dialog', { name: /Command Palette/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type a command or search/i)).toBeInTheDocument();
    expect(screen.getByText('Go to Overview')).toBeInTheDocument();
    expect(screen.getByText('Go to Today')).toBeInTheDocument();
    expect(screen.getByText('Go to Settings')).toBeInTheDocument();
  });

  it('filters commands according to query', () => {
    renderPalette(true);

    const input = screen.getByPlaceholderText(/Type a command or search/i);
    fireEvent.change(input, { target: { value: 'calendar' } });

    expect(screen.getByText('Go to Calendar')).toBeInTheDocument();
    expect(screen.queryByText('Go to DSA')).not.toBeInTheDocument();
  });

  it('closes when Escape key is pressed', () => {
    const handleClose = vi.fn();
    renderPalette(true, handleClose);

    const input = screen.getByPlaceholderText(/Type a command or search/i);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(handleClose).toHaveBeenCalled();
  });

  it('navigates with keyboard arrows and executes command with Enter', () => {
    const handleClose = vi.fn();
    renderPalette(true, handleClose);

    const input = screen.getByPlaceholderText(/Type a command or search/i);
    // Arrow down
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Press Enter to select
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(handleClose).toHaveBeenCalled();
  });
});
