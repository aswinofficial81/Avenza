import { describe, expect, it } from 'vitest';
import {
  IntegrationConnectionDtoSchema,
  IntegrationProviderSchema,
  IntegrationConnectionStatusSchema,
  OAuthInitResponseSchema,
  OAuthCallbackInputSchema,
  DirectConnectInputSchema,
  LeetCodeSyncStateSchema,
  CodeforcesSyncStateSchema,
  CodeforcesConnectInputSchema,
  GoogleCalendarSyncStateSchema,
  NormalizedCalendarEventSchema,
} from './integrations.types';

describe('Integrations Shared Types & Schemas', () => {
  it('validates provider schema strictly', () => {
    expect(IntegrationProviderSchema.safeParse('github').success).toBe(true);
    expect(IntegrationProviderSchema.safeParse('leetcode').success).toBe(true);
    expect(IntegrationProviderSchema.safeParse('codeforces').success).toBe(true);
    expect(IntegrationProviderSchema.safeParse('google_calendar').success).toBe(true);
    expect(IntegrationProviderSchema.safeParse('atcoder').success).toBe(false);
    expect(IntegrationProviderSchema.safeParse('invalid').success).toBe(false);
  });

  it('validates integration connection statuses', () => {
    const validStatuses = [
      'CONNECTED',
      'SYNCING',
      'SYNCED',
      'NEEDS_REAUTHORIZATION',
      'PERMISSION_ERROR',
      'RATE_LIMITED',
      'TEMPORARILY_UNAVAILABLE',
      'DISCONNECTED',
    ];

    for (const status of validStatuses) {
      expect(IntegrationConnectionStatusSchema.safeParse(status).success).toBe(true);
    }
    expect(IntegrationConnectionStatusSchema.safeParse('UNKNOWN').success).toBe(false);
  });

  it('validates safe IntegrationConnectionDto schema without leaking secrets', () => {
    const valid = {
      id: '11111111-1111-1111-1111-111111111111',
      provider: 'github',
      external_account_id: '583231',
      external_username: 'octocat',
      external_display_name: 'The Octocat',
      external_avatar_url: 'https://avatars.githubusercontent.com/u/583231',
      external_email: 'octocat@github.com',
      status: 'CONNECTED',
      scopes: ['read:user', 'repo'],
      last_synced_at: null,
      last_sync_started_at: null,
      last_sync_completed_at: null,
      last_error_code: null,
      last_error_message: null,
      connected_at: '2026-10-04T12:00:00.000Z',
      created_at: '2026-10-04T12:00:00.000Z',
      updated_at: '2026-10-04T12:00:00.000Z',
    };

    const res = IntegrationConnectionDtoSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it('validates OAuth init and callback schemas', () => {
    const validInit = {
      authorization_url: 'https://github.com/login/oauth/authorize?client_id=123&state=abcdefghijklmnop',
      state: 'abcdefghijklmnop',
    };
    expect(OAuthInitResponseSchema.safeParse(validInit).success).toBe(true);

    const validCallback = {
      code: 'auth_code_123',
      state: 'abcdefghijklmnop',
    };
    expect(OAuthCallbackInputSchema.safeParse(validCallback).success).toBe(true);
  });

  it('validates DirectConnectInput and LeetCodeSyncState schemas', () => {
    expect(DirectConnectInputSchema.safeParse({ username: 'tourist' }).success).toBe(true);
    expect(DirectConnectInputSchema.safeParse({ username: '' }).success).toBe(false);

    const validSyncState = {
      totalSolved: 450,
      easySolved: 150,
      mediumSolved: 200,
      hardSolved: 100,
      ranking: 12500,
      contestRating: 2150.5,
      attendedContests: 35,
    };
    expect(LeetCodeSyncStateSchema.safeParse(validSyncState).success).toBe(true);
    expect(LeetCodeSyncStateSchema.safeParse({ totalSolved: 'not-a-number' }).success).toBe(false);
  });

  it('validates CodeforcesSyncState and CodeforcesConnectInput schemas', () => {
    expect(CodeforcesConnectInputSchema.safeParse({ handle: 'tourist' }).success).toBe(true);
    expect(CodeforcesConnectInputSchema.safeParse({ handle: 'ab' }).success).toBe(false); // < 3 chars
    expect(CodeforcesConnectInputSchema.safeParse({ handle: 'invalid space' }).success).toBe(false);

    const validCfState = {
      handle: 'tourist',
      rating: 3384,
      maxRating: 4009,
      rank: 'legendary grandmaster',
      maxRank: 'tourist',
      contribution: 112,
      ratedContestsParticipated: 125,
      lastContestId: 2268,
      lastContestName: 'Codeforces Round 1124 (Div. 1)',
      lastContestRank: 2,
    };
    expect(CodeforcesSyncStateSchema.safeParse(validCfState).success).toBe(true);
    expect(CodeforcesSyncStateSchema.safeParse({ handle: 123 }).success).toBe(false);
  });

  it('validates GoogleCalendarSyncState and NormalizedCalendarEvent schemas', () => {
    const validGCalState = {
      primaryCalendarId: 'test@gmail.com',
      primaryCalendarTimeZone: 'UTC',
      selectedCalendarIds: ['test@gmail.com'],
      calendars: [
        {
          id: 'test@gmail.com',
          summary: 'Personal',
          timeZone: 'UTC',
          primary: true,
          accessRole: 'owner',
        },
      ],
      syncTokens: { 'test@gmail.com': 'sync-token-123' },
      lastSyncedAt: '2026-10-05T12:00:00.000Z',
    };
    expect(GoogleCalendarSyncStateSchema.safeParse(validGCalState).success).toBe(true);

    const validEvent = {
      externalId: 'event_123',
      calendarId: 'test@gmail.com',
      title: 'CS101 Lecture',
      status: 'confirmed' as const,
      startTime: '2026-10-05T10:00:00.000Z',
      endTime: '2026-10-05T11:00:00.000Z',
      isAllDay: false,
      timeZone: 'UTC',
      isBusy: true,
      isRecurring: false,
      recurringEventId: null,
      htmlLink: 'https://calendar.google.com/event?eid=123',
    };
    expect(NormalizedCalendarEventSchema.safeParse(validEvent).success).toBe(true);
    expect(NormalizedCalendarEventSchema.safeParse({ ...validEvent, status: 'invalid_status' }).success).toBe(false);
  });
});
