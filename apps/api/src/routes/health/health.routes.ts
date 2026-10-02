import type { FastifyPluginAsync } from 'fastify';
import { getHealthStatus } from './health.controller';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    const health = getHealthStatus();
    return reply.status(200).send(health);
  });
};
