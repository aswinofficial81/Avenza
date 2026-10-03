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
      focus_sessions: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          session_type: string;
          status: string;
          started_at: string;
          ended_at: string | null;
          planned_minutes: number;
          actual_minutes: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id?: string | null;
          session_type?: string;
          status?: string;
          started_at?: string;
          ended_at?: string | null;
          planned_minutes: number;
          actual_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string | null;
          session_type?: string;
          status?: string;
          started_at?: string;
          ended_at?: string | null;
          planned_minutes?: number;
          actual_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_focus_sessions_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_focus_sessions_task_id';
            columns: ['task_id'];
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      evidence: {
        Row: {
          id: string;
          user_id: string;
          evidence_type: string;
          title: string;
          description: string | null;
          source_type: string;
          source_id: string | null;
          source_reference: string | null;
          external_url: string | null;
          occurred_at: string;
          recorded_at: string;
          verification_status: string;
          evidence_strength: string;
          reliability: string;
          directness: string;
          notes: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          evidence_type: string;
          title: string;
          description?: string | null;
          source_type: string;
          source_id?: string | null;
          source_reference?: string | null;
          external_url?: string | null;
          occurred_at?: string;
          recorded_at?: string;
          verification_status?: string;
          evidence_strength?: string;
          reliability?: string;
          directness?: string;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          evidence_type?: string;
          title?: string;
          description?: string | null;
          source_type?: string;
          source_id?: string | null;
          source_reference?: string | null;
          external_url?: string | null;
          occurred_at?: string;
          recorded_at?: string;
          verification_status?: string;
          evidence_strength?: string;
          reliability?: string;
          directness?: string;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_evidence_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      evidence_links: {
        Row: {
          id: string;
          evidence_id: string;
          entity_type: string;
          entity_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          evidence_id: string;
          entity_type: string;
          entity_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          evidence_id?: string;
          entity_type?: string;
          entity_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_evidence_links_evidence_id';
            columns: ['evidence_id'];
            referencedRelation: 'evidence';
            referencedColumns: ['id'];
          },
        ];
      };
      academic_years: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_current: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_current?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          start_date?: string;
          end_date?: string;
          is_current?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      terms: {
        Row: {
          id: string;
          user_id: string;
          academic_year_id: string | null;
          name: string;
          code: string | null;
          start_date: string;
          end_date: string;
          status: string;
          is_current: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          academic_year_id?: string | null;
          name: string;
          code?: string | null;
          start_date: string;
          end_date: string;
          status?: string;
          is_current?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          academic_year_id?: string | null;
          name?: string;
          code?: string | null;
          start_date?: string;
          end_date?: string;
          status?: string;
          is_current?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subjects: {
        Row: {
          id: string;
          user_id: string;
          term_id: string;
          name: string;
          code: string | null;
          description: string | null;
          instructor: string | null;
          credits: number | null;
          color: string | null;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          term_id: string;
          name: string;
          code?: string | null;
          description?: string | null;
          instructor?: string | null;
          credits?: number | null;
          color?: string | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          term_id?: string;
          name?: string;
          code?: string | null;
          description?: string | null;
          instructor?: string | null;
          credits?: number | null;
          color?: string | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subject_topics: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string;
          name: string;
          description: string | null;
          order_index: number;
          status: string;
          importance: string;
          estimated_minutes: number | null;
          resources: Json;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          name: string;
          description?: string | null;
          order_index?: number;
          status?: string;
          importance?: string;
          estimated_minutes?: number | null;
          resources?: Json;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject_id?: string;
          name?: string;
          description?: string | null;
          order_index?: number;
          status?: string;
          importance?: string;
          estimated_minutes?: number | null;
          resources?: Json;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessments: {
        Row: {
          id: string;
          user_id: string;
          term_id: string;
          subject_id: string | null;
          title: string;
          assessment_type: string;
          description: string | null;
          due_at: string | null;
          max_marks: number | null;
          obtained_marks: number | null;
          weight_percent: number | null;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          term_id: string;
          subject_id?: string | null;
          title: string;
          assessment_type?: string;
          description?: string | null;
          due_at?: string | null;
          max_marks?: number | null;
          obtained_marks?: number | null;
          weight_percent?: number | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          term_id?: string;
          subject_id?: string | null;
          title?: string;
          assessment_type?: string;
          description?: string | null;
          due_at?: string | null;
          max_marks?: number | null;
          obtained_marks?: number | null;
          weight_percent?: number | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessment_topics: {
        Row: {
          assessment_id: string;
          topic_id: string;
          created_at: string;
        };
        Insert: {
          assessment_id: string;
          topic_id: string;
          created_at?: string;
        };
        Update: {
          assessment_id?: string;
          topic_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      exams: {
        Row: {
          id: string;
          user_id: string;
          term_id: string;
          subject_id: string | null;
          title: string;
          exam_type: string;
          exam_date: string;
          duration_minutes: number | null;
          location: string | null;
          weight_percent: number | null;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          term_id: string;
          subject_id?: string | null;
          title: string;
          exam_type?: string;
          exam_date: string;
          duration_minutes?: number | null;
          location?: string | null;
          weight_percent?: number | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          term_id?: string;
          subject_id?: string | null;
          title?: string;
          exam_type?: string;
          exam_date?: string;
          duration_minutes?: number | null;
          location?: string | null;
          weight_percent?: number | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exam_topics: {
        Row: {
          exam_id: string;
          topic_id: string;
          created_at: string;
        };
        Insert: {
          exam_id: string;
          topic_id: string;
          created_at?: string;
        };
        Update: {
          exam_id?: string;
          topic_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      skills: {
        Row: {
          id: string;
          user_id: string;
          parent_skill_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          category: string | null;
          status: string;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          parent_skill_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          category?: string | null;
          status?: string;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          parent_skill_id?: string | null;
          name?: string;
          slug?: string;
          description?: string | null;
          category?: string | null;
          status?: string;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      evidence_skills: {
        Row: {
          evidence_id: string;
          skill_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          evidence_id: string;
          skill_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          evidence_id?: string;
          skill_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      goal_skills: {
        Row: {
          goal_id: string;
          skill_id: string;
          user_id: string;
          target_mastery_state: string | null;
          created_at: string;
        };
        Insert: {
          goal_id: string;
          skill_id: string;
          user_id: string;
          target_mastery_state?: string | null;
          created_at?: string;
        };
        Update: {
          goal_id?: string;
          skill_id?: string;
          user_id?: string;
          target_mastery_state?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      task_skills: {
        Row: {
          task_id: string;
          skill_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          task_id: string;
          skill_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          task_id?: string;
          skill_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      topic_skills: {
        Row: {
          topic_id: string;
          skill_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          topic_id: string;
          skill_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          topic_id?: string;
          skill_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
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

export type AcademicYearRow = Database['public']['Tables']['academic_years']['Row'];
export type AcademicYearInsert = Database['public']['Tables']['academic_years']['Insert'];
export type AcademicYearUpdate = Database['public']['Tables']['academic_years']['Update'];

export type TermRow = Database['public']['Tables']['terms']['Row'];
export type TermInsert = Database['public']['Tables']['terms']['Insert'];
export type TermUpdate = Database['public']['Tables']['terms']['Update'];

export type SubjectRow = Database['public']['Tables']['subjects']['Row'];
export type SubjectInsert = Database['public']['Tables']['subjects']['Insert'];
export type SubjectUpdate = Database['public']['Tables']['subjects']['Update'];

export type SubjectTopicRow = Database['public']['Tables']['subject_topics']['Row'];
export type SubjectTopicInsert = Database['public']['Tables']['subject_topics']['Insert'];
export type SubjectTopicUpdate = Database['public']['Tables']['subject_topics']['Update'];

export type AssessmentRow = Database['public']['Tables']['assessments']['Row'];
export type AssessmentInsert = Database['public']['Tables']['assessments']['Insert'];
export type AssessmentUpdate = Database['public']['Tables']['assessments']['Update'];

export type ExamRow = Database['public']['Tables']['exams']['Row'];
export type ExamInsert = Database['public']['Tables']['exams']['Insert'];
export type ExamUpdate = Database['public']['Tables']['exams']['Update'];

export type SkillRow = Database['public']['Tables']['skills']['Row'];
export type SkillInsert = Database['public']['Tables']['skills']['Insert'];
export type SkillUpdate = Database['public']['Tables']['skills']['Update'];

export type EvidenceSkillRow = Database['public']['Tables']['evidence_skills']['Row'];
export type EvidenceSkillInsert = Database['public']['Tables']['evidence_skills']['Insert'];
export type EvidenceSkillUpdate = Database['public']['Tables']['evidence_skills']['Update'];

export type GoalSkillRow = Database['public']['Tables']['goal_skills']['Row'];
export type GoalSkillInsert = Database['public']['Tables']['goal_skills']['Insert'];
export type GoalSkillUpdate = Database['public']['Tables']['goal_skills']['Update'];

export type TaskSkillRow = Database['public']['Tables']['task_skills']['Row'];
export type TaskSkillInsert = Database['public']['Tables']['task_skills']['Insert'];
export type TaskSkillUpdate = Database['public']['Tables']['task_skills']['Update'];

export type TopicSkillRow = Database['public']['Tables']['topic_skills']['Row'];
export type TopicSkillInsert = Database['public']['Tables']['topic_skills']['Insert'];
export type TopicSkillUpdate = Database['public']['Tables']['topic_skills']['Update'];

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
