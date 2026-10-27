// ==============================================================================
// Google Calendar API & OAuth Types
// Based on Google Calendar API v3 and Google OAuth 2.0 specifications
// ==============================================================================

export interface GoogleOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  timeZone: string;
  primary?: boolean;
  accessRole: string; // 'owner' | 'writer' | 'reader' | 'freeBusyReader'
  backgroundColor?: string;
  foregroundColor?: string;
  selected?: boolean;
}

export interface GoogleCalendarListResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  nextSyncToken?: string;
  items?: GoogleCalendarListEntry[];
}

export interface GoogleCalendarEventTime {
  date?: string; // YYYY-MM-DD for all-day events
  dateTime?: string; // RFC3339 timestamp (e.g. 2026-10-05T10:00:00Z)
  timeZone?: string;
}

export interface GoogleCalendarEventItem {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  transparency?: 'opaque' | 'transparent';
  start?: GoogleCalendarEventTime;
  end?: GoogleCalendarEventTime;
  recurringEventId?: string;
  originalStartTime?: GoogleCalendarEventTime;
  created?: string;
  updated?: string;
}

export interface GoogleCalendarEventsResponse {
  kind: string;
  etag: string;
  summary?: string;
  timeZone?: string;
  nextPageToken?: string;
  nextSyncToken?: string;
  items?: GoogleCalendarEventItem[];
}
