export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  tokenType?: string;
  scope?: string;
}

export interface ExternalIdentity {
  externalAccountId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  rawProfile?: Record<string, unknown>;
}

export interface NormalizedRepositoryData {
  externalId: string;
  name: string;
  fullName: string;
  owner: string;
  isPrivate: boolean;
  htmlUrl: string;
  description: string | null;
  defaultBranch: string;
  primaryLanguage: string | null;
  languages: Record<string, number>;
  starsCount: number;
  forksCount: number;
  openIssuesCount: number;
  pushedAt: string | null;
}

export interface NormalizedActivityData {
  externalId: string;
  activityType: string;
  occurredAt: string;
  title: string;
  summary: string | null;
  externalUrl: string | null;
  repositoryExternalId?: string | null;
  metadata: Record<string, unknown>;
  rawPayload?: Record<string, unknown> | null;
}

import type { NormalizedCalendarEvent } from '@avenza/shared';

export interface SyncContext {
  userId: string;
  connectionId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  accountIdentifier?: string | null;
  syncCursor?: string | null;
  syncState?: Record<string, unknown> | null;
  lastSyncedAt?: string | null;
}

export interface SyncResult {
  success: boolean;
  repositories: NormalizedRepositoryData[];
  activities: NormalizedActivityData[];
  calendarEvents?: NormalizedCalendarEvent[];
  syncState?: Record<string, unknown> | null;
  nextCursor?: string | null;
  isRateLimited?: boolean;
  rateLimitReset?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export class ProviderRateLimitError extends Error {
  constructor(
    message: string,
    public readonly resetAt: number | null = null
  ) {
    super(message);
    this.name = 'ProviderRateLimitError';
  }
}

export class ProviderAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'AUTH_ERROR'
  ) {
    super(message);
    this.name = 'ProviderAuthError';
  }
}
