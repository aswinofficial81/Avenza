import { describe, expect, it } from 'vitest';
import {
  CreateSkillInputSchema,
  LinkEvidenceToSkillInputSchema,
  LinkGoalToSkillInputSchema,
  MasteryStateSchema,
  slugifySkillName,
  UpdateSkillInputSchema,
} from './skills.types';

describe('Skills Types and Validation Schemas', () => {
  it('slugifies skill names properly', () => {
    expect(slugifySkillName('React')).toBe('react');
    expect(slugifySkillName('Binary Search')).toBe('binary-search');
    expect(slugifySkillName('  PostgreSQL & SQL Databases!  ')).toBe('postgresql-sql-databases');
    expect(slugifySkillName('C++ Programming')).toBe('c-programming');
  });

  it('validates valid CreateSkillInput', () => {
    const valid = {
      name: 'System Design',
      slug: 'system-design',
      category: 'Software Engineering',
      description: 'Distributed systems, scaling, microservices',
    };
    const parsed = CreateSkillInputSchema.parse(valid);
    expect(parsed.name).toBe('System Design');
    expect(parsed.slug).toBe('system-design');
  });

  it('rejects empty or whitespace-only skill names', () => {
    expect(() => CreateSkillInputSchema.parse({ name: '' })).toThrow();
    expect(() => CreateSkillInputSchema.parse({ name: '   ' })).toThrow();
  });

  it('validates UpdateSkillInput with status archive', () => {
    const valid = {
      status: 'archived' as const,
      description: 'Updated notes',
    };
    const parsed = UpdateSkillInputSchema.parse(valid);
    expect(parsed.status).toBe('archived');
  });

  it('validates MasteryState values', () => {
    expect(MasteryStateSchema.parse('developing')).toBe('developing');
    expect(MasteryStateSchema.parse('proficient')).toBe('proficient');
    expect(MasteryStateSchema.parse('unknown')).toBe('unknown');
    expect(() => MasteryStateSchema.parse('expert_god_mode')).toThrow();
  });

  it('validates LinkEvidenceToSkillInput schema', () => {
    const valid = {
      evidence_id: 'a0000000-0000-0000-0000-000000000001',
      skill_id: 'b0000000-0000-0000-0000-000000000002',
    };
    expect(LinkEvidenceToSkillInputSchema.parse(valid)).toEqual(valid);
    expect(() => LinkEvidenceToSkillInputSchema.parse({ evidence_id: 'invalid-uuid', skill_id: 'b0' })).toThrow();
  });

  it('validates LinkGoalToSkillInput with target mastery state', () => {
    const valid = {
      goal_id: 'a0000000-0000-0000-0000-000000000001',
      skill_id: 'b0000000-0000-0000-0000-000000000002',
      target_mastery_state: 'proficient' as const,
    };
    expect(LinkGoalToSkillInputSchema.parse(valid)).toEqual(valid);
  });
});
