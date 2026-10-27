import type { ISyncProvider } from '../base/sync.interface';
import {
  ProviderRateLimitError,
  type SyncContext,
  type SyncResult,
} from '../base/provider.types';
import { LeetCodeClient } from './leetcode.client';
import {
  mapLeetCodeStatsToSyncState,
  mapRecentSubmissionsToActivities,
} from './leetcode.mapper';

export class LeetCodeSyncProvider implements ISyncProvider {
  constructor(private readonly client: LeetCodeClient = new LeetCodeClient()) {}

  async sync(context: SyncContext): Promise<SyncResult> {
    const username = context.accountIdentifier || context.accessToken;

    if (!username) {
      return {
        success: false,
        repositories: [],
        activities: [],
        errorCode: 'MISSING_IDENTIFIER',
        errorMessage: 'LeetCode username identifier is required for synchronization.',
      };
    }

    try {
      // Fetch profile statistics, contest ranking, and recent 20 accepted submissions
      const [profile, contest, submissions] = await Promise.all([
        this.client.fetchUserProfile(username),
        this.client.fetchUserContestRanking(username),
        this.client.fetchRecentAcSubmissions(username, 20),
      ]);

      if (!profile) {
        return {
          success: false,
          repositories: [],
          activities: [],
          errorCode: 'USER_NOT_FOUND',
          errorMessage: `LeetCode user "${username}" was not found or profile is private.`,
        };
      }

      const syncState = mapLeetCodeStatsToSyncState(profile, contest);
      const activities = mapRecentSubmissionsToActivities(submissions);

      return {
        success: true,
        repositories: [],
        activities,
        syncState: syncState as unknown as Record<string, unknown>,
      };
    } catch (err: unknown) {
      if (err instanceof ProviderRateLimitError) {
        return {
          success: false,
          repositories: [],
          activities: [],
          isRateLimited: true,
          errorCode: 'RATE_LIMITED',
          errorMessage: err.message,
        };
      }

      const message = err instanceof Error ? err.message : 'Unknown LeetCode sync error';
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
