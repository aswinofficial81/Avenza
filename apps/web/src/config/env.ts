function getValidatedApiBaseUrl(): string {
  const url = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3005';
  if (!url || typeof url !== 'string') {
    throw new Error('VITE_API_BASE_URL is missing or invalid.');
  }
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith('http')) {
      throw new Error('VITE_API_BASE_URL is missing or invalid.');
    }
    return url.replace(/\/+$/, '');
  } catch {
    throw new Error('VITE_API_BASE_URL is missing or invalid.');
  }
}

export const env = {
  CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '',
  API_BASE_URL: getValidatedApiBaseUrl(),
} as const;
