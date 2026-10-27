export interface LeetCodeSubmissionNum {
  difficulty: 'All' | 'Easy' | 'Medium' | 'Hard';
  count: number;
  submissions: number;
}

export interface LeetCodeMatchedUser {
  username: string;
  githubUrl?: string | null;
  twitterUrl?: string | null;
  linkedinUrl?: string | null;
  profile: {
    realName?: string | null;
    userAvatar?: string | null;
    ranking?: number | null;
    reputation?: number | null;
    aboutMe?: string | null;
    countryName?: string | null;
  } | null;
  submitStats: {
    acSubmissionNum: LeetCodeSubmissionNum[];
    totalSubmissionNum?: LeetCodeSubmissionNum[];
  } | null;
}

export interface LeetCodeUserContestRanking {
  attendedContestsCount: number;
  rating: number;
  globalRanking: number;
  totalParticipants: number;
  topPercentage: number;
  badge?: {
    name: string;
  } | null;
}

export interface LeetCodeRecentSubmission {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string;
}

export interface LeetCodeProfileQueryResult {
  data?: {
    matchedUser?: LeetCodeMatchedUser | null;
  };
  errors?: Array<{ message: string }>;
}

export interface LeetCodeContestQueryResult {
  data?: {
    userContestRanking?: LeetCodeUserContestRanking | null;
  };
  errors?: Array<{ message: string }>;
}

export interface LeetCodeRecentSubmissionsQueryResult {
  data?: {
    recentAcSubmissionList?: LeetCodeRecentSubmission[] | null;
  };
  errors?: Array<{ message: string }>;
}
