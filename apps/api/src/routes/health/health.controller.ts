import type { HealthResponse } from '@avenza/shared';

export function getHealthStatus(): HealthResponse {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  };
}
