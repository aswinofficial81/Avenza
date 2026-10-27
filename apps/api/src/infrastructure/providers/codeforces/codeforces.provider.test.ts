import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CodeforcesSyncState } from '@avenza/shared';
import { ProviderRateLimitError } from '../base/provider.types';
import { defaultProviderRegistry, ProviderRegistry } from '../base/provider.registry';
import { CodeforcesAuthAdapter } from './codeforces.auth';
import { CodeforcesClient } from './codeforces.client';
import { CodeforcesProvider } from './codeforces.provider';
import { CodeforcesSyncProvider } from './codeforces.sync';
import {
  mapCodeforcesToSyncState,
  mapCodeforcesUserToIdentity,
  mapContestsToActivities,
  mapRecentSubmissionsToActivities,
} from './codeforces.mapper';
import type {
  CodeforcesRatingChange,
  CodeforcesSubmission,
  CodeforcesUser,
} from './codeforces.types';

describe('Phase 14C Codeforces Provider, Client & Normalization', () => {
  let mockClient: CodeforcesClient;
  let authAdapter: CodeforcesAuthAdapter;
  let syncAdapter: CodeforcesSyncProvider;
  let provider: CodeforcesProvider;

  const sampleUser: CodeforcesUser = {
    handle: 'tourist',
    firstName: 'Gennady',
    lastName: 'Korotkevich',
    country: 'Belarus',
    city: 'Gomel',
    organization: 'ITMO University',
    contribution: 112,
    rank: 'legendary grandmaster',
    rating: 3384,
    maxRank: 'tourist',
    maxRating: 4009,
    lastOnlineTimeSeconds: 1791178508,
    registrationTimeSeconds: 1265987288,
    friendOfCount: 91096,
    avatar: 'https://userpic.codeforces.org/422/avatar/2b5dbe87f0d859a2.jpg',
    titlePhoto: 'https://userpic.codeforces.org/422/title/50a270ed4a722867.jpg',
  };

  const sampleRatingChanges: CodeforcesRatingChange[] = [
    {
      contestId: 2245,
      contestName: 'Codeforces Round 1110 (Div. 1)',
      handle: 'tourist',
      rank: 2,
      ratingUpdateTimeSeconds: 1784222100,
      oldRating: 3439,
      newRating: 3528,
    },
    {
      contestId: 2268,
      contestName: 'Codeforces Round 1124 (Div. 1)',
      handle: 'tourist',
      rank: 1,
      ratingUpdateTimeSeconds: 1790442300,
      oldRating: 3528,
      newRating: 3580,
    },
  ];

  const sampleSubmissions: CodeforcesSubmission[] = [
    {
      id: 392217392,
      contestId: 2268,
      creationTimeSeconds: 1790438553,
      problem: {
        contestId: 2268,
        index: 'D',
        name: 'AghaBalaSar and Hamed',
        type: 'PROGRAMMING',
        rating: 2600,
        tags: ['data structures', 'dp', 'trees'],
      },
      author: {
        contestId: 2268,
        members: [{ handle: 'tourist' }],
        participantType: 'CONTESTANT',
      },
      programmingLanguage: 'C++23 (GCC 14-64, msys2)',
      verdict: 'OK',
      passedTestCount: 40,
      timeConsumedMillis: 265,
      memoryConsumedBytes: 36352000,
    },
    {
      id: 392216500,
      contestId: 2268,
      creationTimeSeconds: 1790437500,
      problem: {
        contestId: 2268,
        index: 'E',
        name: 'Unsolved Problem',
        type: 'PROGRAMMING',
        rating: 3000,
        tags: ['geometry'],
      },
      author: {
        contestId: 2268,
        members: [{ handle: 'tourist' }],
        participantType: 'CONTESTANT',
      },
      programmingLanguage: 'C++23',
      verdict: 'WRONG_ANSWER',
      passedTestCount: 5,
      timeConsumedMillis: 50,
      memoryConsumedBytes: 1024000,
    },
    {
      id: 392208993,
      contestId: 2268,
      creationTimeSeconds: 1790437169,
      problem: {
        contestId: 2268,
        index: 'C',
        name: 'KiaKio and Energy Intervals',
        type: 'PROGRAMMING',
        rating: 2300,
        tags: ['binary search', 'greedy'],
      },
      author: {
        contestId: 2268,
        members: [{ handle: 'tourist' }],
        participantType: 'CONTESTANT',
      },
      programmingLanguage: 'C++23 (GCC 14-64, msys2)',
      verdict: 'OK',
      passedTestCount: 48,
      timeConsumedMillis: 296,
      memoryConsumedBytes: 44953600,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    mockClient = new CodeforcesClient({ minIntervalMs: 0 }); // 0 ms delay in test suite for speed
    authAdapter = new CodeforcesAuthAdapter(mockClient);
    syncAdapter = new CodeforcesSyncProvider(mockClient);
    provider = new CodeforcesProvider(mockClient);
  });

  describe('1. Provider Registration & Capabilities', () => {
    it('initializes defaultProviderRegistry with codeforces registered', () => {
      expect(defaultProviderRegistry.has('codeforces')).toBe(true);
      expect(defaultProviderRegistry.get('codeforces')).toBeDefined();
    });

    it('rejects unsupported providers cleanly', () => {
      const registry = new ProviderRegistry();
      const unsupported = 'atcoder' as unknown as import('@avenza/shared').IntegrationProvider;
      expect(registry.has(unsupported)).toBe(false);
      expect(() => registry.getOrThrow(unsupported)).toThrow(
        'Provider "atcoder" is not registered or supported in this phase.'
      );
    });

    it('declares exact supported capabilities', () => {
      expect(provider.getProviderId()).toBe('codeforces');
      expect(provider.hasCapability('profile')).toBe(true);
      expect(provider.hasCapability('activity')).toBe(true);
      expect(provider.hasCapability('read_only')).toBe(true);
      expect(provider.hasCapability('oauth')).toBe(false);
      expect(provider.hasCapability('repositories')).toBe(false);
    });
  });

  describe('2. Authentication & Handle Validation', () => {
    it('validates and accepts valid Codeforces handle', async () => {
      vi.spyOn(mockClient, 'fetchUserInfo').mockResolvedValue(sampleUser);

      const identity = await authAdapter.connectWithIdentifier('tourist');
      expect(identity.externalAccountId).toBe('tourist');
      expect(identity.username).toBe('tourist');
      expect(identity.displayName).toBe('Gennady Korotkevich');
      expect(identity.avatarUrl).toBe('https://userpic.codeforces.org/422/avatar/2b5dbe87f0d859a2.jpg');
      expect(identity.email).toBeNull();
    });

    it('falls back to handle for displayName when firstName and lastName are missing', async () => {
      const anonymousUser: CodeforcesUser = {
        ...sampleUser,
        firstName: undefined,
        lastName: undefined,
      };
      vi.spyOn(mockClient, 'fetchUserInfo').mockResolvedValue(anonymousUser);

      const identity = await authAdapter.connectWithIdentifier('tourist');
      expect(identity.displayName).toBe('tourist');
    });

    it('rejects handles that are too short or too long', async () => {
      await expect(authAdapter.connectWithIdentifier('ab')).rejects.toThrow(
        'Codeforces handle must be between 3 and 24 characters.'
      );
      await expect(
        authAdapter.connectWithIdentifier('this_handle_is_way_too_long_for_cf')
      ).rejects.toThrow('Codeforces handle must be between 3 and 24 characters.');
    });

    it('rejects handles with invalid special characters', async () => {
      await expect(authAdapter.connectWithIdentifier('tourist@cf')).rejects.toThrow(
        'Codeforces handle contains invalid characters.'
      );
    });

    it('throws error when user is not found on Codeforces', async () => {
      vi.spyOn(mockClient, 'fetchUserInfo').mockRejectedValue(
        new Error('Codeforces user "unknown_handle" was not found.')
      );

      await expect(authAdapter.connectWithIdentifier('unknown_handle')).rejects.toThrow(
        'Codeforces user "unknown_handle" was not found.'
      );
    });
  });

  describe('3. CodeforcesClient & Throttling', () => {
    it('fetches user info successfully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          status: 'OK',
          result: [sampleUser],
        }),
      } as Response);

      const user = await mockClient.fetchUserInfo('tourist');
      expect(user.handle).toBe('tourist');
      expect(user.rating).toBe(3384);
    });

    it('handles rating history fetch successfully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          status: 'OK',
          result: sampleRatingChanges,
        }),
      } as Response);

      const rating = await mockClient.fetchUserRating('tourist');
      expect(rating).toHaveLength(2);
      expect(rating[1]?.contestName).toBe('Codeforces Round 1124 (Div. 1)');
    });

    it('returns empty array when user has no contest history (not found in rating)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 400,
        json: async () => ({
          status: 'FAILED',
          comment: 'handle: Rating for handle new_coder not found',
        }),
      } as Response);

      const rating = await mockClient.fetchUserRating('new_coder');
      expect(rating).toEqual([]);
    });

    it('throws ProviderRateLimitError on HTTP 429', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 429,
        json: async () => ({ status: 'FAILED', comment: 'Too Many Requests' }),
      } as Response);

      await expect(mockClient.fetchUserInfo('tourist')).rejects.toThrow(
        ProviderRateLimitError
      );
    });

    it('throws ProviderRateLimitError on status FAILED with Call limit exceeded', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 400,
        json: async () => ({ status: 'FAILED', comment: 'Call limit exceeded' }),
      } as Response);

      await expect(mockClient.fetchUserInfo('tourist')).rejects.toThrow(
        ProviderRateLimitError
      );
    });

    it('throws descriptive error on request timeout', async () => {
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError);

      await expect(mockClient.fetchUserInfo('tourist')).rejects.toThrow(
        'Codeforces API request timed out.'
      );
    });

    it('enforces sequential throttling delay between calls', async () => {
      const clientWithThrottle = new CodeforcesClient({ minIntervalMs: 50 });
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        status: 200,
        json: async () => ({ status: 'OK', result: [sampleUser] }),
      } as Response);

      const start = Date.now();
      await clientWithThrottle.fetchUserInfo('tourist');
      await clientWithThrottle.fetchUserInfo('tourist');
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(40); // 50ms interval between calls
    });
  });

  describe('4. Data Mapping & Sync Provider', () => {
    it('synchronizes user profile, rating history, and recent accepted submissions', async () => {
      vi.spyOn(mockClient, 'fetchUserInfo').mockResolvedValue(sampleUser);
      vi.spyOn(mockClient, 'fetchUserRating').mockResolvedValue(sampleRatingChanges);
      vi.spyOn(mockClient, 'fetchRecentSubmissions').mockResolvedValue(sampleSubmissions);

      const result = await syncAdapter.sync({
        userId: 'usr-123',
        connectionId: 'conn-123',
        accountIdentifier: 'tourist',
      });

      expect(result.success).toBe(true);
      expect(result.repositories).toHaveLength(0);
      // 2 accepted submissions + 2 rated contests = 4 activities
      expect(result.activities).toHaveLength(4);

      // Verify submission activity
      const subActivity = result.activities.find((a) => a.externalId === 'submission:392217392');
      expect(subActivity).toBeDefined();
      expect(subActivity?.activityType).toBe('dsa_solve');
      expect(subActivity?.title).toBe('Solved AghaBalaSar and Hamed');
      expect(subActivity?.externalUrl).toBe('https://codeforces.com/contest/2268/problem/D');
      expect(subActivity?.metadata).toEqual({
        platform: 'codeforces',
        contestId: 2268,
        index: 'D',
        problemRating: 2600,
        tags: ['data structures', 'dp', 'trees'],
        programmingLanguage: 'C++23 (GCC 14-64, msys2)',
        submissionId: 392217392,
      });

      // Verify contest activity
      const contestActivity = result.activities.find((a) => a.externalId === 'contest:2268');
      expect(contestActivity).toBeDefined();
      expect(contestActivity?.activityType).toBe('contest_participation');
      expect(contestActivity?.title).toBe('Competed in Codeforces Round 1124 (Div. 1)');
      expect(contestActivity?.externalUrl).toBe('https://codeforces.com/contest/2268');
      expect(contestActivity?.metadata).toEqual({
        platform: 'codeforces',
        contestId: 2268,
        rank: 1,
        oldRating: 3528,
        newRating: 3580,
        ratingChange: 52,
      });

      // Verify sync state
      const state = result.syncState as CodeforcesSyncState;
      expect(state.handle).toBe('tourist');
      expect(state.rating).toBe(3384);
      expect(state.maxRating).toBe(4009);
      expect(state.rank).toBe('legendary grandmaster');
      expect(state.maxRank).toBe('tourist');
      expect(state.contribution).toBe(112);
      expect(state.ratedContestsParticipated).toBe(2);
      expect(state.lastContestId).toBe(2268);
      expect(state.lastContestName).toBe('Codeforces Round 1124 (Div. 1)');
      expect(state.lastContestRank).toBe(1);
    });

    it('filters out non-OK submissions strictly', () => {
      const activities = mapRecentSubmissionsToActivities(sampleSubmissions);
      // Sample has 2 OK and 1 WRONG_ANSWER
      expect(activities).toHaveLength(2);
      expect(activities.map((a) => a.externalId)).toEqual([
        'submission:392217392',
        'submission:392208993',
      ]);
    });

    it('limits contest activities to latest 5', () => {
      const sixContests: CodeforcesRatingChange[] = Array.from({ length: 6 }, (_, i) => ({
        contestId: 1000 + i,
        contestName: `Contest ${i}`,
        handle: 'tourist',
        rank: i + 1,
        ratingUpdateTimeSeconds: 1700000000 + i * 1000,
        oldRating: 3000 + i * 10,
        newRating: 3010 + i * 10,
      }));

      const activities = mapContestsToActivities(sixContests, 5);
      expect(activities).toHaveLength(5);
      // Most recent first
      expect(activities[0]?.externalId).toBe('contest:1005');
    });

    it('handles rate limits cleanly during sync', async () => {
      vi.spyOn(mockClient, 'fetchUserInfo').mockRejectedValue(
        new ProviderRateLimitError('Call limit exceeded')
      );

      const result = await syncAdapter.sync({
        userId: 'usr-123',
        connectionId: 'conn-123',
        accountIdentifier: 'tourist',
      });

      expect(result.success).toBe(false);
      expect(result.isRateLimited).toBe(true);
      expect(result.errorCode).toBe('RATE_LIMITED');
    });

    it('guarantees identical externalIds across repeated sync runs for idempotency', () => {
      const run1 = [
        ...mapRecentSubmissionsToActivities(sampleSubmissions),
        ...mapContestsToActivities(sampleRatingChanges),
      ];
      const run2 = [
        ...mapRecentSubmissionsToActivities(sampleSubmissions),
        ...mapContestsToActivities(sampleRatingChanges),
      ];

      expect(run1.map((a) => a.externalId)).toEqual(run2.map((a) => a.externalId));
    });

    it('maps Codeforces user to external identity correctly', () => {
      const identity = mapCodeforcesUserToIdentity(sampleUser);
      expect(identity.externalAccountId).toBe('tourist');
      expect(identity.username).toBe('tourist');
      expect(identity.displayName).toBe('Gennady Korotkevich');
      expect(identity.avatarUrl).toBe('https://userpic.codeforces.org/422/avatar/2b5dbe87f0d859a2.jpg');
    });

    it('maps Codeforces user and rating changes to sync state correctly', () => {
      const syncState = mapCodeforcesToSyncState(sampleUser, sampleRatingChanges);
      expect(syncState.handle).toBe('tourist');
      expect(syncState.rating).toBe(3384);
      expect(syncState.maxRating).toBe(4009);
      expect(syncState.rank).toBe('legendary grandmaster');
      expect(syncState.ratedContestsParticipated).toBe(2);
      expect(syncState.lastContestId).toBe(2268);
      expect(syncState.lastContestName).toBe('Codeforces Round 1124 (Div. 1)');
      expect(syncState.lastContestRank).toBe(1);
    });
  });
});
