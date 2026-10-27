import fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { describe, expect, it, beforeEach } from 'vitest';
import { registerErrorHandler } from '../../plugins/error-handler';
import type { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { InMemoryPreferencesRepository } from './preferences.repository';
import { PreferencesController } from './preferences.controller';
import { createPreferencesRoutes } from './preferences.routes';
import type { UserPreferencesRow } from '@avenza/shared';

const USER_A = '00000000-0000-4000-8000-000000000001';
const USER_B = '00000000-0000-4000-8000-000000000002';

function buildPrefsRow(overrides: Partial<UserPreferencesRow> = {}): UserPreferencesRow {
  const now = new Date().toISOString();
  return {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: USER_A,
    theme: 'system',
    timezone: null,
    preferred_study_start: null,
    preferred_study_end: null,
    daily_minimum_minutes: 30,
    daily_target_minutes: 120,
    max_daily_study_minutes: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('Preferences Routes', () => {
  let app: FastifyInstance;
  let prefsRepo: InMemoryPreferencesRepository;
  let currentUserId: string;

  beforeEach(async () => {
    currentUserId = USER_A;
    prefsRepo = new InMemoryPreferencesRepository();

    const controller = new PreferencesController(prefsRepo);

    app = fastify();
    registerErrorHandler(app);

    const mockAuth = async (request: FastifyRequest) => {
      (request as unknown as { profile: { id: string } }).profile = { id: currentUserId };
    };
    const mockAuthHook = mockAuth as unknown as typeof defaultRequireAuth;

    app.register(createPreferencesRoutes({ requireAuthMiddleware: mockAuthHook, preferencesController: controller }));
    await app.ready();
  });

  // ─── GET /api/v1/preferences ───────────────────────────────────────────────

  it('GET /api/v1/preferences — lazily creates and returns preferences for a new user', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/preferences' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: UserPreferencesRow }>();
    expect(body.success).toBe(true);
    expect(body.data.user_id).toBe(USER_A);
    expect(body.data.preferred_study_start).toBeNull();
    expect(body.data.preferred_study_end).toBeNull();
  });

  it('GET /api/v1/preferences — returns existing preferences without overwriting them', async () => {
    const existing = buildPrefsRow({ preferred_study_start: '09:00', preferred_study_end: '21:00' });
    prefsRepo.setPreferences(existing);

    const res = await app.inject({ method: 'GET', url: '/api/v1/preferences' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: UserPreferencesRow }>();
    expect(body.data.preferred_study_start).toBe('09:00');
    expect(body.data.preferred_study_end).toBe('21:00');
  });

  it('GET /api/v1/preferences — user B cannot see user A preferences', async () => {
    const existingA = buildPrefsRow({ preferred_study_start: '08:00' });
    prefsRepo.setPreferences(existingA);

    currentUserId = USER_B;
    const res = await app.inject({ method: 'GET', url: '/api/v1/preferences' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: UserPreferencesRow }>();
    expect(body.data.user_id).toBe(USER_B);
    // User B gets their own default prefs (null study times)
    expect(body.data.preferred_study_start).toBeNull();
  });

  // ─── PATCH /api/v1/preferences ─────────────────────────────────────────────

  it('PATCH /api/v1/preferences — sets valid study window times', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/preferences',
      payload: {
        preferred_study_start: '08:00',
        preferred_study_end: '22:00',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: UserPreferencesRow }>();
    expect(body.success).toBe(true);
    expect(body.data.preferred_study_start).toBe('08:00');
    expect(body.data.preferred_study_end).toBe('22:00');
  });

  it('PATCH /api/v1/preferences — returns 400 when start >= end', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/preferences',
      payload: {
        preferred_study_start: '22:00',
        preferred_study_end: '08:00',
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ success: false; error: { code: string } }>();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH /api/v1/preferences — returns 400 for invalid HH:mm format', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/preferences',
      payload: {
        preferred_study_start: '8:00',   // missing leading zero
        preferred_study_end: '22:00',
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ success: false; error: { code: string } }>();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH /api/v1/preferences — returns 400 when target < minimum', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/preferences',
      payload: {
        daily_minimum_minutes: 120,
        daily_target_minutes: 60,
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ success: false; error: { code: string } }>();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH /api/v1/preferences — persists partial update (only provided fields change)', async () => {
    const existing = buildPrefsRow({
      preferred_study_start: '09:00',
      preferred_study_end: '21:00',
      daily_target_minutes: 180,
    });
    prefsRepo.setPreferences(existing);

    // Only change the study end time
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/preferences',
      payload: { preferred_study_end: '23:00' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: UserPreferencesRow }>();
    // Start time unchanged
    expect(body.data.preferred_study_start).toBe('09:00');
    expect(body.data.preferred_study_end).toBe('23:00');
  });

  it('PATCH /api/v1/preferences — clears study window times with null', async () => {
    const existing = buildPrefsRow({
      preferred_study_start: '08:00',
      preferred_study_end: '22:00',
    });
    prefsRepo.setPreferences(existing);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/preferences',
      payload: {
        preferred_study_start: null,
        preferred_study_end: null,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: UserPreferencesRow }>();
    expect(body.data.preferred_study_start).toBeNull();
    expect(body.data.preferred_study_end).toBeNull();
  });

  it('PATCH /api/v1/preferences — full valid update round-trip', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/preferences',
      payload: {
        preferred_study_start: '07:30',
        preferred_study_end: '20:00',
        daily_minimum_minutes: 45,
        daily_target_minutes: 150,
        max_daily_study_minutes: 240,
        timezone: 'Asia/Kolkata',
      },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json<{ success: boolean; data: UserPreferencesRow }>();
    expect(data.preferred_study_start).toBe('07:30');
    expect(data.preferred_study_end).toBe('20:00');
    expect(data.daily_minimum_minutes).toBe(45);
    expect(data.daily_target_minutes).toBe(150);
    expect(data.max_daily_study_minutes).toBe(240);
    expect(data.timezone).toBe('Asia/Kolkata');
  });
});
