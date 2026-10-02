import type { TodayQueryInput, TodayResponse } from '@avenza/shared';

export interface ITodayService {
  getToday(userId: string, query?: TodayQueryInput): Promise<TodayResponse>;
}
