import type {
  WeeklyReviewQueryInput,
  WeeklyReviewSaveInput,
  WeeklyReviewSummary,
  WeeklyReviewRecord,
} from '@avenza/shared';
import { resolveAnalyticsDateRange } from '../analytics/analytics.date-utils';
import { isValidTimezone } from '../today/today.date-utils';
import { WeeklyReviewRepository } from './weekly-review.repository';

type ReviewRow = Awaited<
  ReturnType<WeeklyReviewRepository['findReview']>
>;

type SavedReviewRow = NonNullable<ReviewRow>;

export class WeeklyReviewService {
  constructor(
    private readonly repository = new WeeklyReviewRepository(),
  ) { }

  private resolvePeriod(weekStart: string, timezone: string, asOf: Date) {
    if (!isValidTimezone(timezone)) {
      throw new Error('Invalid IANA timezone');
    }

    const [year, month, day] = weekStart.split('-').map(Number);
    const start = new Date(Date.UTC(year!, month! - 1, day!));

    if (start.getUTCDay() !== 1) {
      throw new Error('Week start must be a Monday');
    }

    const end = new Date(
      Date.UTC(year!, month! - 1, day! + 6),
    );
    const weekEnd = end.toISOString().slice(0, 10);

    const range = resolveAnalyticsDateRange(
      weekStart,
      weekEnd,
      timezone,
      asOf,
    );

    return {
      weekStart,
      weekEnd,
      timezone,
      startUtc: range.startUtc,
      endUtc: range.endUtc,
    };
  }

  private toRecord(row: SavedReviewRow): WeeklyReviewRecord {
    return {
      id: row.id,
      weekStart: row.week_start,
      weekEnd: row.week_end,
      timezone: row.timezone,
      wentWell: row.went_well,
      challenges: row.challenges,
      nextWeekPriority: row.next_week_priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getSummary(
    userId: string,
    input: WeeklyReviewQueryInput,
    asOf: Date = new Date(),
  ): Promise<WeeklyReviewSummary> {
    const period = this.resolvePeriod(
      input.weekStart,
      input.timezone,
      asOf,
    );

    const [review, metrics] = await Promise.all([
      this.repository.findReview(userId, period.weekStart),
      this.repository.getMetrics(
        userId,
        period.startUtc,
        period.endUtc,
      ),
    ]);

    return {
      weekStart: period.weekStart,
      weekEnd: period.weekEnd,
      timezone: period.timezone,
      metrics,
      review: review ? this.toRecord(review) : null,
    };
  }

  async saveReview(
    userId: string,
    input: WeeklyReviewSaveInput,
    asOf: Date = new Date(),
  ): Promise<WeeklyReviewSummary> {
    const period = this.resolvePeriod(
      input.weekStart,
      input.timezone,
      asOf,
    );

    const [review, metrics] = await Promise.all([
      this.repository.saveReview(
        userId,
        input,
        period.weekEnd,
      ),
      this.repository.getMetrics(
        userId,
        period.startUtc,
        period.endUtc,
      ),
    ]);

    return {
      weekStart: period.weekStart,
      weekEnd: period.weekEnd,
      timezone: period.timezone,
      metrics,
      review: this.toRecord(review),
    };
  }
}

export const defaultWeeklyReviewService = new WeeklyReviewService();