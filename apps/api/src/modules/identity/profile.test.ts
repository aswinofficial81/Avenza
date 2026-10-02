import fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { IClerkClient } from '../../auth/clerk/clerk.client';
import { AuthService } from '../../auth/auth.service';
import { createRequireAuthMiddleware } from '../../auth/auth.middleware';
import { InMemoryProfileRepository } from './profile.repository';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { createProfileRoutes } from './profile.routes';
import { healthRoutes } from '../../routes/health/health.routes';
import { registerErrorHandler } from '../../plugins/error-handler';

describe('Authentication & Profile Authorization (/api/v1/auth/me)', () => {
  // Setup controlled test doubles
  const mockClerkClient: IClerkClient = {
    async verifyBearerToken(token: string) {
      if (token === 'clerk-token-alice') {
        return {
          clerkUserId: 'clerk_alice_123',
          displayName: 'Alice Architect',
          avatarUrl: 'https://example.com/alice.png',
          timezone: 'America/New_York',
        };
      }
      if (token === 'clerk-token-bob') {
        return {
          clerkUserId: 'clerk_bob_456',
          displayName: 'Bob Builder',
          avatarUrl: 'https://example.com/bob.png',
          timezone: 'Europe/London',
        };
      }
      return null;
    },
  };

  const authService = new AuthService(mockClerkClient);
  const profileRepository = new InMemoryProfileRepository();
  const profileService = new ProfileService(profileRepository);
  const requireAuthMiddleware = createRequireAuthMiddleware(authService, profileService);
  const profileController = new ProfileController();
  const customProfileRoutes = createProfileRoutes({
    requireAuthMiddleware,
    profileController,
  });

  function createTestApp() {
    const app = fastify();
    registerErrorHandler(app);
    app.register(healthRoutes);
    app.register(customProfileRoutes);
    return app;
  }

  const app = createTestApp();

  describe('1. Health Endpoint Public Access', () => {
    it('allows public access to GET /health without Authorization header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
    });
  });

  describe('2. Protected Route Authentication Gate', () => {
    it('rejects unauthenticated requests with 401 and standard error envelope', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toMatch(/Missing or malformed Authorization header/i);
    });

    it('rejects invalid or forged bearer tokens with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer forged-invalid-token',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toMatch(/Invalid, expired, or unverified/i);
    });
  });

  describe('3. Profile Resolution & Controlled Bootstrap', () => {
    let aliceProfileId: string;

    it('bootstraps a new profile on first authenticated request from verified Clerk identity', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer clerk-token-alice',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.clerkUserId).toBe('clerk_alice_123');
      expect(body.data.profile).toBeDefined();
      expect(body.data.profile.clerkUserId).toBe('clerk_alice_123');
      expect(body.data.profile.displayName).toBe('Alice Architect');
      expect(body.data.profile.avatarUrl).toBe('https://example.com/alice.png');
      expect(body.data.profile.id).toBeDefined();

      aliceProfileId = body.data.profile.id;
    });

    it('idempotently returns the existing profile on repeated requests without creating duplicates', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer clerk-token-alice',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.profile.id).toBe(aliceProfileId);
      expect(body.data.profile.clerkUserId).toBe('clerk_alice_123');
    });

    it('isolates user identities: Bob receives his own profile, distinct from Alice', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer clerk-token-bob',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.clerkUserId).toBe('clerk_bob_456');
      expect(body.data.profile.clerkUserId).toBe('clerk_bob_456');
      expect(body.data.profile.displayName).toBe('Bob Builder');
      expect(body.data.profile.id).not.toBe(aliceProfileId);
    });
  });

  describe('4. Identity Tampering Defense', () => {
    it('ignores client-supplied arbitrary user ID in request body or headers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer clerk-token-alice',
          'x-user-id': 'hacker-supplied-id',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // Identity must strictly match verified Clerk token, not the client-supplied header
      expect(body.data.clerkUserId).toBe('clerk_alice_123');
      expect(body.data.profile.clerkUserId).toBe('clerk_alice_123');
    });
  });
});
