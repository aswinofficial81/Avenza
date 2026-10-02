import { z } from 'zod';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          clerk_user_id: string;
          display_name: string | null;
          avatar_url: string | null;
          timezone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clerk_user_id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clerk_user_id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          theme: ThemePreference;
          timezone: string | null;
          preferred_study_start: string | null;
          preferred_study_end: string | null;
          daily_minimum_minutes: number;
          daily_target_minutes: number;
          max_daily_study_minutes: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          theme?: ThemePreference;
          timezone?: string | null;
          preferred_study_start?: string | null;
          preferred_study_end?: string | null;
          daily_minimum_minutes?: number;
          daily_target_minutes?: number;
          max_daily_study_minutes?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          theme?: ThemePreference;
          timezone?: string | null;
          preferred_study_start?: string | null;
          preferred_study_end?: string | null;
          daily_minimum_minutes?: number;
          daily_target_minutes?: number;
          max_daily_study_minutes?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_user_preferences_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      handle_updated_at: {
        Args: Record<string, never>;
        Returns: unknown;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience Type Aliases
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type UserPreferencesRow = Database['public']['Tables']['user_preferences']['Row'];
export type UserPreferencesInsert = Database['public']['Tables']['user_preferences']['Insert'];
export type UserPreferencesUpdate = Database['public']['Tables']['user_preferences']['Update'];

// Zod Validation Schemas for Application Payloads
export const ThemePreferenceSchema = z.enum(['system', 'light', 'dark']);

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  clerk_user_id: z.string().min(1),
  display_name: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  timezone: z.string().nullable().optional(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export const UserPreferencesSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    theme: ThemePreferenceSchema.default('system'),
    timezone: z.string().nullable().optional(),
    preferred_study_start: z.string().nullable().optional(),
    preferred_study_end: z.string().nullable().optional(),
    daily_minimum_minutes: z.number().int().min(0).default(30),
    daily_target_minutes: z.number().int().min(0).default(120),
    max_daily_study_minutes: z.number().int().min(0).nullable().optional(),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
  })
  .refine((data) => data.daily_target_minutes >= data.daily_minimum_minutes, {
    message: 'daily_target_minutes must be greater than or equal to daily_minimum_minutes',
    path: ['daily_target_minutes'],
  })
  .refine(
    (data) =>
      data.max_daily_study_minutes == null ||
      data.max_daily_study_minutes >= data.daily_target_minutes,
    {
      message: 'max_daily_study_minutes must be greater than or equal to daily_target_minutes',
      path: ['max_daily_study_minutes'],
    }
  );
