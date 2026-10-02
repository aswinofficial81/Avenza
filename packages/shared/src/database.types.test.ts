import { describe, expect, it } from 'vitest';
import {
  ProfileSchema,
  UserPreferencesSchema,
  type ProfileRow,
  type UserPreferencesRow,
} from './database.types';

describe('Database Types & Schemas', () => {
  it('validates a correct profile structure', () => {
    const validProfile: ProfileRow = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      clerk_user_id: 'user_2NNEqL7i8Q2a9X...',
      display_name: 'Aswin Babu',
      avatar_url: 'https://example.com/avatar.png',
      timezone: 'Asia/Kolkata',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const parsed = ProfileSchema.parse(validProfile);
    expect(parsed.id).toBe(validProfile.id);
    expect(parsed.clerk_user_id).toBe(validProfile.clerk_user_id);
  });

  it('validates a correct user_preferences structure', () => {
    const validPrefs: UserPreferencesRow = {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      theme: 'dark',
      timezone: 'UTC',
      preferred_study_start: '09:00:00',
      preferred_study_end: '17:00:00',
      daily_minimum_minutes: 30,
      daily_target_minutes: 120,
      max_daily_study_minutes: 240,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const parsed = UserPreferencesSchema.parse(validPrefs);
    expect(parsed.theme).toBe('dark');
    expect(parsed.daily_target_minutes).toBe(120);
  });

  it('rejects user_preferences when daily_target_minutes is less than daily_minimum_minutes', () => {
    const invalidPrefs = {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      theme: 'dark',
      timezone: 'UTC',
      daily_minimum_minutes: 60,
      daily_target_minutes: 30, // Invalid: target < minimum
      max_daily_study_minutes: 180,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(() => UserPreferencesSchema.parse(invalidPrefs)).toThrow(
      /daily_target_minutes must be greater than or equal to daily_minimum_minutes/
    );
  });

  it('rejects user_preferences when max_daily_study_minutes is less than daily_target_minutes', () => {
    const invalidPrefs = {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      theme: 'system',
      daily_minimum_minutes: 30,
      daily_target_minutes: 120,
      max_daily_study_minutes: 60, // Invalid: max < target
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(() => UserPreferencesSchema.parse(invalidPrefs)).toThrow(
      /max_daily_study_minutes must be greater than or equal to daily_target_minutes/
    );
  });
});
