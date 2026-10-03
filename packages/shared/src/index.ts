import { z } from 'zod';

export const APP_NAME = 'Avenza' as const;
export const APP_TAGLINE = 'Plan. Execute. Evolve.' as const;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number(),
  timestamp: z.string(),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Database Types & Schemas
export * from './database.types';

// Auth Types
export * from './auth.types';

// Goals & Milestones Types & Schemas
export * from './goals.types';

// Tasks & Task Dependencies Types & Schemas
export * from './tasks.types';

// Today Execution Types & Schemas
export * from './today.types';

// Focus Sessions Types & Schemas
export * from './focus.types';

// Evidence Domain Types & Schemas
export * from './evidence.types';

// Intelligence Domain Types & Schemas
export * from './intelligence.types';

// Academics Domain Types & Schemas
export * from './academics.types';

// Skills & Mastery Domain Types & Schemas
export * from './skills.types';

