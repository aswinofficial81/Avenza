import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../auth/auth.middleware';
import { defaultWeeklyReviewController } from './weekly-review.controller';

export const weeklyReviewRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get(
        '/api/v1/weekly-review',
        { preHandler: [requireAuth] },
        (request, reply) =>
            defaultWeeklyReviewController.getSummary(request, reply),
    );

    fastify.put(
        '/api/v1/weekly-review',
        { preHandler: [requireAuth] },
        (request, reply) =>
            defaultWeeklyReviewController.saveReview(request, reply),
    );
};