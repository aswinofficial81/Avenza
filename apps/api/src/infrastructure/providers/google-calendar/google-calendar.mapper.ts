import type { GoogleCalendarSyncState, NormalizedCalendarEvent } from '@avenza/shared';
import type { GoogleCalendarEventItem, GoogleCalendarListResponse } from './google-calendar.types';

/**
 * Normalizes an upstream Google Calendar event into Avenza's scheduling context model.
 * Adheres strictly to data minimization: drops descriptions, attendee emails, and conferencing PINs.
 */
export function mapGoogleEventToNormalized(
  event: GoogleCalendarEventItem,
  calendarId: string,
  defaultTimeZone = 'UTC'
): NormalizedCalendarEvent {
  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);

  let startTime: string;
  let endTime: string;

  if (isAllDay && event.start?.date) {
    startTime = new Date(`${event.start.date}T00:00:00Z`).toISOString();
    endTime = event.end?.date
      ? new Date(`${event.end.date}T00:00:00Z`).toISOString()
      : new Date(`${event.start.date}T23:59:59Z`).toISOString();
  } else if (event.start?.dateTime) {
    startTime = new Date(event.start.dateTime).toISOString();
    endTime = event.end?.dateTime
      ? new Date(event.end.dateTime).toISOString()
      : new Date(new Date(event.start.dateTime).getTime() + 60 * 60 * 1000).toISOString();
  } else {
    const now = new Date();
    startTime = now.toISOString();
    endTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }

  // transparency === 'transparent' means event does not block time (show me as available/free)
  const isBusy = event.transparency !== 'transparent';
  const title = event.summary?.trim() || '(No title)';
  const status = event.status === 'cancelled' || event.status === 'tentative' ? event.status : 'confirmed';

  return {
    externalId: event.id,
    calendarId,
    title,
    status,
    startTime,
    endTime,
    isAllDay,
    timeZone: event.start?.timeZone || defaultTimeZone,
    isBusy,
    isRecurring: Boolean(event.recurringEventId),
    recurringEventId: event.recurringEventId ?? null,
    htmlLink: event.htmlLink ?? null,
  };
}

/**
 * Normalizes discovered calendars into GoogleCalendarSyncState.
 * Automatically identifies primary calendar and initializes selectedCalendarIds.
 */
export function mapGoogleCalendarListToSyncState(
  res: GoogleCalendarListResponse,
  existingTokens: Record<string, string> = {}
): GoogleCalendarSyncState {
  const items = res.items || [];
  const primaryEntry = items.find((c) => c.primary) || items[0];

  const primaryCalendarId = primaryEntry?.id || 'primary';
  const primaryCalendarTimeZone = primaryEntry?.timeZone || 'UTC';

  const calendars = items.map((c) => ({
    id: c.id,
    summary: c.summary,
    description: c.description,
    timeZone: c.timeZone,
    primary: Boolean(c.primary),
    accessRole: c.accessRole,
  }));

  return {
    primaryCalendarId,
    primaryCalendarTimeZone,
    selectedCalendarIds: [primaryCalendarId],
    calendars,
    syncTokens: existingTokens,
    lastSyncedAt: null,
  };
}
