import type { FastifyPluginAsync } from 'fastify';
import { env } from '../../config/env';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import { defaultProfileService, ProfileService } from './profile.service';
import { defaultIntegrationsService } from '../integrations';
import type { IIntegrationsService } from '../integrations/integrations.service';
import { defaultAccountDeletionService, AccountDeletionService } from './account-deletion.service';
import { verifyClerkWebhookSignature } from './webhooks.verification';

export interface WebhooksRoutesOptions {
  profileService?: ProfileService;
  integrationsService?: IIntegrationsService;
  accountDeletionService?: AccountDeletionService;
  signingSecret?: string;
}

export function createWebhooksRoutes(opts: WebhooksRoutesOptions = {}): FastifyPluginAsync {
  const profileService = opts.profileService || defaultProfileService;
  const integrationsService = opts.integrationsService || defaultIntegrationsService;
  const accountDeletionService =
    opts.accountDeletionService ||
    (opts.profileService || opts.integrationsService
      ? new AccountDeletionService(getSupabaseAdminClient(), profileService, integrationsService)
      : defaultAccountDeletionService);
  const signingSecret = opts.signingSecret || env.CLERK_WEBHOOK_SECRET || '';

  return async (fastify) => {
    fastify.post('/api/v1/webhooks/clerk', async (request, reply) => {
      // 1. Extract raw body and Svix signature headers
      const rawBody = request.rawBody ?? (typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {}));
      const headers = {
        'svix-id': request.headers['svix-id'] as string | undefined,
        'svix-timestamp': request.headers['svix-timestamp'] as string | undefined,
        'svix-signature': request.headers['svix-signature'] as string | undefined,
      };

      // 2. Verify Svix signature
      const verification = verifyClerkWebhookSignature({
        rawBody,
        headers,
        signingSecret,
      });

      if (!verification.isValid) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_WEBHOOK_SIGNATURE',
            message: verification.error || 'Invalid webhook signature',
          },
        });
      }

      // 3. Parse and validate event payload
      let eventPayload: { type?: string; data?: { id?: string; [key: string]: unknown } };
      try {
        eventPayload = typeof request.body === 'object' && request.body !== null
          ? (request.body as { type?: string; data?: { id?: string } })
          : JSON.parse(rawBody);
      } catch {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MALFORMED_WEBHOOK_PAYLOAD',
            message: 'Webhook body is not valid JSON',
          },
        });
      }

      const eventType = eventPayload.type;
      if (!eventType) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MALFORMED_WEBHOOK_PAYLOAD',
            message: 'Missing event type in webhook payload',
          },
        });
      }

      // We only handle user.deleted in this lifecycle webhook; ignore other event types gracefully
      if (eventType !== 'user.deleted') {
        return reply.status(200).send({
          received: true,
          ignored: true,
          eventType,
        });
      }

      const clerkUserId = eventPayload.data?.id;
      if (!clerkUserId || typeof clerkUserId !== 'string' || !clerkUserId.trim()) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MALFORMED_WEBHOOK_PAYLOAD',
            message: 'Missing or invalid user ID in user.deleted event',
          },
        });
      }

      const trimmedClerkId = clerkUserId.trim();

      // 4. Delegate to account deletion lifecycle engine
      const result = await accountDeletionService.handleWebhookUserDeleted(trimmedClerkId);

      if (result.status === 'DELETED' && !result.profileId) {
        return reply.status(200).send({
          success: true,
          status: 'already_deleted',
          message: 'User profile not found or already deleted',
        });
      }

      return reply.status(200).send({
        success: true,
        status: 'deleted',
        message: 'User account and credentials deleted successfully',
      });
    });
  };
}

export const webhooksRoutes = createWebhooksRoutes();
