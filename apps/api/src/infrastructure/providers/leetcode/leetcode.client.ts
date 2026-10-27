import { ProviderRateLimitError } from '../base/provider.types';
import type {
  LeetCodeContestQueryResult,
  LeetCodeMatchedUser,
  LeetCodeProfileQueryResult,
  LeetCodeRecentSubmission,
  LeetCodeRecentSubmissionsQueryResult,
  LeetCodeUserContestRanking,
} from './leetcode.types';

export interface LeetCodeClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

export class LeetCodeClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: LeetCodeClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'https://leetcode.com/graphql';
    this.timeoutMs = config.timeoutMs || 10000;
  }

  private async executeGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://leetcode.com',
          Origin: 'https://leetcode.com',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new ProviderRateLimitError('LeetCode GraphQL API rate limit exceeded.');
      }

      if (response.status === 403) {
        throw new Error('LeetCode request forbidden or blocked by security policy.');
      }

      if (!response.ok) {
        throw new Error(`LeetCode API returned HTTP status ${response.status}.`);
      }

      const json = (await response.json()) as T;
      return json;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ProviderRateLimitError) throw err;
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error('LeetCode GraphQL request timed out.');
        }
        throw err;
      }
      throw new Error('Unexpected error querying LeetCode GraphQL API.');
    }
  }

  async fetchUserProfile(username: string): Promise<LeetCodeMatchedUser | null> {
    const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          githubUrl
          twitterUrl
          linkedinUrl
          profile {
            realName
            userAvatar
            ranking
            reputation
            aboutMe
            countryName
          }
          submitStats: submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
              submissions
            }
          }
        }
      }
    `;

    const res = await this.executeGraphQL<LeetCodeProfileQueryResult>(query, { username });
    if (res.errors && res.errors.length > 0 && !res.data?.matchedUser) {
      throw new Error(`LeetCode error: ${res.errors[0]?.message || 'Unknown GraphQL error'}`);
    }

    return res.data?.matchedUser ?? null;
  }

  async fetchUserContestRanking(username: string): Promise<LeetCodeUserContestRanking | null> {
    const query = `
      query getUserContestRanking($username: String!) {
        userContestRanking(username: $username) {
          attendedContestsCount
          rating
          globalRanking
          totalParticipants
          topPercentage
          badge {
            name
          }
        }
      }
    `;

    try {
      const res = await this.executeGraphQL<LeetCodeContestQueryResult>(query, { username });
      return res.data?.userContestRanking ?? null;
    } catch {
      // Contest ranking may be null or error out for users who never participated
      return null;
    }
  }

  async fetchRecentAcSubmissions(username: string, limit = 20): Promise<LeetCodeRecentSubmission[]> {
    const query = `
      query getRecentAcSubmissions($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
          id
          title
          titleSlug
          timestamp
        }
      }
    `;

    const res = await this.executeGraphQL<LeetCodeRecentSubmissionsQueryResult>(query, {
      username,
      limit,
    });

    return res.data?.recentAcSubmissionList ?? [];
  }
}
