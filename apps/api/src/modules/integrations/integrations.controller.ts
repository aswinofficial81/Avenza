import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  IntegrationProviderSchema,
  OAuthCallbackInputSchema,
  type ApiErrorResponse,
  type IntegrationProvider,
} from '@avenza/shared';
import type { IIntegrationsService } from './integrations.service';

export class IntegrationsController {
  constructor(private readonly service: IIntegrationsService) {}

  private getProfileId(request: FastifyRequest): string | null {
    return request.auth?.profileId || request.profile?.id || null;
  }

  private sendUnauthorized(reply: FastifyReply): void {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please provide a valid Bearer token.',
      },
    };
    reply.status(401).send(errorResponse);
  }

  private parseProvider(providerParam: string, reply: FastifyReply): IntegrationProvider | null {
    const parsed = IntegrationProviderSchema.safeParse(providerParam);
    if (!parsed.success) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'UNSUPPORTED_PROVIDER',
          message: `Provider "${providerParam}" is not supported. Supported providers: github, leetcode, codeforces, google_calendar.`,
        },
      });
      return null;
    }
    return parsed.data;
  }

  // GET /api/v1/integrations
  listConnections = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    try {
      const connections = await this.service.listConnections(userId);
      return reply.status(200).send({
        success: true,
        data: connections,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list integration connections.';
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message },
      });
    }
  };

  // GET /api/v1/integrations/:provider
  getConnection = async (
    request: FastifyRequest<{ Params: { provider: string } }>,
    reply: FastifyReply
  ) => {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const provider = this.parseProvider(request.params.provider, reply);
    if (!provider) return;

    try {
      const connection = await this.service.getConnection(userId, provider);
      return reply.status(200).send({
        success: true,
        data: connection,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get integration connection.';
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message },
      });
    }
  };

  // POST /api/v1/integrations/:provider/connect
  connect = async (
    request: FastifyRequest<{
      Params: { provider: string };
      Body?: { redirect_url?: string; username?: string; handle?: string };
    }>,
    reply: FastifyReply
  ) => {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const provider = this.parseProvider(request.params.provider, reply);
    if (!provider) return;

    // Direct identifier connection (LeetCode)
    if (provider === 'leetcode') {
      const username = request.body?.username?.trim();
      if (!username) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'A valid "username" is required to connect LeetCode.',
          },
        });
      }

      try {
        const connection = await this.service.connectWithIdentifier(userId, provider, username);
        return reply.status(200).send({
          success: true,
          data: connection,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to connect LeetCode account.';
        return reply.status(400).send({
          success: false,
          error: { code: 'CONNECT_ERROR', message },
        });
      }
    }

    // Direct identifier connection (Codeforces)
    if (provider === 'codeforces') {
      const handle = (request.body?.handle || request.body?.username)?.trim();
      if (!handle) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'A valid "handle" is required to connect Codeforces.',
          },
        });
      }

      try {
        const connection = await this.service.connectWithIdentifier(userId, provider, handle);
        return reply.status(200).send({
          success: true,
          data: connection,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to connect Codeforces account.';
        return reply.status(400).send({
          success: false,
          error: { code: 'CONNECT_ERROR', message },
        });
      }
    }

    // Default OAuth flow (GitHub)
    const redirectUrl = request.body?.redirect_url;

    try {
      const result = await this.service.initiateOAuth(userId, provider, redirectUrl);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initiate OAuth flow.';
      return reply.status(500).send({
        success: false,
        error: { code: 'OAUTH_INIT_ERROR', message },
      });
    }
  };

  // GET /api/v1/integrations/:provider/callback
  callback = async (
    request: FastifyRequest<{ Params: { provider: string }; Querystring: { code?: string; state?: string } }>,
    reply: FastifyReply
  ) => {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const provider = this.parseProvider(request.params.provider, reply);
    if (!provider) return;

    const parsedQuery = OAuthCallbackInputSchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_CALLBACK_PARAMS',
          message: 'Both "code" and "state" query parameters are required for OAuth callback.',
        },
      });
    }

    try {
      const connection = await this.service.handleOAuthCallback(
        userId,
        provider,
        parsedQuery.data.code,
        parsedQuery.data.state
      );

      return reply.status(200).send({
        success: true,
        data: connection,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process OAuth callback.';
      return reply.status(400).send({
        success: false,
        error: { code: 'OAUTH_CALLBACK_ERROR', message },
      });
    }
  };

  // POST /api/v1/integrations/:provider/sync
  sync = async (
    request: FastifyRequest<{ Params: { provider: string } }>,
    reply: FastifyReply
  ) => {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const provider = this.parseProvider(request.params.provider, reply);
    if (!provider) return;

    try {
      const result = await this.service.syncConnection(userId, provider, 'manual');
      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sync integration.';
      return reply.status(400).send({
        success: false,
        error: { code: 'SYNC_ERROR', message },
      });
    }
  };

  // POST /api/v1/integrations/:provider/disconnect
  disconnect = async (
    request: FastifyRequest<{ Params: { provider: string } }>,
    reply: FastifyReply
  ) => {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const provider = this.parseProvider(request.params.provider, reply);
    if (!provider) return;

    try {
      const connection = await this.service.disconnect(userId, provider);
      return reply.status(200).send({
        success: true,
        data: connection,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect integration.';
      return reply.status(400).send({
        success: false,
        error: { code: 'DISCONNECT_ERROR', message },
      });
    }
  };

  // GET /api/v1/integrations/:provider/status
  getStatus = async (
    request: FastifyRequest<{ Params: { provider: string } }>,
    reply: FastifyReply
  ) => {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const provider = this.parseProvider(request.params.provider, reply);
    if (!provider) return;

    try {
      const connection = await this.service.getConnection(userId, provider);
      return reply.status(200).send({
        success: true,
        data: {
          connected: Boolean(connection && connection.status !== 'DISCONNECTED'),
          connection,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get integration status.';
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message },
      });
    }
  };

  // GET /api/v1/integrations/:provider/repositories
  listRepositories = async (
    request: FastifyRequest<{ Params: { provider: string } }>,
    reply: FastifyReply
  ) => {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const provider = this.parseProvider(request.params.provider, reply);
    if (!provider) return;

    try {
      const repositories = await this.service.listRepositories(userId, provider);
      return reply.status(200).send({
        success: true,
        data: repositories,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list repositories.';
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message },
      });
    }
  };

  // GET /api/v1/integrations/:provider/activities
  listActivities = async (
    request: FastifyRequest<{ Params: { provider: string }; Querystring: { limit?: string } }>,
    reply: FastifyReply
  ) => {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const provider = this.parseProvider(request.params.provider, reply);
    if (!provider) return;

    const limit = request.query?.limit ? parseInt(request.query.limit, 10) : 50;

    try {
      const activities = await this.service.listActivities(userId, provider, limit);
      return reply.status(200).send({
        success: true,
        data: activities,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list activities.';
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message },
      });
    }
  };

  // GET /api/v1/integrations/:provider/events
  listCalendarEvents = async (
    request: FastifyRequest<{
      Params: { provider: string };
      Querystring: { calendar_id?: string; time_min?: string; time_max?: string };
    }>,
    reply: FastifyReply
  ) => {
    const userId = this.getProfileId(request);
    if (!userId) return this.sendUnauthorized(reply);

    const provider = this.parseProvider(request.params.provider, reply);
    if (!provider) return;

    if (provider !== 'google_calendar') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'UNSUPPORTED_OPERATION',
          message: `Calendar events are not supported for provider "${provider}".`,
        },
      });
    }

    try {
      const events = await this.service.listCalendarEvents(userId, {
        calendarId: request.query?.calendar_id,
        timeMin: request.query?.time_min,
        timeMax: request.query?.time_max,
      });
      return reply.status(200).send({
        success: true,
        data: events,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list calendar events.';
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message },
      });
    }
  };
}
