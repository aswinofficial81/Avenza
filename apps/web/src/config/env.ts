export const env = {
  CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '',
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
} as const;
