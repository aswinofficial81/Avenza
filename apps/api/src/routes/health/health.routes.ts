import type { FastifyPluginAsync } from 'fastify';
import { getHealthStatus } from './health.controller';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  const handler = async (_request: unknown, reply: { status: (c: number) => { send: (b: unknown) => unknown } }) => {
    const health = getHealthStatus();
    return reply.status(200).send(health);
  };

  fastify.get('/health', handler);
  fastify.get('/api/health', handler);
};
