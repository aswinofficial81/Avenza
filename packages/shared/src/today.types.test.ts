import { describe, it, expect } from 'vitest';
import { TodayQuerySchema } from './today.types';

describe('Today Shared Types & Validation', () => {
  it('validates valid TodayQuerySchema with optional date', () => {
    const valid1 = TodayQuerySchema.safeParse({});
    expect(valid1.success).toBe(true);

    const valid2 = TodayQuerySchema.safeParse({ date: '2026-10-03' });
    expect(valid2.success).toBe(true);
    if (valid2.success) {
      expect(valid2.data.date).toBe('2026-10-03');
    }

    const valid3 = TodayQuerySchema.safeParse({
      date: '2026-12-31',
      timezone: 'Asia/Kolkata',
    });
    expect(valid3.success).toBe(true);
  });

  it('rejects malformed date in TodayQuerySchema', () => {
    const invalid1 = TodayQuerySchema.safeParse({ date: 'invalid-date' });
    expect(invalid1.success).toBe(false);

    const invalid2 = TodayQuerySchema.safeParse({ date: '03-10-2026' });
    expect(invalid2.success).toBe(false);

    const invalid3 = TodayQuerySchema.safeParse({ date: '2026/10/03' });
    expect(invalid3.success).toBe(false);
  });
});
