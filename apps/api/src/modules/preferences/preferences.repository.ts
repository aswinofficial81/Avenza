import type { Database, UserPreferencesRow, UpdatePreferencesInput } from '@avenza/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../../db/supabase.client';

export interface IPreferencesRepository {
  findByUserId(userId: string): Promise<UserPreferencesRow | null>;
  ensurePreferences(userId: string, defaultTimezone?: string | null): Promise<UserPreferencesRow>;
  updatePreferences(userId: string, updates: UpdatePreferencesInput): Promise<UserPreferencesRow>;
}

export class SupabasePreferencesRepository implements IPreferencesRepository {
  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) {}

  async findByUserId(userId: string): Promise<UserPreferencesRow | null> {
    const { data, error } = await this.client
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query user preferences: ${error.message}`);
    }

    return (data as UserPreferencesRow | null) || null;
  }

  async ensurePreferences(
    userId: string,
    defaultTimezone?: string | null
  ): Promise<UserPreferencesRow> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;

    const { data, error } = await this.client
      .from('user_preferences')
      .insert({
        user_id: userId,
        theme: 'system',
        timezone: defaultTimezone ?? null,
        daily_minimum_minutes: 30,
        daily_target_minutes: 120,
      })
      .select('*')
      .single();

    if (error) {
      // Handle potential race condition
      const retry = await this.findByUserId(userId);
      if (retry) return retry;
      throw new Error(`Failed to create default preferences: ${error.message}`);
    }

    return data as UserPreferencesRow;
  }

  async updatePreferences(
    userId: string,
    updates: UpdatePreferencesInput
  ): Promise<UserPreferencesRow> {
    // Ensure the row exists before updating
    await this.ensurePreferences(userId);

    const { data, error } = await this.client
      .from('user_preferences')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update user preferences: ${error.message}`);
    }

    return data as UserPreferencesRow;
  }
}

export class InMemoryPreferencesRepository implements IPreferencesRepository {
  private preferences = new Map<string, UserPreferencesRow>();

  async findByUserId(userId: string): Promise<UserPreferencesRow | null> {
    const found = Array.from(this.preferences.values()).find((p) => p.user_id === userId);
    return found ? { ...found } : null;
  }

  async ensurePreferences(
    userId: string,
    defaultTimezone?: string | null
  ): Promise<UserPreferencesRow> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const newPref: UserPreferencesRow = {
      id: crypto.randomUUID(),
      user_id: userId,
      theme: 'system',
      timezone: defaultTimezone ?? null,
      preferred_study_start: null,
      preferred_study_end: null,
      daily_minimum_minutes: 30,
      daily_target_minutes: 120,
      max_daily_study_minutes: null,
      created_at: now,
      updated_at: now,
    };

    this.preferences.set(newPref.id, newPref);
    return { ...newPref };
  }

  async updatePreferences(
    userId: string,
    updates: UpdatePreferencesInput
  ): Promise<UserPreferencesRow> {
    const existing = await this.ensurePreferences(userId);
    const updated: UserPreferencesRow = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.preferences.set(updated.id, updated);
    return { ...updated };
  }

  // Testing helper
  setPreferences(pref: UserPreferencesRow): void {
    this.preferences.set(pref.id, { ...pref });
  }
}

export const defaultPreferencesRepository = new SupabasePreferencesRepository();
