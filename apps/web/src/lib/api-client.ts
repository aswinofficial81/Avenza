import { useAuth } from '@clerk/clerk-react';
import { env } from '../config/env';
import type { AuthMeResponse } from '@avenza/shared';

export class ApiClient {
  private readonly baseUrl: string;

  constructor(
    private readonly getToken?: () => Promise<string | null>,
    baseUrl?: string
  ) {
    this.baseUrl = baseUrl || env.API_BASE_URL;
  }

  async get<T>(endpoint: string, options: { token?: string } = {}): Promise<T> {
    const token = options.token || (this.getToken ? await this.getToken() : null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
      });
    } catch (err) {
      const error = err as Error;
      if (
        error.name === 'TypeError' ||
        error.message?.toLowerCase().includes('failed to fetch') ||
        error.message?.toLowerCase().includes('network')
      ) {
        throw new Error(
          `Cannot reach API service at ${this.baseUrl}. Please verify the Fastify backend server is running on port 3005.`
        );
      }
      throw error;
    }

    let data: { error?: { message?: string } } | null = null;
    try {
      data = (await response.json()) as { error?: { message?: string } };
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message = data?.error?.message || `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return data as unknown as T;
  }

  async getMe(token?: string): Promise<AuthMeResponse> {
    return this.get<AuthMeResponse>('/api/v1/auth/me', { token });
  }
}

export function useApiClient(): ApiClient {
  const { getToken } = useAuth();
  return new ApiClient(getToken);
}
