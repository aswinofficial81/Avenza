export interface CodeforcesApiResponse<T> {
  status: 'OK' | 'FAILED';
  result?: T;
  comment?: string;
}

export interface CodeforcesUser {
  handle: string;
  email?: string;
  vkId?: string;
  openId?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  city?: string;
  organization?: string;
  contribution: number;
  rank?: string;
  rating?: number;
  maxRank?: string;
  maxRating?: number;
  lastOnlineTimeSeconds?: number;
  registrationTimeSeconds?: number;
  friendOfCount?: number;
  avatar?: string;
  titlePhoto?: string;
}

export interface CodeforcesRatingChange {
  contestId: number;
  contestName: string;
  handle: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

export interface CodeforcesProblem {
  contestId?: number;
  problemsetName?: string;
  index: string;
  name: string;
  type: 'PROGRAMMING' | 'QUESTION';
  points?: number;
  rating?: number;
  tags: string[];
}

export interface CodeforcesMember {
  handle: string;
}

export interface CodeforcesParty {
  contestId?: number;
  members: CodeforcesMember[];
  participantType: 'CONTESTANT' | 'PRACTICE' | 'VIRTUAL' | 'MANAGER' | 'OUT_OF_COMPETITION';
  ghost?: boolean;
  room?: number;
  startTimeSeconds?: number;
}

export interface CodeforcesSubmission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  relativeTimeSeconds?: number;
  problem: CodeforcesProblem;
  author: CodeforcesParty;
  programmingLanguage: string;
  verdict?:
    | 'FAILED'
    | 'OK'
    | 'PARTIAL'
    | 'COMPILATION_ERROR'
    | 'RUNTIME_ERROR'
    | 'WRONG_ANSWER'
    | 'PRESENTATION_ERROR'
    | 'TIME_LIMIT_EXCEEDED'
    | 'MEMORY_LIMIT_EXCEEDED'
    | 'IDLENESS_LIMIT_EXCEEDED'
    | 'SECURITY_VIOLATED'
    | 'CRASHED'
    | 'INPUT_PREPARATION_CRASHED'
    | 'CHALLENGED'
    | 'SKIPPED'
    | 'TESTING'
    | 'REJECTED';
  testset?: string;
  passedTestCount: number;
  timeConsumedMillis: number;
  memoryConsumedBytes: number;
  points?: number;
}
