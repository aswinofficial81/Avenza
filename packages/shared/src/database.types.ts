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
      goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          goal_type: string;
          status: string;
          priority: string;
          start_date: string | null;
          target_date: string | null;
          completed_at: string | null;
          desired_outcome: string | null;
          completion_criteria: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          goal_type: string;
          status?: string;
          priority?: string;
          start_date?: string | null;
          target_date?: string | null;
          completed_at?: string | null;
          desired_outcome?: string | null;
          completion_criteria?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          goal_type?: string;
          status?: string;
          priority?: string;
          start_date?: string | null;
          target_date?: string | null;
          completed_at?: string | null;
          desired_outcome?: string | null;
          completion_criteria?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_goals_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      goal_milestones: {
        Row: {
          id: string;
          goal_id: string;
          title: string;
          description: string | null;
          status: string;
          priority: string;
          order_index: number;
          start_date: string | null;
          target_date: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          title: string;
          description?: string | null;
          status?: string;
          priority?: string;
          order_index?: number;
          start_date?: string | null;
          target_date?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          goal_id?: string;
          title?: string;
          description?: string | null;
          status?: string;
          priority?: string;
          order_index?: number;
          start_date?: string | null;
          target_date?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_goal_milestones_goal_id';
            columns: ['goal_id'];
            referencedRelation: 'goals';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          status: string;
          priority: string;
          task_type: string;
          goal_id: string | null;
          milestone_id: string | null;
          estimated_minutes: number | null;
          actual_minutes: number | null;
          due_at: string | null;
          scheduled_start: string | null;
          scheduled_end: string | null;
          completed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          status?: string;
          priority?: string;
          task_type?: string;
          goal_id?: string | null;
          milestone_id?: string | null;
          estimated_minutes?: number | null;
          actual_minutes?: number | null;
          due_at?: string | null;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          status?: string;
          priority?: string;
          task_type?: string;
          goal_id?: string | null;
          milestone_id?: string | null;
          estimated_minutes?: number | null;
          actual_minutes?: number | null;
          due_at?: string | null;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_tasks_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_tasks_goal_id';
            columns: ['goal_id'];
            referencedRelation: 'goals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_tasks_milestone_id';
            columns: ['milestone_id'];
            referencedRelation: 'goal_milestones';
            referencedColumns: ['id'];
          },
        ];
      };
      task_dependencies: {
        Row: {
          id: string;
          task_id: string;
          depends_on_task_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          depends_on_task_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          depends_on_task_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_task_dependencies_task_id';
            columns: ['task_id'];
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_task_dependencies_depends_on_task_id';
            columns: ['depends_on_task_id'];
            referencedRelation: 'tasks';
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

export type GoalRow = Database['public']['Tables']['goals']['Row'];
export type GoalInsert = Database['public']['Tables']['goals']['Insert'];
export type GoalUpdate = Database['public']['Tables']['goals']['Update'];

export type GoalMilestoneRow = Database['public']['Tables']['goal_milestones']['Row'];
export type GoalMilestoneInsert = Database['public']['Tables']['goal_milestones']['Insert'];
export type GoalMilestoneUpdate = Database['public']['Tables']['goal_milestones']['Update'];

export type TaskRow = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

export type TaskDependencyRow = Database['public']['Tables']['task_dependencies']['Row'];
export type TaskDependencyInsert = Database['public']['Tables']['task_dependencies']['Insert'];
export type TaskDependencyUpdate = Database['public']['Tables']['task_dependencies']['Update'];

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
