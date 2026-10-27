import { defaultProviderRegistry } from './base/provider.registry';
import { GitHubProvider } from './github/github.provider';

// Register GitHub as the Phase 14 reference provider
defaultProviderRegistry.register(new GitHubProvider());

export * from './base/capabilities';
export * from './base/provider.types';
export * from './base/auth.interface';
export * from './base/sync.interface';
export * from './base/provider.interface';
export * from './base/provider.registry';
export * from './github/github.types';
export * from './github/github.client';
export * from './github/github.auth';
export * from './github/github.mapper';
export * from './github/github.sync';
export * from './github/github.provider';
