import type { ISyncProvider } from '../base/sync.interface';
import {
  ProviderRateLimitError,
  type NormalizedActivityData,
  type NormalizedRepositoryData,
  type SyncContext,
  type SyncResult,
} from '../base/provider.types';
import { GitHubClient } from './github.client';
import { GitHubMapper } from './github.mapper';

export class GitHubSyncProvider implements ISyncProvider {
  constructor(private readonly client: GitHubClient = new GitHubClient()) {}

  async sync(context: SyncContext): Promise<SyncResult> {
    if (!context.accessToken) {
      return {
        success: false,
        repositories: [],
        activities: [],
        errorCode: 'MISSING_TOKEN',
        errorMessage: 'GitHub synchronization requires an OAuth access token.',
      };
    }

    const token = context.accessToken;

    try {
      // 1. Fetch authenticated user profile to get login username for activity events
      const user = await this.client.getAuthenticatedUser(token);
      const username = user.login;

      // 2. Fetch user repositories (up to 100 recent)
      const rawRepos = await this.client.getUserRepositories(token, { perPage: 100, sort: 'pushed' });

      // Fetch languages for the top 10 most recent repos to conserve rate limit
      const normalizedRepos: NormalizedRepositoryData[] = [];
      for (let i = 0; i < rawRepos.length; i++) {
        const repo = rawRepos[i];
        if (!repo) continue;
        let languages: Record<string, number> = {};

        // Only query languages for first 10 repositories to stay well within GitHub limits
        if (i < 10 && repo.owner && repo.name) {
          try {
            languages = await this.client.getRepoLanguages(repo.owner.login, repo.name, token);
          } catch {
            languages = {};
          }
        } else if (repo.language) {
          languages[repo.language] = 100;
        }

        normalizedRepos.push(GitHubMapper.toNormalizedRepository(repo, languages));
      }

      // 3. Fetch public events for the user
      const rawEvents = await this.client.getUserPublicEvents(username, token, 30);
      const normalizedActivities: NormalizedActivityData[] = rawEvents.map((evt) =>
        GitHubMapper.toNormalizedActivity(evt)
      );

      // Determine new sync cursor based on latest activity or pushed timestamp
      const latestActivityTime = normalizedActivities.length > 0 && normalizedActivities[0] ? normalizedActivities[0].occurredAt : null;
      const nextCursor = latestActivityTime || new Date().toISOString();

      return {
        success: true,
        repositories: normalizedRepos,
        activities: normalizedActivities,
        nextCursor,
      };
    } catch (err: unknown) {
      if (err instanceof ProviderRateLimitError) {
        return {
          success: false,
          repositories: [],
          activities: [],
          isRateLimited: true,
          rateLimitReset: err.resetAt,
          errorCode: 'RATE_LIMITED',
          errorMessage: err.message,
        };
      }

      const message = err instanceof Error ? err.message : 'Unknown GitHub synchronization error.';
      return {
        success: false,
        repositories: [],
        activities: [],
        errorCode: 'SYNC_ERROR',
        errorMessage: message,
      };
    }
  }
}
