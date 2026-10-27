import type { CodeforcesSyncState } from '@avenza/shared';
import type { ExternalIdentity, NormalizedActivityData } from '../base/provider.types';
import type {
  CodeforcesRatingChange,
  CodeforcesSubmission,
  CodeforcesUser,
} from './codeforces.types';

export function mapCodeforcesUserToIdentity(user: CodeforcesUser): ExternalIdentity {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const displayName = fullName.length > 0 ? fullName : user.handle;
  const avatarUrl = user.avatar || user.titlePhoto || null;

  return {
    externalAccountId: user.handle,
    username: user.handle,
    displayName,
    avatarUrl,
    email: null,
    rawProfile: {
      rating: user.rating,
      maxRating: user.maxRating,
      rank: user.rank,
      maxRank: user.maxRank,
      contribution: user.contribution,
      organization: user.organization,
    },
  };
}

export function mapCodeforcesToSyncState(
  user: CodeforcesUser,
  ratingChanges: CodeforcesRatingChange[] = []
): CodeforcesSyncState {
  const lastContest =
    ratingChanges.length > 0 ? ratingChanges[ratingChanges.length - 1] : undefined;

  return {
    handle: user.handle,
    rating: user.rating ?? null,
    maxRating: user.maxRating ?? null,
    rank: user.rank ?? null,
    maxRank: user.maxRank ?? null,
    contribution: user.contribution ?? 0,
    ratedContestsParticipated: ratingChanges.length,
    lastContestId: lastContest?.contestId ?? null,
    lastContestName: lastContest?.contestName ?? null,
    lastContestRank: lastContest?.rank ?? null,
  };
}

export function mapRecentSubmissionsToActivities(
  submissions: CodeforcesSubmission[]
): NormalizedActivityData[] {
  // Only ingest accepted solves (verdict === 'OK') among the latest submissions
  const accepted = submissions.filter((s) => s.verdict === 'OK');

  return accepted.map((s) => {
    const contestPart = s.problem.contestId ? `${s.problem.contestId}` : '';
    const contestUrl = s.problem.contestId
      ? `https://codeforces.com/contest/${s.problem.contestId}/problem/${s.problem.index}`
      : `https://codeforces.com/problemset/problem/${s.problem.index}`;

    return {
      externalId: `submission:${s.id}`,
      activityType: 'dsa_solve',
      occurredAt: new Date(s.creationTimeSeconds * 1000).toISOString(),
      title: `Solved ${s.problem.name}`,
      summary: `Solved ${s.problem.name} (${contestPart}${s.problem.index}) on Codeforces`,
      externalUrl: contestUrl,
      metadata: {
        platform: 'codeforces',
        contestId: s.problem.contestId,
        index: s.problem.index,
        problemRating: s.problem.rating,
        tags: s.problem.tags,
        programmingLanguage: s.programmingLanguage,
        submissionId: s.id,
      },
    };
  });
}

export function mapContestsToActivities(
  ratingChanges: CodeforcesRatingChange[],
  maxContests = 5
): NormalizedActivityData[] {
  // Ingest up to latest 5 rated contest participations (from most recent)
  const sorted = [...ratingChanges].sort(
    (a, b) => b.ratingUpdateTimeSeconds - a.ratingUpdateTimeSeconds
  );
  const latestContests = sorted.slice(0, maxContests);

  return latestContests.map((c) => {
    const ratingChange = c.newRating - c.oldRating;
    const sign = ratingChange >= 0 ? '+' : '';

    return {
      externalId: `contest:${c.contestId}`,
      activityType: 'contest_participation',
      occurredAt: new Date(c.ratingUpdateTimeSeconds * 1000).toISOString(),
      title: `Competed in ${c.contestName}`,
      summary: `Finished rank #${c.rank} in ${c.contestName} (Rating: ${c.newRating}, ${sign}${ratingChange})`,
      externalUrl: `https://codeforces.com/contest/${c.contestId}`,
      metadata: {
        platform: 'codeforces',
        contestId: c.contestId,
        rank: c.rank,
        oldRating: c.oldRating,
        newRating: c.newRating,
        ratingChange,
      },
    };
  });
}
