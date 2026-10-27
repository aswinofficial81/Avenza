import { ProviderAuthError, ProviderRateLimitError } from '../base/provider.types';
import type { GitHubEventResponse, GitHubRepoResponse, GitHubUserResponse } from './github.types';

export interface GitHubClientOptions {
  baseUrl?: string;
}

export class GitHubClient {
  private readonly baseUrl: string;

  constructor(opts: GitHubClientOptions = {}) {
    this.baseUrl = (opts.baseUrl || 'https://api.github.com').replace(/\/+$/, '');
  }

  private async request<T>(path: string, accessToken: string): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Avenza-Integration-Hub/1.0',
      },
    });

    const remaining = response.headers.get('x-ratelimit-remaining');
    const resetTime = response.headers.get('x-ratelimit-reset');
    const resetSeconds = resetTime ? parseInt(resetTime, 10) : null;

    if (response.status === 401) {
      throw new ProviderAuthError('GitHub authentication failed or token is expired.');
    }

    if (response.status === 403 || response.status === 429) {
      if (remaining === '0' || response.status === 429) {
        throw new ProviderRateLimitError(
          'GitHub API rate limit exceeded. Please try again after the reset period.',
          resetSeconds
        );
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: { message?: string } | null = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = null;
      }
      throw new Error(errorJson?.message || `GitHub API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async getAuthenticatedUser(accessToken: string): Promise<GitHubUserResponse> {
    return this.request<GitHubUserResponse>('/user', accessToken);
  }

  async getUserRepositories(
    accessToken: string,
    params: { perPage?: number; sort?: string; page?: number } = {}
  ): Promise<GitHubRepoResponse[]> {
    const searchParams = new URLSearchParams();
    searchParams.set('per_page', String(params.perPage || 100));
    searchParams.set('sort', params.sort || 'pushed');
    if (params.page) searchParams.set('page', String(params.page));

    return this.request<GitHubRepoResponse[]>(`/user/repos?${searchParams.toString()}`, accessToken);
  }

  async getRepoLanguages(owner: string, repo: string, accessToken: string): Promise<Record<string, number>> {
    return this.request<Record<string, number>>(`/repos/${owner}/${repo}/languages`, accessToken);
  }

  async getUserPublicEvents(username: string, accessToken: string, perPage = 30): Promise<GitHubEventResponse[]> {
    return this.request<GitHubEventResponse[]>(`/users/${username}/events/public?per_page=${perPage}`, accessToken);
  }
}
