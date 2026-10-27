import { ProviderAuthError, ProviderRateLimitError } from '../base/provider.types';
import type {
  GoogleCalendarEventsResponse,
  GoogleCalendarListResponse,
  GoogleOAuthTokenResponse,
  GoogleUserInfo,
} from './google-calendar.types';

export class GoogleCalendarSyncTokenExpiredError extends Error {
  constructor(public readonly calendarId: string) {
    super(`Google Calendar sync token has expired or is invalid for calendar "${calendarId}".`);
    this.name = 'GoogleCalendarSyncTokenExpiredError';
  }
}

export interface GoogleCalendarClientConfig {
  baseUrl?: string;
  oauthBaseUrl?: string;
  timeoutMs?: number;
}

export class GoogleCalendarClient {
  private readonly baseUrl: string;
  private readonly oauthBaseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: GoogleCalendarClientConfig = {}) {
    this.baseUrl = (config.baseUrl || 'https://www.googleapis.com/calendar/v3').replace(/\/+$/, '');
    this.oauthBaseUrl = (config.oauthBaseUrl || 'https://oauth2.googleapis.com').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 15000;
  }

  /**
   * Fetches the user's OpenID Connect profile and email info.
   */
  async fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const res = await this.request<GoogleUserInfo>('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return res;
  }

  /**
   * Lists calendars accessible to the authenticated user.
   */
  async listCalendars(accessToken: string, pageToken?: string): Promise<GoogleCalendarListResponse> {
    const url = new URL(`${this.baseUrl}/users/me/calendarList`);
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    return this.request<GoogleCalendarListResponse>(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  /**
   * Lists events for a specific calendar.
   * If syncToken is provided, Google strictly disallows timeMin/timeMax.
   */
  async listEvents(
    accessToken: string,
    calendarId: string,
    options: {
      timeMin?: string;
      timeMax?: string;
      syncToken?: string;
      pageToken?: string;
      singleEvents?: boolean;
      showDeleted?: boolean;
      maxResults?: number;
    } = {}
  ): Promise<GoogleCalendarEventsResponse> {
    const encodedId = encodeURIComponent(calendarId);
    const url = new URL(`${this.baseUrl}/calendars/${encodedId}/events`);

    if (options.syncToken) {
      // Incremental sync: Google prohibits timeMin/timeMax with syncToken
      url.searchParams.set('syncToken', options.syncToken);
      if (options.showDeleted !== undefined) {
        url.searchParams.set('showDeleted', String(options.showDeleted));
      }
    } else {
      // Windowed initial sync
      if (options.timeMin) url.searchParams.set('timeMin', options.timeMin);
      if (options.timeMax) url.searchParams.set('timeMax', options.timeMax);
      if (options.singleEvents !== undefined) {
        url.searchParams.set('singleEvents', String(options.singleEvents));
      }
      if (options.showDeleted !== undefined) {
        url.searchParams.set('showDeleted', String(options.showDeleted));
      }
    }

    if (options.pageToken) {
      url.searchParams.set('pageToken', options.pageToken);
    }
    if (options.maxResults) {
      url.searchParams.set('maxResults', String(options.maxResults));
    }

    try {
      return await this.request<GoogleCalendarEventsResponse>(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes('410')) {
        throw new GoogleCalendarSyncTokenExpiredError(calendarId);
      }
      throw err;
    }
  }

  /**
   * Exchanges a refresh token for a fresh access token.
   */
  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<GoogleOAuthTokenResponse> {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await this.request<GoogleOAuthTokenResponse>(`${this.oauthBaseUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (res.error || !res.access_token) {
      throw new ProviderAuthError(res.error_description || res.error || 'Failed to refresh Google token.');
    }

    return res;
  }

  /**
   * Revokes a Google access or refresh token upon disconnect.
   */
  async revokeToken(token: string): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const params = new URLSearchParams({ token });
      await fetch(`${this.oauthBaseUrl}/revoke?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        signal: controller.signal,
      });
    } catch {
      // Token revocation best-effort / timeout
    } finally {
      clearTimeout(timer);
    }
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');

        if (response.status === 410) {
          throw new Error(`Google Calendar API 410 Gone: ${errorText}`);
        }

        if (response.status === 401) {
          throw new ProviderAuthError('Google access token is invalid or expired. Reauthorization required.');
        }

        if (response.status === 403 || response.status === 429) {
          if (
            errorText.includes('rateLimitExceeded') ||
            errorText.includes('userRateLimitExceeded') ||
            errorText.includes('quotaExceeded') ||
            response.status === 429
          ) {
            throw new ProviderRateLimitError('Google Calendar API rate limit or quota exceeded.');
          }
          throw new ProviderAuthError(`Google Calendar permission denied: ${errorText}`);
        }

        throw new Error(`Google Calendar API error (HTTP ${response.status}): ${errorText}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof ProviderAuthError || err instanceof ProviderRateLimitError) {
        throw err;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Google Calendar API request timed out after 15 seconds.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
