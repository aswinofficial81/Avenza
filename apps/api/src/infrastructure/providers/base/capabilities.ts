import type { ProviderCapability } from '@avenza/shared';

export type { ProviderCapability };

export const ALL_CAPABILITIES: ReadonlyArray<ProviderCapability> = [
  'oauth',
  'repositories',
  'commits',
  'pull_requests',
  'issues',
  'profile',
  'languages',
  'activity',
  'read_only',
] as const;
