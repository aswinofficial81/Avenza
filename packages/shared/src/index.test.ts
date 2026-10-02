import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_TAGLINE, HealthResponseSchema } from './index';

describe('Shared package foundations', () => {
  it('exports correct app branding constants', () => {
    expect(APP_NAME).toBe('Avenza');
    expect(APP_TAGLINE).toBe('Plan. Execute. Evolve.');
  });

  it('validates HealthResponse schema properly', () => {
    const validHealth = {
      status: 'ok',
      uptime: 12.34,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
    const parsed = HealthResponseSchema.parse(validHealth);
    expect(parsed.status).toBe('ok');
  });
});
