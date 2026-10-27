import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleCalendarAuthProvider } from './google-calendar.auth';
import { GoogleCalendarClient, GoogleCalendarSyncTokenExpiredError } from './google-calendar.client';
import { mapGoogleCalendarListToSyncState, mapGoogleEventToNormalized } from './google-calendar.mapper';
import { GoogleCalendarProvider } from './google-calendar.provider';
import { GoogleCalendarSyncProvider } from './google-calendar.sync';
import type {
  GoogleCalendarEventItem,
  GoogleCalendarEventsResponse,
  GoogleCalendarListResponse,
} from './google-calendar.types';
import type { GoogleCalendarSyncState } from '@avenza/shared';

describe('Google Calendar Provider & Integration Infrastructure', () => {
  let mockClient: GoogleCalendarClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockClient = new GoogleCalendarClient();
  });

  describe('Provider Registration & Capabilities', () => {
    it('declares correct provider ID, name, and read-only calendar capabilities', () => {
      const provider = new GoogleCalendarProvider(mockClient);

      expect(provider.getProviderId()).toBe('google_calendar');
      expect(provider.getCapabilities().has('oauth')).toBe(true);
      expect(provider.getCapabilities().has('calendar')).toBe(true);
      expect(provider.getCapabilities().has('read_only')).toBe(true);
      expect(provider.getCapabilities().has('repositories')).toBe(false);
      expect(provider.hasCapability('calendar')).toBe(true);
      expect(provider.getAuthAdapter()).toBeDefined();
      expect(provider.getSyncAdapter()).toBeDefined();
    });
  });

  describe('OAuth & Auth Adapter', () => {
    it('creates authorization URL with offline access, prompt=consent, and read-only calendar scope', () => {
      const auth = new GoogleCalendarAuthProvider(
        {
          clientId: 'mock-google-client-id',
          clientSecret: 'mock-google-secret',
          redirectUri: 'http://localhost:3005/api/v1/integrations/google_calendar/callback',
        },
        mockClient
      );

      const url = auth.createAuthorizationUrl('csrf-state-123');
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=mock-google-client-id');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(url).toContain('state=csrf-state-123');
      expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly'));
    });

    it('throws error when client ID is missing during auth URL creation', () => {
      const auth = new GoogleCalendarAuthProvider({ clientId: '' }, mockClient);
      expect(() => auth.createAuthorizationUrl('state')).toThrow(/GOOGLE_CLIENT_ID/);
    });

    it('exchanges authorization code for access and refresh tokens', async () => {
      const auth = new GoogleCalendarAuthProvider(
        {
          clientId: 'client-id',
          clientSecret: 'client-sec',
          redirectUri: 'http://localhost:3005/callback',
        },
        mockClient
      );

      const mockResponse = {
        access_token: 'mock-access-token-123',
        refresh_token: 'mock-refresh-token-456',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const tokens = await auth.exchangeCodeForTokens('mock-auth-code');
      expect(tokens.accessToken).toBe('mock-access-token-123');
      expect(tokens.refreshToken).toBe('mock-refresh-token-456');
      expect(tokens.expiresIn).toBe(3600);
    });

    it('refreshes expired access token using refresh token', async () => {
      const auth = new GoogleCalendarAuthProvider(
        {
          clientId: 'client-id',
          clientSecret: 'client-sec',
          redirectUri: 'http://localhost:3005/callback',
        },
        mockClient
      );

      vi.spyOn(mockClient, 'refreshAccessToken').mockResolvedValueOnce({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'calendar.readonly',
      });

      const tokens = await auth.refreshAccessToken('old-refresh-token');
      expect(tokens.accessToken).toBe('new-access-token');
      expect(tokens.refreshToken).toBe('new-refresh-token');
      expect(tokens.expiresIn).toBe(3600);
    });

    it('fetches user identity and extracts stable OpenID sub as externalAccountId', async () => {
      const auth = new GoogleCalendarAuthProvider({}, mockClient);

      vi.spyOn(mockClient, 'fetchUserInfo').mockResolvedValueOnce({
        sub: 'google-sub-99887766',
        email: 'scholar@avenza.edu',
        name: 'Avenza Scholar',
        picture: 'https://lh3.googleusercontent.com/avatar.jpg',
      });

      const identity = await auth.fetchIdentity('valid-access-token');
      expect(identity.externalAccountId).toBe('google-sub-99887766');
      expect(identity.username).toBe('scholar@avenza.edu');
      expect(identity.displayName).toBe('Avenza Scholar');
      expect(identity.email).toBe('scholar@avenza.edu');
      expect(identity.avatarUrl).toBe('https://lh3.googleusercontent.com/avatar.jpg');
    });
  });

  describe('Event & Calendar List Mappers', () => {
    it('normalizes timed event, calculates isBusy and preserves recurringEventId', () => {
      const rawEvent: GoogleCalendarEventItem = {
        id: 'event_instance_123',
        summary: 'Deep Work: Distributed Systems',
        start: { dateTime: '2026-10-05T14:00:00Z', timeZone: 'America/New_York' },
        end: { dateTime: '2026-10-05T16:00:00Z', timeZone: 'America/New_York' },
        transparency: 'opaque',
        recurringEventId: 'master_series_999',
        status: 'confirmed',
        htmlLink: 'https://calendar.google.com/event?eid=123',
      };

      const normalized = mapGoogleEventToNormalized(rawEvent, 'primary@gmail.com');
      expect(normalized.externalId).toBe('event_instance_123');
      expect(normalized.calendarId).toBe('primary@gmail.com');
      expect(normalized.title).toBe('Deep Work: Distributed Systems');
      expect(normalized.isBusy).toBe(true);
      expect(normalized.isAllDay).toBe(false);
      expect(normalized.isRecurring).toBe(true);
      expect(normalized.recurringEventId).toBe('master_series_999');
      expect(normalized.status).toBe('confirmed');
    });

    it('normalizes all-day event and marks transparent events as isBusy=false', () => {
      const rawAllDay: GoogleCalendarEventItem = {
        id: 'all_day_hackathon',
        summary: '',
        start: { date: '2026-10-10' },
        end: { date: '2026-10-11' },
        transparency: 'transparent',
        status: 'confirmed',
      };

      const normalized = mapGoogleEventToNormalized(rawAllDay, 'primary@gmail.com');
      expect(normalized.isAllDay).toBe(true);
      expect(normalized.title).toBe('(No title)');
      expect(normalized.isBusy).toBe(false);
      expect(normalized.startTime).toBe('2026-10-10T00:00:00.000Z');
      expect(normalized.endTime).toBe('2026-10-11T00:00:00.000Z');
    });

    it('identifies primary calendar from calendar list and populates sync state', () => {
      const rawList: GoogleCalendarListResponse = {
        kind: 'calendar#calendarList',
        etag: 'etag123',
        items: [
          {
            id: 'secondary_holidays@group.calendar.google.com',
            summary: 'Holidays in India',
            timeZone: 'Asia/Kolkata',
            primary: false,
            accessRole: 'reader',
          },
          {
            id: 'scholar@gmail.com',
            summary: 'Personal Schedule',
            timeZone: 'Asia/Kolkata',
            primary: true,
            accessRole: 'owner',
          },
        ],
      };

      const syncState = mapGoogleCalendarListToSyncState(rawList);
      expect(syncState.primaryCalendarId).toBe('scholar@gmail.com');
      expect(syncState.primaryCalendarTimeZone).toBe('Asia/Kolkata');
      expect(syncState.selectedCalendarIds).toEqual(['scholar@gmail.com']);
      expect(syncState.calendars).toHaveLength(2);
    });
  });

  describe('Google Calendar Sync Provider', () => {
    it('fails safely when access token is missing', async () => {
      const syncProvider = new GoogleCalendarSyncProvider(mockClient);
      const res = await syncProvider.sync({
        userId: 'user-1',
        connectionId: 'conn-1',
        accessToken: null,
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('MISSING_ACCESS_TOKEN');
    });

    it('performs initial windowed sync and captures nextSyncToken from final page', async () => {
      const syncProvider = new GoogleCalendarSyncProvider(mockClient);

      // 1. Mock listCalendars
      vi.spyOn(mockClient, 'listCalendars').mockResolvedValueOnce({
        kind: 'calendar#calendarList',
        etag: 'etag',
        items: [
          {
            id: 'primary@gmail.com',
            summary: 'Main Calendar',
            timeZone: 'UTC',
            primary: true,
            accessRole: 'owner',
          },
        ],
      });

      // 2. Mock page 1 of events with nextPageToken
      const page1: GoogleCalendarEventsResponse = {
        kind: 'calendar#events',
        etag: 'etag1',
        nextPageToken: 'page-token-2',
        items: [
          {
            id: 'event-1',
            summary: 'Algo Lab',
            start: { dateTime: '2026-10-05T09:00:00Z' },
            end: { dateTime: '2026-10-05T10:00:00Z' },
          },
        ],
      };

      // 3. Mock page 2 of events with nextSyncToken
      const page2: GoogleCalendarEventsResponse = {
        kind: 'calendar#events',
        etag: 'etag2',
        nextSyncToken: 'sync-token-valid-abc',
        items: [
          {
            id: 'event-2',
            summary: 'Math Exam',
            start: { dateTime: '2026-10-06T14:00:00Z' },
            end: { dateTime: '2026-10-06T17:00:00Z' },
          },
        ],
      };

      const listEventsSpy = vi
        .spyOn(mockClient, 'listEvents')
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2);

      const res = await syncProvider.sync({
        userId: 'user-1',
        connectionId: 'conn-1',
        accessToken: 'valid-token',
      });

      expect(res.success).toBe(true);
      expect(res.calendarEvents).toHaveLength(2);
      expect(res.activities).toHaveLength(0); // Calendar events MUST NOT create activities
      expect(res.repositories).toHaveLength(0);

      // Verify nextSyncToken is saved in syncState
      const syncState = res.syncState as GoogleCalendarSyncState;
      expect(syncState.syncTokens['primary@gmail.com']).toBe('sync-token-valid-abc');
      expect(listEventsSpy).toHaveBeenCalledTimes(2);
    });

    it('performs incremental sync using stored syncToken', async () => {
      const syncProvider = new GoogleCalendarSyncProvider(mockClient);

      const existingState = {
        primaryCalendarId: 'primary@gmail.com',
        primaryCalendarTimeZone: 'UTC',
        selectedCalendarIds: ['primary@gmail.com'],
        calendars: [
          {
            id: 'primary@gmail.com',
            summary: 'Main',
            timeZone: 'UTC',
            primary: true,
            accessRole: 'owner',
          },
        ],
        syncTokens: { 'primary@gmail.com': 'existing-sync-token-999' },
        lastSyncedAt: '2026-10-04T12:00:00.000Z',
      };

      const deltaResponse: GoogleCalendarEventsResponse = {
        kind: 'calendar#events',
        etag: 'etag_delta',
        nextSyncToken: 'updated-sync-token-1000',
        items: [
          {
            id: 'event-delta-1',
            summary: 'Rescheduled Meeting',
            start: { dateTime: '2026-10-05T15:00:00Z' },
            end: { dateTime: '2026-10-05T16:00:00Z' },
            status: 'confirmed',
          },
        ],
      };

      const listEventsSpy = vi.spyOn(mockClient, 'listEvents').mockResolvedValueOnce(deltaResponse);

      const res = await syncProvider.sync({
        userId: 'user-1',
        connectionId: 'conn-1',
        accessToken: 'valid-token',
        syncState: existingState,
      });

      expect(res.success).toBe(true);
      expect(res.calendarEvents).toHaveLength(1);
      expect(res.calendarEvents![0]!.title).toBe('Rescheduled Meeting');

      // Verify syncToken was passed to client without timeMin/timeMax
      expect(listEventsSpy).toHaveBeenCalledWith(
        'valid-token',
        'primary@gmail.com',
        expect.objectContaining({
          syncToken: 'existing-sync-token-999',
          showDeleted: true,
        })
      );

      const syncState = res.syncState as GoogleCalendarSyncState;
      expect(syncState.syncTokens['primary@gmail.com']).toBe('updated-sync-token-1000');
    });

    it('recovers from HTTP 410 Gone by clearing expired syncToken and performing full windowed resync', async () => {
      const syncProvider = new GoogleCalendarSyncProvider(mockClient);

      const existingState = {
        primaryCalendarId: 'primary@gmail.com',
        primaryCalendarTimeZone: 'UTC',
        selectedCalendarIds: ['primary@gmail.com'],
        calendars: [
          {
            id: 'primary@gmail.com',
            summary: 'Main',
            timeZone: 'UTC',
            primary: true,
            accessRole: 'owner',
          },
        ],
        syncTokens: { 'primary@gmail.com': 'stale-token-expired' },
        lastSyncedAt: '2026-09-01T12:00:00.000Z',
      };

      // 1. First call fails with 410 Gone
      // 2. Recovery call succeeds with fresh windowed sync
      vi.spyOn(mockClient, 'listEvents')
        .mockRejectedValueOnce(new GoogleCalendarSyncTokenExpiredError('primary@gmail.com'))
        .mockResolvedValueOnce({
          kind: 'calendar#events',
          etag: 'etag_fresh',
          nextSyncToken: 'fresh-sync-token-recovered',
          items: [
            {
              id: 'fresh-event-1',
              summary: 'Recovered Class',
              start: { dateTime: '2026-10-05T11:00:00Z' },
              end: { dateTime: '2026-10-05T12:00:00Z' },
            },
          ],
        });

      const res = await syncProvider.sync({
        userId: 'user-1',
        connectionId: 'conn-1',
        accessToken: 'valid-token',
        syncState: existingState,
      });

      expect(res.success).toBe(true);
      expect(res.calendarEvents).toHaveLength(1);
      expect(res.calendarEvents![0]!.title).toBe('Recovered Class');

      const syncState = res.syncState as GoogleCalendarSyncState;
      expect(syncState.syncTokens['primary@gmail.com']).toBe('fresh-sync-token-recovered');
    });
  });
});
