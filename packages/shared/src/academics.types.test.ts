import { describe, expect, it } from 'vitest';
import {
  CreateAcademicYearSchema,
  CreateAssessmentSchema,
  CreateExamSchema,
  CreateSubjectSchema,
  CreateTermSchema,
  CreateTopicSchema,
} from './academics.types';

describe('Academics Shared Types & Zod Schemas', () => {
  it('validates Academic Year start_date and end_date ordering', () => {
    const valid = CreateAcademicYearSchema.safeParse({
      name: '2026-2027',
      start_date: '2026-08-01',
      end_date: '2027-05-31',
      is_current: true,
    });
    expect(valid.success).toBe(true);

    const invalid = CreateAcademicYearSchema.safeParse({
      name: '2026-2027',
      start_date: '2027-08-01',
      end_date: '2026-05-31',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates Term schema and status defaults', () => {
    const parsed = CreateTermSchema.safeParse({
      name: 'Fall 2026',
      start_date: '2026-08-15',
      end_date: '2026-12-15',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe('planned');
      expect(parsed.data.is_current).toBe(false);
    }
  });

  it('validates Subject schema and credits constraint', () => {
    const valid = CreateSubjectSchema.safeParse({
      term_id: '11111111-1111-4111-a111-111111111111',
      name: 'Computer Networks',
      code: 'CS302',
      credits: 3.5,
    });
    expect(valid.success).toBe(true);

    const negativeCredits = CreateSubjectSchema.safeParse({
      term_id: '11111111-1111-4111-a111-111111111111',
      name: 'Computer Networks',
      credits: -1,
    });
    expect(negativeCredits.success).toBe(false);
  });

  it('validates Topic schema with coverage status and importance', () => {
    const valid = CreateTopicSchema.safeParse({
      name: 'Dijkstra Routing',
      status: 'covered',
      importance: 'critical',
      estimated_minutes: 90,
      resources: [{ title: 'RFC 2328', type: 'notes' }],
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.status).toBe('covered');
      expect(valid.data.importance).toBe('critical');
    }
  });

  it('validates Assessment marks: obtained_marks <= max_marks', () => {
    const valid = CreateAssessmentSchema.safeParse({
      term_id: '11111111-1111-4111-a111-111111111111',
      title: 'Lab 1',
      max_marks: 50,
      obtained_marks: 48,
      weight_percent: 15,
    });
    expect(valid.success).toBe(true);

    const invalid = CreateAssessmentSchema.safeParse({
      term_id: '11111111-1111-4111-a111-111111111111',
      title: 'Lab 1',
      max_marks: 50,
      obtained_marks: 55,
    });
    expect(invalid.success).toBe(false);
  });

  it('validates Exam schema with duration and date', () => {
    const valid = CreateExamSchema.safeParse({
      term_id: '11111111-1111-4111-a111-111111111111',
      title: 'Final Exam',
      exam_type: 'final',
      exam_date: '2026-12-18T10:00:00Z',
      duration_minutes: 180,
    });
    expect(valid.success).toBe(true);

    const nonPositiveDuration = CreateExamSchema.safeParse({
      term_id: '11111111-1111-4111-a111-111111111111',
      title: 'Final Exam',
      exam_date: '2026-12-18T10:00:00Z',
      duration_minutes: 0,
    });
    expect(nonPositiveDuration.success).toBe(false);
  });
});
