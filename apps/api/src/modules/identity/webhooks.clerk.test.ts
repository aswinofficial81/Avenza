import { describe, expect, it, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import fastify, { type FastifyRequest } from 'fastify';
import { verifyClerkWebhookSignature } from './webhooks.verification';
import { createWebhooksRoutes } from './webhooks.routes';
import { ProfileService } from './profile.service';
import { InMemoryProfileRepository } from './profile.repository';
import type { IIntegrationsService } from '../integrations/integrations.service';

describe('Phase 17B-2 Batch 1: Clerk Webhooks & Svix Verification', () => {
  const testSecret = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';

  function generateSvixHeaders(payload: string, secret: string = testSecret, timestampOffsetSeconds = 0) {
    const svixId = `msg_${crypto.randomBytes(12).toString('hex')}`;
    const svixTimestamp = (Math.floor(Date.now() / 1000) + timestampOffsetSeconds).toString();
    const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    const secretBytes = Buffer.from(cleanSecret, 'base64');
    const toSign = `${svixId}.${svixTimestamp}.${payload}`;
    const signature = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');

    return {
      'content-type': 'application/json',
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': `v1,${signature}`,
    };
  }

  // ============================================================================
  // 1. Unit Tests for verifyClerkWebhookSignature
  // ============================================================================
  describe('verifyClerkWebhookSignature', () => {
    it('verifies valid Svix signature successfully', () => {
      const payload = JSON.stringify({ type: 'user.deleted', data: { id: 'user_123' } });
      const headers = generateSvixHeaders(payload, testSecret);

      const result = verifyClerkWebhookSignature({
        rawBody: payload,
        headers,
        signingSecret: testSecret,
      });

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects tampered raw payload', () => {
      const originalPayload = JSON.stringify({ type: 'user.deleted', data: { id: 'user_123' } });
      const headers = generateSvixHeaders(originalPayload, testSecret);
      const tamperedPayload = JSON.stringify({ type: 'user.deleted', data: { id: 'user_456' } });

      const result = verifyClerkWebhookSignature({
        rawBody: tamperedPayload,
        headers,
        signingSecret: testSecret,
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid webhook signature');
    });

    it('rejects signature generated with wrong secret', () => {
      const payload = JSON.stringify({ type: 'user.deleted' });
      const wrongSecret = 'whsec_AbCdEfGhIjKlMnOpQrStUvWxYz123456';
      const headers = generateSvixHeaders(payload, wrongSecret);

      const result = verifyClerkWebhookSignature({
        rawBody: payload,
        headers,
        signingSecret: testSecret,
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid webhook signature');
    });

    it('rejects expired timestamp beyond tolerance window (> 300s)', () => {
      const payload = JSON.stringify({ type: 'user.deleted' });
      // 305 seconds in the past
      const headers = generateSvixHeaders(payload, testSecret, -305);

      const result = verifyClerkWebhookSignature({
        rawBody: payload,
        headers,
        signingSecret: testSecret,
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('tolerance window');
    });

    it('rejects missing header fields safely', () => {
      const payload = JSON.stringify({ type: 'user.deleted' });
      const headers = generateSvixHeaders(payload, testSecret);

      expect(
        verifyClerkWebhookSignature({
          rawBody: payload,
          headers: { ...headers, 'svix-id': undefined },
          signingSecret: testSecret,
        }).isValid
      ).toBe(false);

      expect(
        verifyClerkWebhookSignature({
          rawBody: payload,
          headers: { ...headers, 'svix-signature': undefined },
          signingSecret: testSecret,
        }).isValid
      ).toBe(false);
    });
  });

  // ============================================================================
  // 2. HTTP Endpoint Tests for POST /api/v1/webhooks/clerk
  // ============================================================================
  describe('POST /api/v1/webhooks/clerk endpoint', () => {
    let app: ReturnType<typeof fastify>;
    let profileRepo: InMemoryProfileRepository;
    let profileService: ProfileService;
    let mockIntegrationsService: IIntegrationsService;

    beforeEach(async () => {
      profileRepo = new InMemoryProfileRepository();
      profileService = new ProfileService(profileRepo);
      mockIntegrationsService = {
        revokeAllUserCredentials: vi.fn().mockResolvedValue({ success: true, revoked: ['github'], errors: [] }),
      } as unknown as IIntegrationsService;

      app = fastify();
      // Configure Fastify rawBody parser
      app.addContentTypeParser(
        'application/json',
        { parseAs: 'string' },
        (req: FastifyRequest, body: string | Buffer, done: (err: Error | null, result?: unknown) => void) => {
          const str = typeof body === 'string' ? body : body?.toString('utf8') || '';
          req.rawBody = str;
          try {
            done(null, str ? JSON.parse(str) : {});
          } catch (err: unknown) {
            done(err as Error, undefined);
          }
        }
      );

      app.register(
        createWebhooksRoutes({
          profileService,
          integrationsService: mockIntegrationsService,
          signingSecret: testSecret,
        })
      );
      await app.ready();
    });

    it('successfully processes user.deleted webhook, revokes credentials, and deletes profile', async () => {
      // 1. Seed user profile
      const seeded = await profileRepo.createProfile({
        clerk_user_id: 'user_target_clerk_123',
        display_name: 'Target User',
      });
      expect(await profileRepo.findById(seeded.id)).toBeDefined();

      const payload = JSON.stringify({
        data: { id: 'user_target_clerk_123', object: 'user', deleted: true },
        object: 'event',
        type: 'user.deleted',
      });
      const headers = generateSvixHeaders(payload, testSecret);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/clerk',
        headers,
        payload,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.status).toBe('deleted');

      // Profile deleted locally
      expect(await profileRepo.findById(seeded.id)).toBeNull();
      // Third party credentials revoked with internal profile UUID
      expect(mockIntegrationsService.revokeAllUserCredentials).toHaveBeenCalledWith(seeded.id);
    });

    it('handles idempotent duplicate delivery gracefully when user is already deleted', async () => {
      const payload = JSON.stringify({
        data: { id: 'user_nonexistent_999', object: 'user', deleted: true },
        object: 'event',
        type: 'user.deleted',
      });
      const headers = generateSvixHeaders(payload, testSecret);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/clerk',
        headers,
        payload,
      });

      // Must return 200 OK so Clerk does not keep retrying
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.status).toBe('already_deleted');
    });

    it('gracefully acknowledges and ignores other event types (e.g. user.updated)', async () => {
      const payload = JSON.stringify({
        data: { id: 'user_123' },
        type: 'user.updated',
      });
      const headers = generateSvixHeaders(payload, testSecret);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/clerk',
        headers,
        payload,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.received).toBe(true);
      expect(body.ignored).toBe(true);
      expect(body.eventType).toBe('user.updated');
    });

    it('rejects requests with missing or invalid Svix signatures with HTTP 400', async () => {
      const payload = JSON.stringify({ type: 'user.deleted', data: { id: 'user_123' } });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/clerk',
        headers: {
          'content-type': 'application/json',
          'svix-id': 'msg_123',
          'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
          'svix-signature': 'v1,invalidBase64Signature==',
        },
        payload,
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
    });

    it('rejects malformed event payload without user id with HTTP 400', async () => {
      const payload = JSON.stringify({
        data: {}, // Missing id
        type: 'user.deleted',
      });
      const headers = generateSvixHeaders(payload, testSecret);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/clerk',
        headers,
        payload,
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MALFORMED_WEBHOOK_PAYLOAD');
    });

    it('continues deletion even if external OAuth revocation encounters a partial failure', async () => {
      const seeded = await profileRepo.createProfile({
        clerk_user_id: 'user_clerk_partial_fail',
      });
      (mockIntegrationsService.revokeAllUserCredentials as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('GitHub network timeout')
      );

      const payload = JSON.stringify({
        data: { id: 'user_clerk_partial_fail', deleted: true },
        type: 'user.deleted',
      });
      const headers = generateSvixHeaders(payload, testSecret);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/clerk',
        headers,
        payload,
      });

      expect(res.statusCode).toBe(200);
      expect(await profileRepo.findById(seeded.id)).toBeNull();
    });
  });
});
