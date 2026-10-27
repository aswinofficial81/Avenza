import { ProviderAuthError, ProviderRateLimitError } from '../base/provider.types';
import type {
  CodeforcesApiResponse,
  CodeforcesRatingChange,
  CodeforcesSubmission,
  CodeforcesUser,
} from './codeforces.types';

export interface CodeforcesClientOptions {
  baseUrl?: string;
  minIntervalMs?: number;
  timeoutMs?: number;
}

export class CodeforcesClient {
  private readonly baseUrl: string;
  private readonly minIntervalMs: number;
  private readonly timeoutMs: number;
  private lastRequestTime = 0;

  constructor(options: CodeforcesClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'https://codeforces.com/api';
    this.minIntervalMs = options.minIntervalMs ?? 2000;
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs && this.lastRequestTime > 0) {
      const waitTime = this.minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  private async executeGet<T>(endpoint: string, params: Record<string, string | number>): Promise<T> {
    await this.throttle();

    const url = new URL(`${this.baseUrl}/${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Avenza/0.1.0',
        },
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new ProviderRateLimitError('Codeforces rate limit exceeded (HTTP 429).');
      }

      let json: CodeforcesApiResponse<T>;
      try {
        json = (await response.json()) as CodeforcesApiResponse<T>;
      } catch {
        throw new Error(`Malformed JSON response from Codeforces API (HTTP ${response.status}).`);
      }

      if (json.status === 'FAILED') {
        const comment = json.comment || 'Unknown Codeforces API error';
        if (
          comment.toLowerCase().includes('call limit exceeded') ||
          comment.toLowerCase().includes('limit exceeded')
        ) {
          throw new ProviderRateLimitError(`Codeforces rate limit exceeded: ${comment}`);
        }
        if (comment.toLowerCase().includes('not found')) {
          throw new ProviderAuthError(comment);
        }
        throw new Error(`Codeforces error: ${comment}`);
      }

      if (!json.result) {
        throw new Error('Codeforces API returned empty result payload.');
      }

      return json.result;
    } catch (err: unknown) {
      if (err instanceof ProviderRateLimitError || err instanceof ProviderAuthError) {
        throw err;
      }
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error('Codeforces API request timed out.');
        }
        throw err;
      }
      throw new Error('Unexpected error communicating with Codeforces API.');
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchUserInfo(handle: string): Promise<CodeforcesUser> {
    const users = await this.executeGet<CodeforcesUser[]>('user.info', { handles: handle });
    const user = users[0];
    if (!user) {
      throw new ProviderAuthError(`Codeforces user "${handle}" was not found.`);
    }
    return user;
  }

  async fetchUserRating(handle: string): Promise<CodeforcesRatingChange[]> {
    try {
      return await this.executeGet<CodeforcesRatingChange[]>('user.rating', { handle });
    } catch (err: unknown) {
      // If user has never participated in any rated contest, user.rating can return FAILED: "handle: Rating for handle ... not found" or empty
      if (err instanceof Error && err.message.toLowerCase().includes('rating for handle') && err.message.toLowerCase().includes('not found')) {
        return [];
      }
      throw err;
    }
  }

  async fetchRecentSubmissions(handle: string, count = 20): Promise<CodeforcesSubmission[]> {
    return this.executeGet<CodeforcesSubmission[]>('user.status', {
      handle,
      from: 1,
      count,
    });
  }
}
