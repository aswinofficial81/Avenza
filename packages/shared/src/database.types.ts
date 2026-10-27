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
          project_id: string | null;
          project_milestone_id: string | null;
          application_id?: string | null;
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
          project_id?: string | null;
          project_milestone_id?: string | null;
          application_id?: string | null;
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
          project_id?: string | null;
          project_milestone_id?: string | null;
          application_id?: string | null;
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
          {
            foreignKeyName: 'tasks_application_id_fkey';
            columns: ['application_id'];
            referencedRelation: 'career_applications';
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
      },
      // DSA Tables
      dsa_problems: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          slug: string;
          description: string | null;
          difficulty: string;
          source: string;
          status: string;
          external_url: string | null;
          estimated_minutes: number | null;
          attempt_count: number;
          solved_count: number;
          failed_count: number;
          last_attempt_at: string | null;
          last_solved_at: string | null;
          next_review_at: string | null;
          revision_count: number;
          review_stage: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          slug: string;
          description?: string | null;
          difficulty: string;
          source?: string;
          status?: string;
          external_url?: string | null;
          estimated_minutes?: number | null;
          attempt_count?: number;
          solved_count?: number;
          failed_count?: number;
          last_attempt_at?: string | null;
          last_solved_at?: string | null;
          next_review_at?: string | null;
          revision_count?: number;
          review_stage?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          slug?: string;
          description?: string | null;
          difficulty?: string;
          source?: string;
          status?: string;
          external_url?: string | null;
          estimated_minutes?: number | null;
          attempt_count?: number;
          solved_count?: number;
          failed_count?: number;
          last_attempt_at?: string | null;
          last_solved_at?: string | null;
          next_review_at?: string | null;
          revision_count?: number;
          review_stage?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_dsa_problems_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ],
      },
      dsa_topics: {
        Row: {
          id: string;
          user_id: string;
          parent_topic_id: string | null;
          name: string;
          slug: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          parent_topic_id?: string | null;
          name: string;
          slug: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          parent_topic_id?: string | null;
          name?: string;
          slug?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_dsa_topics_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_dsa_topics_parent';
            columns: ['parent_topic_id'];
            referencedRelation: 'dsa_topics';
            referencedColumns: ['id'];
          }
        ],
      },
      dsa_problem_topics: {
        Row: {
          problem_id: string;
          topic_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          problem_id: string;
          topic_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          problem_id?: string;
          topic_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_dsa_problem_topics_problem';
            columns: ['problem_id'];
            referencedRelation: 'dsa_problems';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_dsa_problem_topics_topic';
            columns: ['topic_id'];
            referencedRelation: 'dsa_topics';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_dsa_problem_topics_user';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ],
      },
      dsa_problem_skills: {
        Row: {
          problem_id: string;
          skill_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          problem_id: string;
          skill_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          problem_id?: string;
          skill_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_dsa_problem_skills_problem';
            columns: ['problem_id'];
            referencedRelation: 'dsa_problems';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_dsa_problem_skills_skill';
            columns: ['skill_id'];
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_dsa_problem_skills_user';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ],
      },
      dsa_problem_goals: {
        Row: {
          problem_id: string;
          goal_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          problem_id: string;
          goal_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          problem_id?: string;
          goal_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_dsa_problem_goals_problem';
            columns: ['problem_id'];
            referencedRelation: 'dsa_problems';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_dsa_problem_goals_goal';
            columns: ['goal_id'];
            referencedRelation: 'goals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_dsa_problem_goals_user';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ],
      },
      dsa_problem_tasks: {
        Row: {
          problem_id: string;
          task_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          problem_id: string;
          task_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          problem_id?: string;
          task_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_dsa_problem_tasks_problem';
            columns: ['problem_id'];
            referencedRelation: 'dsa_problems';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_dsa_problem_tasks_task';
            columns: ['task_id'];
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_dsa_problem_tasks_user';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ],
      },
      dsa_attempts: {
        Row: {
          id: string;
          user_id: string;
          problem_id: string;
          status: string;
          started_at: string | null;
          submitted_at: string | null;
          occurred_at: string;
          recorded_at: string;
          solve_time_minutes: number | null;
          language: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          problem_id: string;
          status?: string;
          started_at?: string | null;
          submitted_at?: string | null;
          occurred_at?: string;
          recorded_at?: string;
          solve_time_minutes?: number | null;
          language?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          problem_id?: string;
          status?: string;
          started_at?: string | null;
          submitted_at?: string | null;
          occurred_at?: string;
          recorded_at?: string;
          solve_time_minutes?: number | null;
          language?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_dsa_attempts_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_dsa_attempts_problem_id';
            columns: ['problem_id'];
            referencedRelation: 'dsa_problems';
            referencedColumns: ['id'];
          }
        ]
      },
      projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          slug: string;
          description: string | null;
          status: string;
          priority: string;
          project_type: string;
          repository_id: string | null;
          start_date: string | null;
          target_date: string | null;
          completed_at: string | null;
          live_url: string | null;
          architecture_notes: string | null;
          tech_stack: string[];
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          slug: string;
          description?: string | null;
          status?: string;
          priority?: string;
          project_type?: string;
          repository_id?: string | null;
          start_date?: string | null;
          target_date?: string | null;
          completed_at?: string | null;
          live_url?: string | null;
          architecture_notes?: string | null;
          tech_stack?: string[];
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          slug?: string;
          description?: string | null;
          status?: string;
          priority?: string;
          project_type?: string;
          repository_id?: string | null;
          start_date?: string | null;
          target_date?: string | null;
          completed_at?: string | null;
          live_url?: string | null;
          architecture_notes?: string | null;
          tech_stack?: string[];
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_projects_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_projects_repository_id';
            columns: ['repository_id'];
            referencedRelation: 'external_repositories';
            referencedColumns: ['id'];
          }
        ];
      },
      project_milestones: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          title: string;
          description: string | null;
          status: string;
          order_index: number;
          target_date: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          title: string;
          description?: string | null;
          status?: string;
          order_index?: number;
          target_date?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          status?: string;
          order_index?: number;
          target_date?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_project_milestones_project_id';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_project_milestones_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      },
      project_goals: {
        Row: {
          project_id: string;
          goal_id: string;
          user_id: string;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          project_id: string;
          goal_id: string;
          user_id: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          project_id?: string;
          goal_id?: string;
          user_id?: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_project_goals_project';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_project_goals_goal';
            columns: ['goal_id'];
            referencedRelation: 'goals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_project_goals_user';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      },
      project_skills: {
        Row: {
          project_id: string;
          skill_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          project_id: string;
          skill_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          project_id?: string;
          skill_id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_project_skills_project';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_project_skills_skill';
            columns: ['skill_id'];
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_project_skills_user';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      },
      career_targets: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string | null;
          title: string;
          target_role: string;
          target_locations: string[];
          employment_type: string | null;
          target_date: string | null;
          min_compensation: number | null;
          currency: string | null;
          is_primary: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_id?: string | null;
          title: string;
          target_role: string;
          target_locations?: string[];
          employment_type?: string | null;
          target_date?: string | null;
          min_compensation?: number | null;
          currency?: string | null;
          is_primary?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_id?: string | null;
          title?: string;
          target_role?: string;
          target_locations?: string[];
          employment_type?: string | null;
          target_date?: string | null;
          min_compensation?: number | null;
          currency?: string | null;
          is_primary?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_career_targets_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_career_targets_goal_id';
            columns: ['goal_id'];
            referencedRelation: 'goals';
            referencedColumns: ['id'];
          }
        ];
      },
      career_target_skills: {
        Row: {
          id: string;
          user_id: string;
          target_id: string;
          skill_id: string;
          importance: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_id: string;
          skill_id: string;
          importance?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          target_id?: string;
          skill_id?: string;
          importance?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_career_target_skills_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_career_target_skills_target_id';
            columns: ['target_id'];
            referencedRelation: 'career_targets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_career_target_skills_skill_id';
            columns: ['skill_id'];
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          }
        ];
      },
      career_opportunities: {
        Row: {
          id: string;
          user_id: string;
          target_id: string | null;
          company_name: string;
          role_title: string;
          employment_type: string | null;
          location_type: string | null;
          location: string | null;
          source: string;
          job_url: string | null;
          salary_min: number | null;
          salary_max: number | null;
          salary_currency: string | null;
          deadline: string | null;
          description: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_id?: string | null;
          company_name: string;
          role_title: string;
          employment_type?: string | null;
          location_type?: string | null;
          location?: string | null;
          source?: string;
          job_url?: string | null;
          salary_min?: number | null;
          salary_max?: number | null;
          salary_currency?: string | null;
          deadline?: string | null;
          description?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          target_id?: string | null;
          company_name?: string;
          role_title?: string;
          employment_type?: string | null;
          location_type?: string | null;
          location?: string | null;
          source?: string;
          job_url?: string | null;
          salary_min?: number | null;
          salary_max?: number | null;
          salary_currency?: string | null;
          deadline?: string | null;
          description?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_career_opportunities_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_career_opportunities_target_id';
            columns: ['target_id'];
            referencedRelation: 'career_targets';
            referencedColumns: ['id'];
          }
        ];
      },
      career_opportunity_skills: {
        Row: {
          id: string;
          user_id: string;
          opportunity_id: string;
          skill_id: string;
          importance: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          opportunity_id: string;
          skill_id: string;
          importance?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          opportunity_id?: string;
          skill_id?: string;
          importance?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_career_opp_skills_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_career_opp_skills_opportunity_id';
            columns: ['opportunity_id'];
            referencedRelation: 'career_opportunities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_career_opp_skills_skill_id';
            columns: ['skill_id'];
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          }
        ];
      },
      career_applications: {
        Row: {
          id: string;
          user_id: string;
          opportunity_id: string;
          stage: string;
          applied_at: string | null;
          deadline: string | null;
          resume_file_url: string | null;
          cover_letter_url: string | null;
          notes: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          opportunity_id: string;
          stage?: string;
          applied_at?: string | null;
          deadline?: string | null;
          resume_file_url?: string | null;
          cover_letter_url?: string | null;
          notes?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          opportunity_id?: string;
          stage?: string;
          applied_at?: string | null;
          deadline?: string | null;
          resume_file_url?: string | null;
          cover_letter_url?: string | null;
          notes?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_career_applications_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_career_applications_opportunity_id';
            columns: ['opportunity_id'];
            referencedRelation: 'career_opportunities';
            referencedColumns: ['id'];
          }
        ];
      },
      career_application_history: {
        Row: {
          id: string;
          user_id: string;
          application_id: string;
          from_stage: string | null;
          to_stage: string;
          changed_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          application_id: string;
          from_stage?: string | null;
          to_stage: string;
          changed_at?: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          application_id?: string;
          from_stage?: string | null;
          to_stage?: string;
          changed_at?: string;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_career_app_history_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_career_app_history_application_id';
            columns: ['application_id'];
            referencedRelation: 'career_applications';
            referencedColumns: ['id'];
          }
        ];
      },
      career_application_projects: {
        Row: {
          id: string;
          user_id: string;
          application_id: string;
          project_id: string;
          is_featured: boolean;
          talking_points: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          application_id: string;
          project_id: string;
          is_featured?: boolean;
          talking_points?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          application_id?: string;
          project_id?: string;
          is_featured?: boolean;
          talking_points?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_career_app_projects_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_career_app_projects_application_id';
            columns: ['application_id'];
            referencedRelation: 'career_applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_career_app_projects_project_id';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          }
        ];
      },
      career_interviews: {
        Row: {
          id: string;
          user_id: string;
          application_id: string;
          round_number: number;
          round_type: string;
          scheduled_at: string | null;
          duration_minutes: number;
          meeting_link: string | null;
          status: string;
          result: string;
          interviewer_names: string[];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          application_id: string;
          round_number?: number;
          round_type?: string;
          scheduled_at?: string | null;
          duration_minutes?: number;
          meeting_link?: string | null;
          status?: string;
          result?: string;
          interviewer_names?: string[];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          application_id?: string;
          round_number?: number;
          round_type?: string;
          scheduled_at?: string | null;
          duration_minutes?: number;
          meeting_link?: string | null;
          status?: string;
          result?: string;
          interviewer_names?: string[];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_career_interviews_user_id';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_career_interviews_application_id';
            columns: ['application_id'];
            referencedRelation: 'career_applications';
            referencedColumns: ['id'];
          }
        ];
      };
      weekly_reviews: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          week_end: string;
          timezone: string;
          went_well: string;
          challenges: string;
          next_week_priority: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start: string;
          week_end: string;
          timezone?: string;
          went_well?: string;
          challenges?: string;
          next_week_priority?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start?: string;
          week_end?: string;
          timezone?: string;
          went_well?: string;
          challenges?: string;
          next_week_priority?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'weekly_reviews_user_id_fkey';
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
      career_create_target: {
        Args: {
          p_user_id: string;
          p_title: string;
          p_target_role: string;
          p_target_locations?: string[];
          p_employment_type?: string | null;
          p_target_date?: string | null;
          p_min_compensation?: number | null;
          p_currency?: string | null;
          p_is_primary?: boolean;
          p_notes?: string | null;
          p_goal_id?: string | null;
        };
        Returns: Database['public']['Tables']['career_targets']['Row'];
      };
      career_set_target_primary: {
        Args: {
          p_user_id: string;
          p_target_id: string;
        };
        Returns: Database['public']['Tables']['career_targets']['Row'];
      };
      career_create_application: {
        Args: {
          p_user_id: string;
          p_opportunity_id: string;
          p_stage?: string;
          p_applied_at?: string | null;
          p_deadline?: string | null;
          p_resume_file_url?: string | null;
          p_cover_letter_url?: string | null;
          p_notes?: string | null;
          p_rejection_reason?: string | null;
          p_history_notes?: string | null;
        };
        Returns: {
          application: Database['public']['Tables']['career_applications']['Row'];
          history: Database['public']['Tables']['career_application_history']['Row'];
        };
      };
      career_update_application_stage_with_history: {
        Args: {
          p_user_id: string;
          p_application_id: string;
          p_new_stage: string;
          p_notes?: string | null;
        };
        Returns: {
          application: Database['public']['Tables']['career_applications']['Row'];
          history: Database['public']['Tables']['career_application_history']['Row'];
        };
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

export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export type ProjectMilestoneRow = Database['public']['Tables']['project_milestones']['Row'];
export type ProjectMilestoneInsert = Database['public']['Tables']['project_milestones']['Insert'];
export type ProjectMilestoneUpdate = Database['public']['Tables']['project_milestones']['Update'];

export type ProjectGoalRow = Database['public']['Tables']['project_goals']['Row'];
export type ProjectGoalInsert = Database['public']['Tables']['project_goals']['Insert'];
export type ProjectGoalUpdate = Database['public']['Tables']['project_goals']['Update'];

export type ProjectSkillRow = Database['public']['Tables']['project_skills']['Row'];
export type ProjectSkillInsert = Database['public']['Tables']['project_skills']['Insert'];
export type ProjectSkillUpdate = Database['public']['Tables']['project_skills']['Update'];

export type CareerTargetRow = Database['public']['Tables']['career_targets']['Row'];
export type CareerTargetInsert = Database['public']['Tables']['career_targets']['Insert'];
export type CareerTargetUpdate = Database['public']['Tables']['career_targets']['Update'];

export type CareerTargetSkillRow = Database['public']['Tables']['career_target_skills']['Row'];
export type CareerTargetSkillInsert = Database['public']['Tables']['career_target_skills']['Insert'];
export type CareerTargetSkillUpdate = Database['public']['Tables']['career_target_skills']['Update'];

export type CareerOpportunityRow = Database['public']['Tables']['career_opportunities']['Row'];
export type CareerOpportunityInsert = Database['public']['Tables']['career_opportunities']['Insert'];
export type CareerOpportunityUpdate = Database['public']['Tables']['career_opportunities']['Update'];

export type CareerOpportunitySkillRow = Database['public']['Tables']['career_opportunity_skills']['Row'];
export type CareerOpportunitySkillInsert = Database['public']['Tables']['career_opportunity_skills']['Insert'];
export type CareerOpportunitySkillUpdate = Database['public']['Tables']['career_opportunity_skills']['Update'];

export type CareerApplicationRow = Database['public']['Tables']['career_applications']['Row'];
export type CareerApplicationInsert = Database['public']['Tables']['career_applications']['Insert'];
export type CareerApplicationUpdate = Database['public']['Tables']['career_applications']['Update'];

export type CareerApplicationHistoryRow = Database['public']['Tables']['career_application_history']['Row'];
export type CareerApplicationHistoryInsert = Database['public']['Tables']['career_application_history']['Insert'];
export type CareerApplicationHistoryUpdate = Database['public']['Tables']['career_application_history']['Update'];

export type CareerApplicationProjectRow = Database['public']['Tables']['career_application_projects']['Row'];
export type CareerApplicationProjectInsert = Database['public']['Tables']['career_application_projects']['Insert'];
export type CareerApplicationProjectUpdate = Database['public']['Tables']['career_application_projects']['Update'];

export type CareerInterviewRow = Database['public']['Tables']['career_interviews']['Row'];
export type CareerInterviewInsert = Database['public']['Tables']['career_interviews']['Insert'];
export type CareerInterviewUpdate = Database['public']['Tables']['career_interviews']['Update'];

export type WeeklyReviewRow = Database['public']['Tables']['weekly_reviews']['Row'];
export type WeeklyReviewInsert = Database['public']['Tables']['weekly_reviews']['Insert'];
export type WeeklyReviewUpdate = Database['public']['Tables']['weekly_reviews']['Update'];

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
