import type { FastifyReply, FastifyRequest } from 'fastify';
import {
    WeeklyReviewQuerySchema,
    WeeklyReviewSaveSchema,
} from '@avenza/shared';
import { isValidTimezone } from '../today/today.date-utils';
import { defaultWeeklyReviewService } from './weekly-review.service';
import type { WeeklyReviewService } from './weekly-review.service';

export class WeeklyReviewController {
    constructor(
        private readonly service: WeeklyReviewService =
            defaultWeeklyReviewService,
    ) { }

    async getSummary(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        const userId = request.profile?.id;
        if (!userId) {
            reply.status(401).send({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
            });
            return;
        }

        const parsed = WeeklyReviewQuerySchema.safeParse(request.query);
        if (!parsed.success || !isValidTimezone(parsed.data?.timezone ?? '')) {
            reply.status(400).send({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid week start or timezone',
                    details: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
                },
            });
            return;
        }

        try {
            reply.status(200).send({
                success: true,
                data: await this.service.getSummary(userId, parsed.data),
            });
        } catch (error) {
            request.log.error(error);
            reply.status(500).send({
                success: false,
                error: {
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to retrieve weekly review',
                },
            });
        }
    }

    async saveReview(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        const userId = request.profile?.id;
        if (!userId) {
            reply.status(401).send({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
            });
            return;
        }

        const parsed = WeeklyReviewSaveSchema.safeParse(request.body);
        if (!parsed.success || !isValidTimezone(parsed.data?.timezone ?? '')) {
            reply.status(400).send({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid weekly review input or timezone',
                    details: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
                },
            });
            return;
        }

        try {
            reply.status(200).send({
                success: true,
                data: await this.service.saveReview(userId, parsed.data),
            });
        } catch (error) {
            request.log.error(error);
            reply.status(500).send({
                success: false,
                error: {
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to save weekly review',
                },
            });
        }
    }
}

export const defaultWeeklyReviewController =
    new WeeklyReviewController();