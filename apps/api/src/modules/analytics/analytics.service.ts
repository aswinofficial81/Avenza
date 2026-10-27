import type {
  AnalyticsSummaryDto,
  AnalyticsSummaryQueryInput,
} from '@avenza/shared';
import type { IPreferencesRepository } from '../preferences/preferences.repository';
import { SupabasePreferencesRepository } from '../preferences/preferences.repository';
import { resolveAnalyticsDateRange } from './analytics.date-utils';
import { SupabaseAnalyticsRepository } from './analytics.repository';
import type {
  IAnalyticsRepository,
  IAnalyticsService,
} from './analytics.types';
import { isValidTimezone } from '../today/today.date-utils';

export class AnalyticsService implements IAnalyticsService {
  constructor(
    private readonly analyticsRepo: IAnalyticsRepository = new SupabaseAnalyticsRepository(),
    private readonly preferencesRepo: IPreferencesRepository = new SupabasePreferencesRepository()
  ) { }

  async getAnalyticsSummary(
    userId: string,
    query: AnalyticsSummaryQueryInput,
    asOf: Date = new Date()
  ): Promise<AnalyticsSummaryDto> {
    // 1. Resolve user timezone
    let resolvedTimezone: string | null = null;
    if (query.timezone && isValidTimezone(query.timezone)) {
      resolvedTimezone = query.timezone;
    } else {
      const prefs = await this.preferencesRepo.findByUserId(userId);
      if (prefs?.timezone && isValidTimezone(prefs.timezone)) {
        resolvedTimezone = prefs.timezone;
      }
    }

    // 2. Resolve date range boundaries and daily buckets
    const dateRange = resolveAnalyticsDateRange(
      query.startDate,
      query.endDate,
      resolvedTimezone,
      asOf
    );

    // 3. Perform server-side aggregations across execution, focus, DSA, and growth
    const [execution, focus, dsa, growth] = await Promise.all([
      this.analyticsRepo.getExecutionSummary(
        userId,
        dateRange.startUtc,
        dateRange.endUtc,
        dateRange.asOf
      ),
      this.analyticsRepo.getFocusSummary(
        userId,
        dateRange.startUtc,
        dateRange.endUtc,
        dateRange.dayBuckets
      ),
      this.analyticsRepo.getDsaSummary(
        userId,
        dateRange.startUtc,
        dateRange.endUtc,
        dateRange.asOf
      ),
      this.analyticsRepo.getGrowthSummary(
        userId,
        dateRange.startUtc,
        dateRange.endUtc
      ),
    ]);

    return {
      period: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        timezone: dateRange.timeZone,
        startUtc: dateRange.startUtc,
        endUtc: dateRange.endUtc,
        asOf: dateRange.asOf,
      },
      execution,
      focus,
      dsa,
      growth,
    };
  }
}

export const defaultAnalyticsService = new AnalyticsService();
