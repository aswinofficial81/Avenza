import { describe, expect, it } from 'vitest';
import { buildApp } from '../../app';

describe('GET /health', () => {
  it('returns 200 with structured health status', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.timestamp).toBe('string');
    expect(typeof body.version).toBe('string');
  });

  it('includes request id in response headers', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-request-id': 'test-request-id-12345',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('test-request-id-12345');
  });
});
