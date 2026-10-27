import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3005),
  HOST: z.string().default('::'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Future configuration placeholders (optional during Phase 1 foundation)
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  FREELLM_API_KEY: z.string().optional(),

  // Phase 14 External Integrations Configuration
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URI: z.string().optional(),
  INTEGRATION_TOKEN_ENCRYPTION_KEY: z.string().optional(),

  // Google Calendar OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  // Phase 17B Deletion Recovery Worker Configuration
  ENABLE_DELETION_RECOVERY_WORKER: z.coerce.boolean().default(false),
  DELETION_RECOVERY_INTERVAL_MS: z.coerce.number().default(60000),
  DELETION_RECOVERY_BATCH_SIZE: z.coerce.number().default(10),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const formattedErrors = result.error.format();
    throw new Error(`Invalid environment variables: ${JSON.stringify(formattedErrors, null, 2)}`);
  }

  return result.data;
}

export const env = loadEnv();
