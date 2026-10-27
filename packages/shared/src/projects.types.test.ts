import { describe, expect, it } from 'vitest';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  CreateProjectMilestoneSchema,
  UpdateProjectMilestoneSchema,
  LinkRepositorySchema,
  AttachProjectGoalSchema,
  AttachProjectSkillSchema,
  ProjectQuerySchema,
  PROJECT_STATUSES,
  PROJECT_PRIORITIES,
  PROJECT_TYPES,
  PROJECT_MILESTONE_STATUSES,
  PROJECT_SKILL_ROLES,
} from './projects.types';

describe('Projects Domain Schemas & Contracts', () => {
  describe('CreateProjectSchema', () => {
    it('validates a complete valid project input', () => {
      const input = {
        title: 'Avenza Core Engine',
        slug: 'avenza-core-engine',
        description: 'Autonomous software engineering platform',
        status: 'in_progress',
        priority: 'high',
        project_type: 'software',
        repository_id: '11111111-1111-4111-a111-111111111111',
        start_date: '2026-10-01T00:00:00.000Z',
        target_date: '2026-12-31T23:59:59.000Z',
        live_url: 'https://avenza.dev/docs',
        architecture_notes: 'Microservices with event-driven message bus',
        tech_stack: ['TypeScript', 'Node.js', 'PostgreSQL'],
        metadata: { license: 'MIT' },
      };

      const parsed = CreateProjectSchema.parse(input);
      expect(parsed.title).toBe('Avenza Core Engine');
      expect(parsed.slug).toBe('avenza-core-engine');
      expect(parsed.status).toBe('in_progress');
      expect(parsed.priority).toBe('high');
      expect(parsed.project_type).toBe('software');
      expect(parsed.live_url).toBe('https://avenza.dev/docs');
    });

    it('applies default values for optional enum fields', () => {
      const parsed = CreateProjectSchema.parse({
        title: 'Minimal Project',
        slug: 'minimal-project',
      });

      expect(parsed.status).toBe('backlog');
      expect(parsed.priority).toBe('medium');
      expect(parsed.project_type).toBe('software');
      expect(parsed.tech_stack).toEqual([]);
      expect(parsed.metadata).toEqual({});
    });

    it('rejects empty title', () => {
      expect(() =>
        CreateProjectSchema.parse({
          title: '   ',
          slug: 'empty-title',
        })
      ).toThrow(/Project title is required/);
    });

    it('rejects title exceeding 255 characters', () => {
      expect(() =>
        CreateProjectSchema.parse({
          title: 'a'.repeat(256),
          slug: 'long-title',
        })
      ).toThrow(/Project title must be at most 255 characters/);
    });

    it('validates valid kebab-case slugs', () => {
      const validSlugs = ['avenza', 'project-1', 'deep-learning-nlp-v2', 'test-123-abc'];
      for (const slug of validSlugs) {
        expect(() =>
          CreateProjectSchema.parse({
            title: 'Valid Slug',
            slug,
          })
        ).not.toThrow();
      }
    });

    it('rejects invalid slugs (uppercase, spaces, special chars, leading/trailing hyphens)', () => {
      const invalidSlugs = [
        'InvalidSlug',
        'has spaces',
        'snake_case_not_allowed',
        '-leading-hyphen',
        'trailing-hyphen-',
        'double--hyphen',
        'special$char',
      ];
      for (const slug of invalidSlugs) {
        expect(() =>
          CreateProjectSchema.parse({
            title: 'Invalid Slug Project',
            slug,
          })
        ).toThrow();
      }
    });

    it('rejects invalid status', () => {
      expect(() =>
        CreateProjectSchema.parse({
          title: 'Test',
          slug: 'test-slug',
          status: 'invalid_status',
        })
      ).toThrow();
    });

    it('rejects invalid priority', () => {
      expect(() =>
        CreateProjectSchema.parse({
          title: 'Test',
          slug: 'test-slug',
          priority: 'urgent',
        })
      ).toThrow();
    });

    it('rejects invalid project_type', () => {
      expect(() =>
        CreateProjectSchema.parse({
          title: 'Test',
          slug: 'test-slug',
          project_type: 'unknown_type',
        })
      ).toThrow();
    });

    it('rejects live_url that is not http or https', () => {
      const invalidUrls = [
        'ftp://example.com/repo',
        'javascript:alert(1)',
        'data:text/plain;base64,SGVsbG8=',
        'file:///path/to/file',
        'not-a-url',
      ];
      for (const live_url of invalidUrls) {
        expect(() =>
          CreateProjectSchema.parse({
            title: 'Test',
            slug: 'test-slug',
            live_url,
          })
        ).toThrow();
      }
    });

    it('allows valid http and https live_url', () => {
      const validUrls = [
        'https://avenza.dev',
        'http://localhost:3000',
        'https://sub.domain.org/path?query=1#hash',
      ];
      for (const live_url of validUrls) {
        const parsed = CreateProjectSchema.parse({
          title: 'Test',
          slug: 'test-slug',
          live_url,
        });
        expect(parsed.live_url).toBe(live_url);
      }
    });

    it('rejects target_date before start_date', () => {
      expect(() =>
        CreateProjectSchema.parse({
          title: 'Date Order Test',
          slug: 'date-order-test',
          start_date: '2026-10-15T00:00:00.000Z',
          target_date: '2026-10-01T00:00:00.000Z',
        })
      ).toThrow(/Target date must be on or after start date/);
    });

    it('accepts equal start_date and target_date', () => {
      expect(() =>
        CreateProjectSchema.parse({
          title: 'Same Day Project',
          slug: 'same-day-project',
          start_date: '2026-10-01T00:00:00.000Z',
          target_date: '2026-10-01T00:00:00.000Z',
        })
      ).not.toThrow();
    });
  });

  describe('UpdateProjectSchema', () => {
    it('accepts partial updates', () => {
      const parsed = UpdateProjectSchema.parse({
        status: 'completed',
        completed_at: '2026-10-06T12:00:00.000Z',
      });
      expect(parsed.status).toBe('completed');
      expect(parsed.completed_at).toBe('2026-10-06T12:00:00.000Z');
    });

    it('rejects invalid slug on update', () => {
      expect(() =>
        UpdateProjectSchema.parse({
          slug: 'Invalid Slug!',
        })
      ).toThrow();
    });

    it('rejects target_date before start_date on update', () => {
      expect(() =>
        UpdateProjectSchema.parse({
          start_date: '2026-10-20T00:00:00.000Z',
          target_date: '2026-10-10T00:00:00.000Z',
        })
      ).toThrow(/Target date must be on or after start date/);
    });
  });

  describe('CreateProjectMilestoneSchema & UpdateProjectMilestoneSchema', () => {
    it('validates a valid project milestone', () => {
      const parsed = CreateProjectMilestoneSchema.parse({
        title: 'Phase 1 MVP',
        description: 'Complete database and API contracts',
        status: 'pending',
        order_index: 1,
        target_date: '2026-10-15T00:00:00.000Z',
      });
      expect(parsed.title).toBe('Phase 1 MVP');
      expect(parsed.order_index).toBe(1);
      expect(parsed.status).toBe('pending');
    });

    it('rejects empty milestone title', () => {
      expect(() =>
        CreateProjectMilestoneSchema.parse({
          title: '   ',
        })
      ).toThrow(/Milestone title is required/);
    });

    it('validates update milestone with status change', () => {
      const parsed = UpdateProjectMilestoneSchema.parse({
        status: 'completed',
        completed_at: '2026-10-06T10:00:00.000Z',
      });
      expect(parsed.status).toBe('completed');
    });
  });

  describe('Relationship Schemas', () => {
    it('validates LinkRepositorySchema', () => {
      const parsed = LinkRepositorySchema.parse({
        repository_id: '11111111-1111-4111-a111-111111111111',
      });
      expect(parsed.repository_id).toBe('11111111-1111-4111-a111-111111111111');

      const nullParsed = LinkRepositorySchema.parse({
        repository_id: null,
      });
      expect(nullParsed.repository_id).toBeNull();
    });

    it('validates AttachProjectGoalSchema', () => {
      const parsed = AttachProjectGoalSchema.parse({
        goal_id: '22222222-2222-4222-a222-222222222222',
        is_primary: true,
      });
      expect(parsed.is_primary).toBe(true);
    });

    it('validates AttachProjectSkillSchema', () => {
      const parsed = AttachProjectSkillSchema.parse({
        skill_id: '33333333-3333-4333-a333-333333333333',
        role: 'supporting',
      });
      expect(parsed.role).toBe('supporting');
    });
  });

  describe('ProjectQuerySchema', () => {
    it('coerces and validates query parameters', () => {
      const parsed = ProjectQuerySchema.parse({
        page: '3',
        pageSize: '15',
        sortBy: 'title',
        sortOrder: 'asc',
        status: 'in_progress',
        priority: 'high',
        project_type: 'software',
        search: 'engine',
      });

      expect(parsed.page).toBe(3);
      expect(parsed.pageSize).toBe(15);
      expect(parsed.sortBy).toBe('title');
      expect(parsed.sortOrder).toBe('asc');
      expect(parsed.status).toBe('in_progress');
      expect(parsed.priority).toBe('high');
      expect(parsed.search).toBe('engine');
    });
  });

  describe('Enums completeness', () => {
    it('has all expected project statuses', () => {
      expect(PROJECT_STATUSES).toEqual([
        'backlog',
        'planning',
        'in_progress',
        'paused',
        'completed',
        'archived',
      ]);
    });

    it('has all expected project priorities', () => {
      expect(PROJECT_PRIORITIES).toEqual(['low', 'medium', 'high', 'critical']);
    });

    it('has all expected project types', () => {
      expect(PROJECT_TYPES).toEqual([
        'software',
        'research',
        'open_source',
        'hardware',
        'content',
        'custom',
      ]);
    });

    it('has all expected milestone statuses and skill roles', () => {
      expect(PROJECT_MILESTONE_STATUSES).toEqual(['pending', 'in_progress', 'completed', 'skipped']);
      expect(PROJECT_SKILL_ROLES).toEqual(['primary', 'supporting']);
    });
  });
});
