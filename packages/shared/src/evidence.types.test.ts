import { describe, it, expect } from 'vitest';
import {
  CreateEvidenceInputSchema,
  EvidenceQuerySchema,
  EvidenceTypeSchema,
  EvidenceVerificationStatusSchema,
} from './evidence.types';

describe('Evidence Types & Validation Schemas', () => {
  it('validates supported evidence types', () => {
    expect(EvidenceTypeSchema.safeParse('manual').success).toBe(true);
    expect(EvidenceTypeSchema.safeParse('focus_session').success).toBe(true);
    expect(EvidenceTypeSchema.safeParse('task_completion').success).toBe(true);
    expect(EvidenceTypeSchema.safeParse('invalid_type').success).toBe(false);
  });

  it('validates verification statuses', () => {
    expect(EvidenceVerificationStatusSchema.safeParse('unverified').success).toBe(true);
    expect(EvidenceVerificationStatusSchema.safeParse('verified').success).toBe(true);
    expect(EvidenceVerificationStatusSchema.safeParse('rejected').success).toBe(true);
    expect(EvidenceVerificationStatusSchema.safeParse('pending').success).toBe(false);
  });

  it('validates valid CreateEvidenceInput', () => {
    const valid = {
      title: 'Completed SQL practice problems',
      evidence_type: 'manual',
      description: 'Solved 10 window function questions on LeetCode',
      external_url: 'https://leetcode.com',
      notes: 'Reviewed lead() and lag() functions',
      links: [
        {
          entity_type: 'task',
          entity_id: '11111111-1111-4111-a111-111111111111',
        },
      ],
    };
    const res = CreateEvidenceInputSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it('rejects invalid title or empty title in CreateEvidenceInput', () => {
    const emptyTitle = {
      title: '',
      evidence_type: 'manual',
    };
    expect(CreateEvidenceInputSchema.safeParse(emptyTitle).success).toBe(false);
  });

  it('coerces and validates EvidenceQuerySchema', () => {
    const parsed = EvidenceQuerySchema.parse({
      page: '2',
      limit: '15',
      verification_status: 'verified',
    });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(15);
    expect(parsed.verification_status).toBe('verified');
  });
});
