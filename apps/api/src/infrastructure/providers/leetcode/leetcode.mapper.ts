import type { LeetCodeSyncState } from '@avenza/shared';
import type { ExternalIdentity, NormalizedActivityData } from '../base/provider.types';
import type {
  LeetCodeMatchedUser,
  LeetCodeRecentSubmission,
  LeetCodeUserContestRanking,
} from './leetcode.types';

export function mapLeetCodeProfileToIdentity(profile: LeetCodeMatchedUser): ExternalIdentity {
  return {
    externalAccountId: profile.username,
    username: profile.username,
    displayName: profile.profile?.realName || profile.username,
    avatarUrl: profile.profile?.userAvatar || null,
    email: null,
    rawProfile: {
      ranking: profile.profile?.ranking ?? null,
      reputation: profile.profile?.reputation ?? null,
      aboutMe: profile.profile?.aboutMe ?? null,
    },
  };
}

export function mapLeetCodeStatsToSyncState(
  profile: LeetCodeMatchedUser,
  contest?: LeetCodeUserContestRanking | null
): LeetCodeSyncState {
  const acNums = profile.submitStats?.acSubmissionNum || [];

  const allItem = acNums.find((item) => item.difficulty === 'All');
  const easyItem = acNums.find((item) => item.difficulty === 'Easy');
  const mediumItem = acNums.find((item) => item.difficulty === 'Medium');
  const hardItem = acNums.find((item) => item.difficulty === 'Hard');

  return {
    totalSolved: allItem ? allItem.count : 0,
    easySolved: easyItem ? easyItem.count : 0,
    mediumSolved: mediumItem ? mediumItem.count : 0,
    hardSolved: hardItem ? hardItem.count : 0,
    ranking: profile.profile?.ranking ?? null,
    contestRating: contest?.rating ? Math.round(contest.rating) : null,
    attendedContests: contest?.attendedContestsCount ?? null,
  };
}

export function mapRecentSubmissionsToActivities(
  submissions: LeetCodeRecentSubmission[]
): NormalizedActivityData[] {
  return submissions.map((sub) => {
    const timestampSec = parseInt(sub.timestamp, 10);
    const date = !isNaN(timestampSec) ? new Date(timestampSec * 1000) : new Date();

    return {
      externalId: `submission:${sub.id}`,
      activityType: 'dsa_solve',
      occurredAt: date.toISOString(),
      title: `Solved ${sub.title}`,
      summary: `Solved on LeetCode: ${sub.title}`,
      externalUrl: `https://leetcode.com/problems/${sub.titleSlug}/`,
      metadata: {
        platform: 'leetcode',
        titleSlug: sub.titleSlug,
        submissionId: sub.id,
      },
    };
  });
}
