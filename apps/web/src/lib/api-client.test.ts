import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiClient } from './api-client';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches Bearer token in Authorization header when token is provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { status: 'ok' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new ApiClient(async () => 'clerk-test-jwt-token', 'http://localhost:3001');
    const result = await client.get('/test');

    expect(result).toEqual({ success: true, data: { status: 'ok' } });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/test',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk-test-jwt-token',
        },
      })
    );
  });

  it('omits Authorization header when getToken returns null', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: 'public' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new ApiClient(async () => null, 'http://localhost:3001');
    await client.get('/public');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/public',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
  });

  it('throws descriptive error on non-ok HTTP responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Token expired' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new ApiClient(async () => 'expired-token', 'http://localhost:3001');

    await expect(client.getMe()).rejects.toThrow('Token expired');
  });

  it('handles network connection failures separately with helpful message', async () => {
    const networkError = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError));

    const client = new ApiClient(async () => 'token', 'http://localhost:3005');

    await expect(client.getMe()).rejects.toThrow(
      'Cannot reach API service at http://localhost:3005. Please verify the Fastify backend server is running on port 3005.'
    );
  });
});
