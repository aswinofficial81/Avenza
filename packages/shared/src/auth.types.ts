import type { ApiSuccessResponse } from './index';

export interface AuthUserProfile {
  id: string;
  clerkUserId: string;
  displayName: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthMeData {
  clerkUserId: string;
  profile: AuthUserProfile;
}

export type AuthMeResponse = ApiSuccessResponse<AuthMeData>;
