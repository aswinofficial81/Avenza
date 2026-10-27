import type {
    Database,
    WeeklyReviewMetrics,
    WeeklyReviewSaveInput,
} from '@avenza/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../../db/supabase.client';

type WeeklyReviewRow =
    Database['public']['Tables']['weekly_reviews']['Row'];

export class WeeklyReviewRepository {
    constructor(
        private readonly client: SupabaseClient<Database> =
            getSupabaseAdminClient(),
    ) { }

    async findReview(
        userId: string,
        weekStart: string,
    ): Promise<WeeklyReviewRow | null> {
        const { data, error } = await this.client
            .from('weekly_reviews')
            .select('*')
            .eq('user_id', userId)
            .eq('week_start', weekStart)
            .maybeSingle();

        if (error) {
            throw new Error(`Failed to load weekly review: ${error.message}`);
        }

        return data;
    }

    async saveReview(
        userId: string,
        input: WeeklyReviewSaveInput,
        weekEnd: string,
    ): Promise<WeeklyReviewRow> {
        const { data, error } = await this.client
            .from('weekly_reviews')
            .upsert(
                {
                    user_id: userId,
                    week_start: input.weekStart,
                    week_end: weekEnd,
                    timezone: input.timezone,
                    went_well: input.wentWell,
                    challenges: input.challenges,
                    next_week_priority: input.nextWeekPriority,
                },
                {
                    onConflict: 'user_id,week_start',
                },
            )
            .select('*')
            .single();

        if (error) {
            throw new Error(`Failed to save weekly review: ${error.message}`);
        }

        return data;
    }

    async getMetrics(
        userId: string,
        startUtc: string,
        endUtc: string,
    ): Promise<WeeklyReviewMetrics> {
        const [tasks, dsaAttempts, goals] = await Promise.all([
            this.client
                .from('tasks')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('status', 'completed')
                .gte('completed_at', startUtc)
                .lt('completed_at', endUtc),

            this.client
                .from('dsa_attempts')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('occurred_at', startUtc)
                .lt('occurred_at', endUtc),

            this.client
                .from('goals')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('status', 'completed')
                .gte('completed_at', startUtc)
                .lt('completed_at', endUtc),
        ]);

        if (tasks.error) {
            throw new Error(
                `Failed to count completed tasks: ${tasks.error.message}`,
            );
        }

        if (dsaAttempts.error) {
            throw new Error(
                `Failed to count DSA attempts: ${dsaAttempts.error.message}`,
            );
        }

        if (goals.error) {
            throw new Error(
                `Failed to count completed goals: ${goals.error.message}`,
            );
        }

        let focusMinutes = 0;
        let from = 0;
        const pageSize = 500;

        while (true) {
            const { data, error } = await this.client
                .from('focus_sessions')
                .select('actual_minutes')
                .eq('user_id', userId)
                .eq('status', 'completed')
                .gte('ended_at', startUtc)
                .lt('ended_at', endUtc)
                .range(from, from + pageSize - 1);

            if (error) {
                throw new Error(
                    `Failed to calculate focus time: ${error.message}`,
                );
            }

            for (const session of data ?? []) {
                focusMinutes += session.actual_minutes ?? 0;
            }

            if (!data || data.length < pageSize) {
                break;
            }

            from += pageSize;
        }

        return {
            completedTasks: tasks.count ?? 0,
            focusMinutes,
            dsaAttempts: dsaAttempts.count ?? 0,
            goalsCompleted: goals.count ?? 0,
        };
    }
}