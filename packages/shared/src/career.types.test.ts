import { describe, expect, it } from 'vitest';
import {
  CAREER_APPLICATION_STAGES,
  CAREER_EMPLOYMENT_TYPES,
  CAREER_INTERVIEW_RESULTS,
  CAREER_INTERVIEW_STATUSES,
  CAREER_INTERVIEW_TYPES,
  CAREER_LOCATION_TYPES,
  CAREER_OPPORTUNITY_SOURCES,
  CAREER_OPPORTUNITY_STATUSES,
  CAREER_SKILL_IMPORTANCES,
  CreateCareerTargetSchema,
  UpdateCareerTargetSchema,
  AddCareerTargetSkillSchema,
  CreateCareerOpportunitySchema,
  UpdateCareerOpportunitySchema,
  AddCareerOpportunitySkillSchema,
  CreateCareerApplicationSchema,
  UpdateCareerApplicationSchema,
  CreateCareerApplicationHistorySchema,
  AttachCareerApplicationProjectSchema,
  CreateCareerInterviewSchema,
  UpdateCareerInterviewSchema,
  CareerTargetQuerySchema,
  CareerOpportunityQuerySchema,
  CareerApplicationQuerySchema,
  CareerInterviewQuerySchema,
} from './career.types';

describe('Shared Career Types & Schemas (Phase 16B)', () => {
  describe('1. Enums Alignment', () => {
    it('contains all required employment types', () => {
      expect(CAREER_EMPLOYMENT_TYPES).toEqual([
        'internship',
        'full_time',
        'contract',
        'part_time',
        'co_op',
      ]);
    });

    it('contains all required location types', () => {
      expect(CAREER_LOCATION_TYPES).toEqual(['remote', 'hybrid', 'onsite']);
    });

    it('contains all required opportunity sources', () => {
      expect(CAREER_OPPORTUNITY_SOURCES).toEqual([
        'linkedin',
        'indeed',
        'company_website',
        'referral',
        'career_fair',
        'cold_outreach',
        'other',
      ]);
    });

    it('contains all required opportunity statuses', () => {
      expect(CAREER_OPPORTUNITY_STATUSES).toEqual(['active', 'archived', 'expired']);
    });

    it('contains all 11 application stages in exact sequence', () => {
      expect(CAREER_APPLICATION_STAGES).toEqual([
        'saved',
        'applied',
        'screening',
        'assessment',
        'interview',
        'offer',
        'accepted',
        'declined',
        'rejected',
        'withdrawn',
        'closed',
      ]);
    });

    it('contains all interview types, statuses, and results', () => {
      expect(CAREER_INTERVIEW_TYPES).toContain('technical_dsa');
      expect(CAREER_INTERVIEW_TYPES).toContain('system_design');
      expect(CAREER_INTERVIEW_STATUSES).toEqual([
        'scheduled',
        'completed',
        'cancelled',
        'rescheduled',
      ]);
      expect(CAREER_INTERVIEW_RESULTS).toEqual([
        'pending',
        'passed',
        'failed',
        'neutral',
      ]);
    });

    it('contains all skill importance levels', () => {
      expect(CAREER_SKILL_IMPORTANCES).toEqual(['required', 'preferred', 'bonus']);
    });
  });

  describe('2. Career Target Schemas', () => {
    it('validates a valid CreateCareerTarget input', () => {
      const input = {
        title: 'Backend Engineering 2026',
        target_role: 'Staff Systems Engineer',
        target_locations: ['San Francisco, CA', 'Remote'],
        employment_type: 'full_time' as const,
        target_date: '2026-12-31',
        min_compensation: 220000,
        currency: 'usd',
        is_primary: true,
        notes: 'Targeting Tier-1 distributed systems companies',
      };

      const parsed = CreateCareerTargetSchema.parse(input);
      expect(parsed.title).toBe('Backend Engineering 2026');
      expect(parsed.target_role).toBe('Staff Systems Engineer');
      expect(parsed.target_locations).toEqual(['San Francisco, CA', 'Remote']);
      expect(parsed.currency).toBe('USD'); // Transformed to uppercase
      expect(parsed.is_primary).toBe(true);
    });

    it('defaults target_locations to empty array and is_primary to false', () => {
      const parsed = CreateCareerTargetSchema.parse({
        title: 'ML Engineer',
        target_role: 'ML Engineer',
      });
      expect(parsed.target_locations).toEqual([]);
      expect(parsed.is_primary).toBe(false);
      expect(parsed.goal_id).toBeUndefined();
    });

    it('rejects empty target title or role', () => {
      expect(() =>
        CreateCareerTargetSchema.parse({
          title: '   ',
          target_role: 'Engineer',
        })
      ).toThrow(/Target title is required/);

      expect(() =>
        CreateCareerTargetSchema.parse({
          title: 'Engineer',
          target_role: '   ',
        })
      ).toThrow(/Target role is required/);
    });

    it('rejects invalid currency codes', () => {
      expect(() =>
        CreateCareerTargetSchema.parse({
          title: 'Target',
          target_role: 'Role',
          currency: 'US', // Less than 3
        })
      ).toThrow(/Currency must be a 3-letter ISO code/);

      expect(() =>
        CreateCareerTargetSchema.parse({
          title: 'Target',
          target_role: 'Role',
          currency: '123', // Digits
        })
      ).toThrow(/Currency must be 3 letters/);
    });

    it('rejects negative compensation', () => {
      expect(() =>
        CreateCareerTargetSchema.parse({
          title: 'Target',
          target_role: 'Role',
          min_compensation: -500,
        })
      ).toThrow(/Minimum compensation must be non-negative/);
    });

    it('validates UpdateCareerTarget partial inputs', () => {
      const parsed = UpdateCareerTargetSchema.parse({
        min_compensation: 250000,
        is_primary: true,
      });
      expect(parsed.min_compensation).toBe(250000);
      expect(parsed.is_primary).toBe(true);
      expect(parsed.title).toBeUndefined();
    });
  });

  describe('3. Career Target Skills Schemas', () => {
    it('validates AddCareerTargetSkill with default importance', () => {
      const parsed = AddCareerTargetSkillSchema.parse({
        skill_id: 'a0000000-0000-0000-0000-000000000001',
      });
      expect(parsed.skill_id).toBe('a0000000-0000-0000-0000-000000000001');
      expect(parsed.importance).toBe('required');
    });

    it('rejects invalid UUID for skill_id', () => {
      expect(() =>
        AddCareerTargetSkillSchema.parse({
          skill_id: 'not-a-uuid',
        })
      ).toThrow(/Invalid skill ID/);
    });
  });

  describe('4. Career Opportunity Schemas', () => {
    it('validates a valid CreateCareerOpportunity input', () => {
      const input = {
        company_name: 'Stripe',
        role_title: 'Infrastructure Engineer',
        employment_type: 'full_time' as const,
        location_type: 'remote' as const,
        location: 'United States',
        source: 'referral' as const,
        job_url: 'https://stripe.com/jobs/12345',
        salary_min: 190000,
        salary_max: 240000,
        salary_currency: 'usd',
        deadline: '2026-11-30T23:59:59.000Z',
        description: 'Distributed payments backend team',
        status: 'active' as const,
      };

      const parsed = CreateCareerOpportunitySchema.parse(input);
      expect(parsed.company_name).toBe('Stripe');
      expect(parsed.role_title).toBe('Infrastructure Engineer');
      expect(parsed.salary_currency).toBe('USD');
      expect(parsed.salary_max).toBe(240000);
    });

    it('rejects salary_max < salary_min', () => {
      expect(() =>
        CreateCareerOpportunitySchema.parse({
          company_name: 'Google',
          role_title: 'SWE',
          salary_min: 200000,
          salary_max: 150000,
        })
      ).toThrow(/salary_max must be greater than or equal to salary_min/);
    });

    it('validates UpdateCareerOpportunity partial input', () => {
      const parsed = UpdateCareerOpportunitySchema.parse({
        salary_max: 260000,
        status: 'archived',
      });
      expect(parsed.salary_max).toBe(260000);
      expect(parsed.status).toBe('archived');
    });

    it('rejects invalid job_url protocol or format', () => {
      expect(() =>
        CreateCareerOpportunitySchema.parse({
          company_name: 'Google',
          role_title: 'SWE',
          job_url: 'ftp://google.com/jobs',
        })
      ).toThrow(/URL must use http:\/\/ or https:\/\/ protocol/);
    });

    it('validates AddCareerOpportunitySkill input', () => {
      const parsed = AddCareerOpportunitySkillSchema.parse({
        skill_id: 'a0000000-0000-0000-0000-000000000002',
        importance: 'preferred',
      });
      expect(parsed.importance).toBe('preferred');
    });
  });

  describe('5. Career Application & History Schemas', () => {
    it('validates a valid CreateCareerApplication input', () => {
      const input = {
        opportunity_id: 'b0000000-0000-0000-0000-000000000001',
        stage: 'applied' as const,
        applied_at: '2026-10-11T12:00:00.000Z',
        resume_file_url: 'https://cdn.avenza.io/resumes/staff-swe.pdf',
        notes: 'Applied with referral from Alice',
      };

      const parsed = CreateCareerApplicationSchema.parse(input);
      expect(parsed.stage).toBe('applied');
      expect(parsed.notes).toBe('Applied with referral from Alice');
    });

    it('defaults CreateCareerApplication stage to saved', () => {
      const parsed = CreateCareerApplicationSchema.parse({
        opportunity_id: 'b0000000-0000-0000-0000-000000000001',
      });
      expect(parsed.stage).toBe('saved');
    });

    it('validates UpdateCareerApplication input', () => {
      const parsed = UpdateCareerApplicationSchema.parse({
        stage: 'interview',
        notes: 'Passed initial screening',
      });
      expect(parsed.stage).toBe('interview');
    });

    it('validates CreateCareerApplicationHistory', () => {
      const parsed = CreateCareerApplicationHistorySchema.parse({
        from_stage: 'screening',
        to_stage: 'interview',
        notes: 'Passed phone screen, invited to virtual onsite',
      });
      expect(parsed.from_stage).toBe('screening');
      expect(parsed.to_stage).toBe('interview');
    });
  });

  describe('6. Career Application Projects Schemas', () => {
    it('validates AttachCareerApplicationProject', () => {
      const parsed = AttachCareerApplicationProjectSchema.parse({
        project_id: 'c0000000-0000-0000-0000-000000000001',
        is_featured: true,
        talking_points: 'Demonstrates distributed consensus and Raft in Go',
      });
      expect(parsed.is_featured).toBe(true);
      expect(parsed.talking_points).toContain('Raft');
    });
  });

  describe('7. Career Interview Schemas', () => {
    it('validates CreateCareerInterview with defaults', () => {
      const parsed = CreateCareerInterviewSchema.parse({});
      expect(parsed.round_number).toBe(1);
      expect(parsed.round_type).toBe('recruiter_screen');
      expect(parsed.duration_minutes).toBe(45);
      expect(parsed.status).toBe('scheduled');
      expect(parsed.result).toBe('pending');
      expect(parsed.interviewer_names).toEqual([]);
    });

    it('rejects round_number <= 0 or duration_minutes <= 0', () => {
      expect(() =>
        CreateCareerInterviewSchema.parse({
          round_number: 0,
        })
      ).toThrow(/Round number must be a positive integer/);

      expect(() =>
        CreateCareerInterviewSchema.parse({
          duration_minutes: -10,
        })
      ).toThrow(/Duration must be a positive integer/);
    });

    it('validates UpdateCareerInterview input', () => {
      const parsed = UpdateCareerInterviewSchema.parse({
        status: 'completed',
        result: 'passed',
        notes: 'Strong system design performance',
      });
      expect(parsed.status).toBe('completed');
      expect(parsed.result).toBe('passed');
    });
  });

  describe('8. Query Schemas & Pagination', () => {
    it('parses CareerTargetQuerySchema with default pagination', () => {
      const parsed = CareerTargetQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.pageSize).toBe(20);
      expect(parsed.sortBy).toBe('created_at');
      expect(parsed.sortOrder).toBe('desc');
    });

    it('parses CareerOpportunityQuerySchema with filters and coercion', () => {
      const parsed = CareerOpportunityQuerySchema.parse({
        status: 'active',
        employment_type: 'full_time',
        page: '2',
        pageSize: '50',
      });
      expect(parsed.status).toBe('active');
      expect(parsed.page).toBe(2);
      expect(parsed.pageSize).toBe(50);
    });

    it('parses CareerApplicationQuerySchema and CareerInterviewQuerySchema', () => {
      const appQuery = CareerApplicationQuerySchema.parse({
        stage: 'interview',
      });
      expect(appQuery.stage).toBe('interview');

      const interviewQuery = CareerInterviewQuerySchema.parse({
        round_type: 'technical_dsa',
        sortBy: 'scheduled_at',
        sortOrder: 'asc',
      });
      expect(interviewQuery.round_type).toBe('technical_dsa');
      expect(interviewQuery.sortBy).toBe('scheduled_at');
      expect(interviewQuery.sortOrder).toBe('asc');
    });
  });
});
