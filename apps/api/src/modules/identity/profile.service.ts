import type { ProfileRow } from '@avenza/shared';
import type { IProfileRepository } from './profile.repository';
import { defaultProfileRepository } from './profile.repository';

export interface ProfileMetadata {
  displayName?: string | null;
  avatarUrl?: string | null;
  timezone?: string | null;
}

export class ProfileService {
  constructor(private readonly repository: IProfileRepository = defaultProfileRepository) {}

  async getOrCreateProfile(clerkUserId: string, metadata?: ProfileMetadata): Promise<ProfileRow> {
    if (!clerkUserId || !clerkUserId.trim()) {
      throw new Error('A valid clerkUserId is required to resolve or bootstrap a profile');
    }

    const trimmedClerkId = clerkUserId.trim();

    // 1. Check if profile already exists
    const existing = await this.repository.findByClerkUserId(trimmedClerkId);
    if (existing) {
      return existing;
    }

    // 2. Bootstrap new profile idempotently
    try {
      return await this.repository.createProfile({
        clerk_user_id: trimmedClerkId,
        display_name: metadata?.displayName?.trim() || null,
        avatar_url: metadata?.avatarUrl?.trim() || null,
        timezone: metadata?.timezone?.trim() || null,
      });
    } catch (error) {
      // In case of concurrent creation race condition, retry finding the existing profile
      const concurrentProfile = await this.repository.findByClerkUserId(trimmedClerkId);
      if (concurrentProfile) {
        return concurrentProfile;
      }
      throw error;
    }
  }

  async getProfileByClerkId(clerkUserId: string): Promise<ProfileRow | null> {
    return this.repository.findByClerkUserId(clerkUserId);
  }

  async deleteProfile(id: string): Promise<boolean> {
    return this.repository.deleteProfile(id);
  }

  async deleteProfileByClerkId(clerkUserId: string): Promise<boolean> {
    const profile = await this.repository.findByClerkUserId(clerkUserId);
    if (!profile) return false;
    return this.repository.deleteProfile(profile.id);
  }
}

export const defaultProfileService = new ProfileService();
