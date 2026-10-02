import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { ThemeProvider, useTheme } from './theme';

const ThemeConsumer = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-val">{theme}</span>
      <span data-testid="resolved-theme-val">{resolvedTheme}</span>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('system')}>Set System</button>
    </div>
  );
};

describe('Theme System', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
  });

  it('defaults to system theme when no preference stored', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-val')).toHaveTextContent('system');
    expect(['light', 'dark']).toContain(screen.getByTestId('resolved-theme-val').textContent);
  });

  it('switches between light and dark themes and updates html class', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    act(() => {
      screen.getByText('Set Dark').click();
    });

    expect(screen.getByTestId('theme-val')).toHaveTextContent('dark');
    expect(screen.getByTestId('resolved-theme-val')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      screen.getByText('Set Light').click();
    });

    expect(screen.getByTestId('theme-val')).toHaveTextContent('light');
    expect(screen.getByTestId('resolved-theme-val')).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists theme preference to localStorage under avenza-theme', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    act(() => {
      screen.getByText('Set Dark').click();
    });

    expect(localStorage.getItem('avenza-theme')).toBe('dark');
  });
});
