import type {
  AnalyticsDsaSummary,
  AnalyticsExecutionSummary,
  AnalyticsFocusSummary,
  AnalyticsGrowthSummary,
  AnalyticsSummaryDto,
  AnalyticsSummaryQueryInput,
} from '@avenza/shared';

export interface AnalyticsDayBucket {
  date: string; // YYYY-MM-DD
  startUtc: string; // ISO timestamp
  endUtc: string; // ISO timestamp
}

export interface AnalyticsDateRange {
  startDate: string;
  endDate: string;
  timeZone: string;
  startUtc: string;
  endUtc: string;
  asOf: string;
  dayBuckets: AnalyticsDayBucket[];
}

export interface IAnalyticsRepository {
  getExecutionSummary(
    userId: string,
    startUtc: string,
    endUtc: string,
    asOf: string
  ): Promise<AnalyticsExecutionSummary>;

  getFocusSummary(
    userId: string,
    startUtc: string,
    endUtc: string,
    dayBuckets: AnalyticsDayBucket[]
  ): Promise<AnalyticsFocusSummary>;

  getDsaSummary(
    userId: string,
    startUtc: string,
    endUtc: string,
    asOf: string
  ): Promise<AnalyticsDsaSummary>;

  getGrowthSummary(
    userId: string,
    startUtc: string,
    endUtc: string
  ): Promise<AnalyticsGrowthSummary>;
}

export interface IAnalyticsService {
  getAnalyticsSummary(
    userId: string,
    query: AnalyticsSummaryQueryInput,
    asOf?: Date
  ): Promise<AnalyticsSummaryDto>;
}
