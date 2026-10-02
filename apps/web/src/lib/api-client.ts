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

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error?.message || `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return data as T;
  }

  async getMe(token?: string): Promise<AuthMeResponse> {
    return this.get<AuthMeResponse>('/api/v1/auth/me', { token });
  }
}

export function useApiClient(): ApiClient {
  const { getToken } = useAuth();
  return new ApiClient(getToken);
}
