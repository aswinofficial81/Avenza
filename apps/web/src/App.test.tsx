import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders Avenza branding and tagline correctly', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: /Avenza/i })).toBeInTheDocument();
    expect(screen.getByText(/Plan\. Execute\. Evolve\./i)).toBeInTheDocument();
    expect(screen.getByText(/A personal operating system for growth\./i)).toBeInTheDocument();
  });
});
