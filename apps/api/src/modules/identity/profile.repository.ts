import type { ProfileInsert, ProfileRow, Database } from '@avenza/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../../db/supabase.client';

export interface IProfileRepository {
  findByClerkUserId(clerkUserId: string): Promise<ProfileRow | null>;
  findById(id: string): Promise<ProfileRow | null>;
  createProfile(data: ProfileInsert): Promise<ProfileRow>;
  deleteProfile(id: string): Promise<boolean>;
}

export class SupabaseProfileRepository implements IProfileRepository {
  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) {}

  async findByClerkUserId(clerkUserId: string): Promise<ProfileRow | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query profile by Clerk user ID: ${error.message}`);
    }

    return (data as ProfileRow | null) || null;
  }

  async findById(id: string): Promise<ProfileRow | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query profile by ID: ${error.message}`);
    }

    return (data as ProfileRow | null) || null;
  }

  async createProfile(data: ProfileInsert): Promise<ProfileRow> {
    const { data: created, error } = await this.client
      .from('profiles')
      .insert({
        clerk_user_id: data.clerk_user_id,
        display_name: data.display_name ?? null,
        avatar_url: data.avatar_url ?? null,
        timezone: data.timezone ?? null,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create profile: ${error.message}`);
    }

    return created as ProfileRow;
  }

  async deleteProfile(id: string): Promise<boolean> {
    const { error, count } = await this.client
      .from('profiles')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete profile: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }
}

export class InMemoryProfileRepository implements IProfileRepository {
  private profiles = new Map<string, ProfileRow>();

  async findByClerkUserId(clerkUserId: string): Promise<ProfileRow | null> {
    for (const profile of this.profiles.values()) {
      if (profile.clerk_user_id === clerkUserId) {
        return { ...profile };
      }
    }
    return null;
  }

  async findById(id: string): Promise<ProfileRow | null> {
    const profile = this.profiles.get(id);
    return profile ? { ...profile } : null;
  }

  async createProfile(data: ProfileInsert): Promise<ProfileRow> {
    // Enforce uniqueness of clerk_user_id
    for (const existing of this.profiles.values()) {
      if (existing.clerk_user_id === data.clerk_user_id) {
        throw new Error(
          'duplicate key value violates unique constraint "uq_profiles_clerk_user_id"'
        );
      }
    }

    const now = new Date().toISOString();
    const newProfile: ProfileRow = {
      id: data.id || crypto.randomUUID(),
      clerk_user_id: data.clerk_user_id,
      display_name: data.display_name ?? null,
      avatar_url: data.avatar_url ?? null,
      timezone: data.timezone ?? null,
      created_at: data.created_at || now,
      updated_at: data.updated_at || now,
    };

    this.profiles.set(newProfile.id, newProfile);
    return { ...newProfile };
  }

  async deleteProfile(id: string): Promise<boolean> {
    return this.profiles.delete(id);
  }
}

export const defaultProfileRepository = new SupabaseProfileRepository();
