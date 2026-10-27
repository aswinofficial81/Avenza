import type { ISyncProvider } from '../base/sync.interface';
import {
  ProviderRateLimitError,
  type SyncContext,
  type SyncResult,
} from '../base/provider.types';
import { CodeforcesClient } from './codeforces.client';
import {
  mapCodeforcesToSyncState,
  mapContestsToActivities,
  mapRecentSubmissionsToActivities,
} from './codeforces.mapper';

export class CodeforcesSyncProvider implements ISyncProvider {
  constructor(private readonly client: CodeforcesClient = new CodeforcesClient()) {}

  async sync(context: SyncContext): Promise<SyncResult> {
    const handle = context.accountIdentifier;
    if (!handle) {
      return {
        success: false,
        repositories: [],
        activities: [],
        errorCode: 'MISSING_HANDLE',
        errorMessage: 'Codeforces handle is required for synchronization.',
      };
    }

    try {
      // 1. Fetch user profile (current rating, rank, avatar, stats)
      const user = await this.client.fetchUserInfo(handle);

      // 2. Fetch rating history (sequential - client throttles >= 2000ms)
      const ratingChanges = await this.client.fetchUserRating(handle);

      // 3. Fetch latest 20 submissions (sequential - client throttles >= 2000ms)
      const submissions = await this.client.fetchRecentSubmissions(handle, 20);

      // 4. Normalize sync state
      const syncState = mapCodeforcesToSyncState(user, ratingChanges);

      // 5. Ingest accepted solves among the latest 20 submissions
      const submissionActivities = mapRecentSubmissionsToActivities(submissions);

      // 6. Ingest up to latest 5 rated contest participations
      const contestActivities = mapContestsToActivities(ratingChanges, 5);

      const allActivities = [...submissionActivities, ...contestActivities];

      return {
        success: true,
        repositories: [],
        activities: allActivities,
        syncState,
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

      const errorMessage =
        err instanceof Error ? err.message : 'Unknown Codeforces synchronization error';

      return {
        success: false,
        repositories: [],
        activities: [],
        errorCode: 'SYNC_FAILED',
        errorMessage,
      };
    }
  }
}
