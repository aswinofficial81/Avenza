import fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { weeklyReviewRoutes } from './weekly-review.routes';

describe('Weekly Review API', () => {
    const app = fastify();

    beforeAll(async () => {
        app.register(weeklyReviewRoutes);
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('rejects unauthenticated requests to read a weekly review', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/weekly-review?weekStart=2026-10-26&timezone=Asia%2FKolkata',
        });

        expect(response.statusCode).toBe(401);
        expect(response.json().success).toBe(false);
        expect(response.json().error.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated requests to save a weekly review', async () => {
        const response = await app.inject({
            method: 'PUT',
            url: '/api/v1/weekly-review',
            payload: {
                weekStart: '2026-10-26',
                timezone: 'Asia/Kolkata',
                wentWell: 'Finished the main tasks',
                challenges: 'Time management',
                nextWeekPriority: 'Improve consistency',
            },
        });

        expect(response.statusCode).toBe(401);
        expect(response.json().success).toBe(false);
        expect(response.json().error.code).toBe('UNAUTHORIZED');
    });
});