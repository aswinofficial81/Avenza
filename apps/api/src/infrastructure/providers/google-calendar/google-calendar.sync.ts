import type { GoogleCalendarSyncState, NormalizedCalendarEvent } from '@avenza/shared';
import type { SyncContext, SyncResult } from '../base/provider.types';
import type { ISyncProvider } from '../base/sync.interface';
import { GoogleCalendarClient, GoogleCalendarSyncTokenExpiredError } from './google-calendar.client';
import { mapGoogleCalendarListToSyncState, mapGoogleEventToNormalized } from './google-calendar.mapper';
import type { GoogleCalendarEventItem } from './google-calendar.types';

export class GoogleCalendarSyncProvider implements ISyncProvider {
  constructor(private readonly client: GoogleCalendarClient = new GoogleCalendarClient()) {}

  async sync(context: SyncContext): Promise<SyncResult> {
    const accessToken = context.accessToken;
    if (!accessToken) {
      return {
        success: false,
        repositories: [],
        activities: [],
        calendarEvents: [],
        errorCode: 'MISSING_ACCESS_TOKEN',
        errorMessage: 'Google Calendar access token is required for synchronization.',
      };
    }

    try {
      let syncState = context.syncState as GoogleCalendarSyncState | undefined;

      // 1. Calendar Discovery: if sync_state has no calendars or primary calendar, fetch list
      if (!syncState || !syncState.calendars || syncState.calendars.length === 0) {
        const calListRes = await this.client.listCalendars(accessToken);
        syncState = mapGoogleCalendarListToSyncState(calListRes, syncState?.syncTokens || {});
      }

      const calendarId = syncState.primaryCalendarId || 'primary';
      const existingTokens = { ...(syncState.syncTokens || {}) };
      const calendarSyncToken = existingTokens[calendarId];

      const allNormalizedEvents: NormalizedCalendarEvent[] = [];
      let newSyncToken: string | undefined;

      if (calendarSyncToken) {
        // 2. Incremental Sync with syncToken
        try {
          const deltaEvents = await this.fetchAllEvents(
            accessToken,
            calendarId,
            { syncToken: calendarSyncToken, showDeleted: true },
            (token) => {
              newSyncToken = token;
            }
          );
          allNormalizedEvents.push(...deltaEvents);
        } catch (err) {
          if (err instanceof GoogleCalendarSyncTokenExpiredError) {
            // 3. HTTP 410 Recovery: invalidate expired token and perform fresh windowed sync
            delete existingTokens[calendarId];
            const recoveredEvents = await this.fetchWindowedEvents(
              accessToken,
              calendarId,
              syncState.primaryCalendarTimeZone,
              (token) => {
                newSyncToken = token;
              }
            );
            allNormalizedEvents.push(...recoveredEvents);
          } else {
            throw err;
          }
        }
      } else {
        // 4. Initial Windowed Sync (now - 7 days to now + 30 days)
        const initialEvents = await this.fetchWindowedEvents(
          accessToken,
          calendarId,
          syncState.primaryCalendarTimeZone,
          (token) => {
            newSyncToken = token;
          }
        );
        allNormalizedEvents.push(...initialEvents);
      }

      if (newSyncToken) {
        existingTokens[calendarId] = newSyncToken;
      }

      const updatedSyncState: GoogleCalendarSyncState = {
        ...syncState,
        syncTokens: existingTokens,
        lastSyncedAt: new Date().toISOString(),
      };

      return {
        success: true,
        repositories: [],
        activities: [], // Calendar events are NOT achievement activities/evidence!
        calendarEvents: allNormalizedEvents,
        syncState: updatedSyncState as unknown as Record<string, unknown>,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Google Calendar synchronization failed.';
      return {
        success: false,
        repositories: [],
        activities: [],
        calendarEvents: [],
        errorCode: 'SYNC_ERROR',
        errorMessage,
      };
    }
  }

  private async fetchWindowedEvents(
    accessToken: string,
    calendarId: string,
    timeZone: string,
    onSyncTokenCaptured: (token: string) => void
  ): Promise<NormalizedCalendarEvent[]> {
    const now = Date.now();
    const timeMin = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

    return this.fetchAllEvents(
      accessToken,
      calendarId,
      {
        timeMin,
        timeMax,
        singleEvents: true,
        showDeleted: true,
      },
      onSyncTokenCaptured,
      timeZone
    );
  }

  private async fetchAllEvents(
    accessToken: string,
    calendarId: string,
    options: {
      timeMin?: string;
      timeMax?: string;
      syncToken?: string;
      singleEvents?: boolean;
      showDeleted?: boolean;
    },
    onSyncTokenCaptured: (token: string) => void,
    defaultTimeZone = 'UTC'
  ): Promise<NormalizedCalendarEvent[]> {
    const events: NormalizedCalendarEvent[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const res = await this.client.listEvents(accessToken, calendarId, {
        ...options,
        pageToken,
        maxResults: 250,
      });

      const rawItems: GoogleCalendarEventItem[] = res.items || [];
      for (const item of rawItems) {
        events.push(mapGoogleEventToNormalized(item, calendarId, defaultTimeZone));
      }

      // Capture nextSyncToken from the final page
      if (res.nextSyncToken) {
        onSyncTokenCaptured(res.nextSyncToken);
      }

      pageToken = res.nextPageToken;
    } while (pageToken);

    return events;
  }
}
