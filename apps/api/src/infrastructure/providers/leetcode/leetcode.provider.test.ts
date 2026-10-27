import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderRateLimitError } from '../base/provider.types';
import { defaultProviderRegistry } from '../base/provider.registry';
import { LeetCodeAuthAdapter } from './leetcode.auth';
import { LeetCodeClient } from './leetcode.client';
import { LeetCodeProvider } from './leetcode.provider';
import { LeetCodeSyncProvider } from './leetcode.sync';
import {
  mapLeetCodeProfileToIdentity,
  mapLeetCodeStatsToSyncState,
  mapRecentSubmissionsToActivities,
} from './leetcode.mapper';
import type {
  LeetCodeMatchedUser,
  LeetCodeRecentSubmission,
  LeetCodeUserContestRanking,
} from './leetcode.types';

describe('Phase 14B LeetCode Provider, Client & Normalization', () => {
  let mockClient: LeetCodeClient;
  let authAdapter: LeetCodeAuthAdapter;
  let syncAdapter: LeetCodeSyncProvider;
  let provider: LeetCodeProvider;

  const sampleProfile: LeetCodeMatchedUser = {
    username: 'aswinofficial81',
    githubUrl: 'https://github.com/aswinofficial81',
    profile: {
      realName: 'Aswin Babu',
      userAvatar: 'https://assets.leetcode.com/users/aswinofficial81/avatar_123.png',
      ranking: 154200,
      reputation: 15,
      aboutMe: 'Software Engineer',
      countryName: 'India',
    },
    submitStats: {
      acSubmissionNum: [
        { difficulty: 'All', count: 185, submissions: 320 },
        { difficulty: 'Easy', count: 95, submissions: 140 },
        { difficulty: 'Medium', count: 78, submissions: 150 },
        { difficulty: 'Hard', count: 12, submissions: 30 },
      ],
    },
  };

  const sampleContest: LeetCodeUserContestRanking = {
    attendedContestsCount: 8,
    rating: 1645.72,
    globalRanking: 32100,
    totalParticipants: 110000,
    topPercentage: 29.18,
    badge: { name: 'Knight' },
  };

  const sampleSubmissions: LeetCodeRecentSubmission[] = [
    {
      id: '1145293812',
      title: 'Two Sum',
      titleSlug: 'two-sum',
      timestamp: '1728130800', // Oct 5, 2024
    },
    {
      id: '1145293813',
      title: 'Add Two Numbers',
      titleSlug: 'add-two-numbers',
      timestamp: '1728134400',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    mockClient = new LeetCodeClient();
    authAdapter = new LeetCodeAuthAdapter(mockClient);
    syncAdapter = new LeetCodeSyncProvider(mockClient);
    provider = new LeetCodeProvider(mockClient);
  });

  describe('1. Provider Registration & Capabilities', () => {
    it('is registered in defaultProviderRegistry', () => {
      expect(defaultProviderRegistry.has('leetcode')).toBe(true);
      const registered = defaultProviderRegistry.getOrThrow('leetcode');
      expect(registered.getProviderId()).toBe('leetcode');
    });

    it('exposes approved capabilities: profile, activity, read_only', () => {
      expect(provider.hasCapability('profile')).toBe(true);
      expect(provider.hasCapability('activity')).toBe(true);
      expect(provider.hasCapability('read_only')).toBe(true);
      expect(provider.hasCapability('oauth')).toBe(false);
      expect(provider.hasCapability('repositories')).toBe(false);
    });
  });

  describe('2. LeetCodeAuthAdapter & Username Validation', () => {
    it('successfully connects valid username and returns normalized identity', async () => {
      vi.spyOn(mockClient, 'fetchUserProfile').mockResolvedValue(sampleProfile);

      const identity = await authAdapter.connectWithIdentifier('aswinofficial81');
      expect(identity.externalAccountId).toBe('aswinofficial81');
      expect(identity.username).toBe('aswinofficial81');
      expect(identity.displayName).toBe('Aswin Babu');
      expect(identity.avatarUrl).toContain('avatar_123.png');
    });

    it('rejects empty or whitespace-only username', async () => {
      await expect(authAdapter.connectWithIdentifier('   ')).rejects.toThrow(
        'LeetCode username must be between 1 and 100 characters.'
      );
    });

    it('rejects usernames containing illegal characters', async () => {
      await expect(authAdapter.connectWithIdentifier('user@domain.com')).rejects.toThrow(
        'invalid characters'
      );
      await expect(authAdapter.connectWithIdentifier('user$123')).rejects.toThrow(
        'invalid characters'
      );
    });

    it('throws when user does not exist on LeetCode', async () => {
      vi.spyOn(mockClient, 'fetchUserProfile').mockResolvedValue(null);

      await expect(authAdapter.connectWithIdentifier('nonexistent_user_99999')).rejects.toThrow(
        'was not found or profile is inaccessible'
      );
    });

    it('throws if OAuth methods are invoked', async () => {
      expect(() => authAdapter.createAuthorizationUrl()).toThrow('OAuth 2.0 is not supported');
      await expect(authAdapter.exchangeCodeForTokens()).rejects.toThrow('OAuth 2.0 is not supported');
      await expect(authAdapter.fetchIdentity()).rejects.toThrow('not supported');
    });
  });

  describe('3. LeetCodeClient GraphQL Queries & Error Handling', () => {
    it('executes successful profile query', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { matchedUser: sampleProfile },
        }),
      } as Response);

      const profile = await mockClient.fetchUserProfile('aswinofficial81');
      expect(profile).not.toBeNull();
      expect(profile?.username).toBe('aswinofficial81');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://leetcode.com/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Referer: 'https://leetcode.com',
          }),
        })
      );
    });

    it('handles contest ranking query correctly', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { userContestRanking: sampleContest },
        }),
      } as Response);

      const contest = await mockClient.fetchUserContestRanking('aswinofficial81');
      expect(contest?.rating).toBe(1645.72);
      expect(contest?.attendedContestsCount).toBe(8);
    });

    it('handles recent accepted submissions query', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { recentAcSubmissionList: sampleSubmissions },
        }),
      } as Response);

      const subs = await mockClient.fetchRecentAcSubmissions('aswinofficial81', 20);
      expect(subs).toHaveLength(2);
      expect(subs[0]?.titleSlug).toBe('two-sum');
    });

    it('handles 429 Rate Limit error gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ message: 'Too Many Requests' }),
      } as Response);

      await expect(mockClient.fetchUserProfile('aswinofficial81')).rejects.toThrow(
        ProviderRateLimitError
      );
    });

    it('handles 403 Forbidden error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Forbidden' }),
      } as Response);

      await expect(mockClient.fetchUserProfile('aswinofficial81')).rejects.toThrow(
        'LeetCode request forbidden or blocked by security policy.'
      );
    });

    it('handles request timeout error', async () => {
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError);

      await expect(mockClient.fetchUserProfile('aswinofficial81')).rejects.toThrow(
        'LeetCode GraphQL request timed out.'
      );
    });
  });

  describe('4. Sync Provider & Normalization', () => {
    it('synchronizes profile stats, contest rating, and recent submissions', async () => {
      vi.spyOn(mockClient, 'fetchUserProfile').mockResolvedValue(sampleProfile);
      vi.spyOn(mockClient, 'fetchUserContestRanking').mockResolvedValue(sampleContest);
      vi.spyOn(mockClient, 'fetchRecentAcSubmissions').mockResolvedValue(sampleSubmissions);

      const result = await syncAdapter.sync({
        userId: 'usr-123',
        connectionId: 'conn-123',
        accountIdentifier: 'aswinofficial81',
      });

      expect(result.success).toBe(true);
      expect(result.repositories).toHaveLength(0);
      expect(result.activities).toHaveLength(2);

      // Verify activity normalization
      const firstAct = result.activities[0]!;
      expect(firstAct.externalId).toBe('submission:1145293812');
      expect(firstAct.activityType).toBe('dsa_solve');
      expect(firstAct.title).toBe('Solved Two Sum');
      expect(firstAct.externalUrl).toBe('https://leetcode.com/problems/two-sum/');
      expect(firstAct.metadata).toEqual({
        platform: 'leetcode',
        titleSlug: 'two-sum',
        submissionId: '1145293812',
      });

      // Verify sync state
      const state = result.syncState as import('@avenza/shared').LeetCodeSyncState;
      expect(state.totalSolved).toBe(185);
      expect(state.easySolved).toBe(95);
      expect(state.mediumSolved).toBe(78);
      expect(state.hardSolved).toBe(12);
      expect(state.ranking).toBe(154200);
      expect(state.contestRating).toBe(1646);
      expect(state.attendedContests).toBe(8);
    });

    it('handles rate limits in sync adapter cleanly', async () => {
      vi.spyOn(mockClient, 'fetchUserProfile').mockRejectedValue(
        new ProviderRateLimitError('Rate limited')
      );

      const result = await syncAdapter.sync({
        userId: 'usr-123',
        connectionId: 'conn-123',
        accountIdentifier: 'aswinofficial81',
      });

      expect(result.success).toBe(false);
      expect(result.isRateLimited).toBe(true);
      expect(result.errorCode).toBe('RATE_LIMITED');
    });

    it('guarantees identical externalIds across repeated syncs for idempotency', () => {
      const activitiesRun1 = mapRecentSubmissionsToActivities(sampleSubmissions);
      const activitiesRun2 = mapRecentSubmissionsToActivities(sampleSubmissions);

      expect(activitiesRun1.map((a) => a.externalId)).toEqual(
        activitiesRun2.map((a) => a.externalId)
      );
      expect(activitiesRun1[0]?.externalId).toBe('submission:1145293812');
    });

    it('maps profile to external identity correctly', () => {
      const identity = mapLeetCodeProfileToIdentity(sampleProfile);
      expect(identity.externalAccountId).toBe('aswinofficial81');
      expect(identity.username).toBe('aswinofficial81');
      expect(identity.displayName).toBe('Aswin Babu');
      expect(identity.avatarUrl).toBe('https://assets.leetcode.com/users/aswinofficial81/avatar_123.png');
    });

    it('maps stats to sync state correctly', () => {
      const state = mapLeetCodeStatsToSyncState(sampleProfile, sampleContest);
      expect(state.totalSolved).toBe(185);
      expect(state.easySolved).toBe(95);
      expect(state.mediumSolved).toBe(78);
      expect(state.hardSolved).toBe(12);
      expect(state.ranking).toBe(154200);
      expect(state.contestRating).toBe(1646);
      expect(state.attendedContests).toBe(8);
    });
  });
});
