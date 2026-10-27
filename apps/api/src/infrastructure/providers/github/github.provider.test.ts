import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GitHubProvider } from './github.provider';
import { GitHubClient } from './github.client';
import { GitHubAuthProvider } from './github.auth';
import { GitHubMapper } from './github.mapper';
import { GitHubSyncProvider } from './github.sync';
import { defaultProviderRegistry, ProviderRegistry } from '../base/provider.registry';
import { ProviderAuthError, ProviderRateLimitError } from '../base/provider.types';

describe('GitHub Provider Abstraction & Adapters', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ProviderRegistry & Bootstrap', () => {
    it('initializes with github provider registered by default', () => {
      const registry = new ProviderRegistry();
      expect(registry.has('github')).toBe(true);
      expect(registry.get('github')).toBeDefined();
      expect(registry.get('github')?.getProviderId()).toBe('github');
      expect(registry.getOrThrow('github')).toBeDefined();
    });

    it('exposes authoritative defaultProviderRegistry with github registered', () => {
      expect(defaultProviderRegistry.has('github')).toBe(true);
      expect(defaultProviderRegistry.get('github')).toBeDefined();
    });

    it('rejects unsupported / un-registered providers safely', () => {
      const registry = new ProviderRegistry();
      const unsupported = 'atcoder' as unknown as import('@avenza/shared').IntegrationProvider;
      expect(registry.has(unsupported)).toBe(false);
      expect(registry.get(unsupported)).toBeUndefined();
      expect(() => registry.getOrThrow(unsupported)).toThrow(
        'Provider "atcoder" is not registered or supported in this phase.'
      );
    });
  });

  describe('Capabilities', () => {
    it('declares exact supported capabilities', () => {
      const provider = new GitHubProvider();
      expect(provider.getProviderId()).toBe('github');
      expect(provider.hasCapability('oauth')).toBe(true);
      expect(provider.hasCapability('repositories')).toBe(true);
      expect(provider.hasCapability('profile')).toBe(true);
      expect(provider.hasCapability('languages')).toBe(true);
      expect(provider.hasCapability('activity')).toBe(true);
      expect(provider.hasCapability('read_only')).toBe(true);
      // It does NOT declare DSA, issues tracking, or write capabilities
      expect(provider.hasCapability('issues')).toBe(false);
      expect(provider.hasCapability('commits')).toBe(false);
    });
  });

  describe('GitHubClient', () => {
    it('fetches authenticated user successfully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          id: 583231,
          login: 'octocat',
          name: 'The Octocat',
          avatar_url: 'https://avatars.githubusercontent.com/u/583231',
          email: 'octocat@github.com',
          public_repos: 8,
          followers: 100,
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const client = new GitHubClient({ baseUrl: 'https://api.github.com' });
      const user = await client.getAuthenticatedUser('mock-token');

      expect(user.id).toBe(583231);
      expect(user.login).toBe('octocat');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
            'User-Agent': 'Avenza-Integration-Hub/1.0',
          }),
        })
      );
    });

    it('throws ProviderRateLimitError when rate limit is exceeded (403 with x-ratelimit-remaining=0)', async () => {
      const headers = new Headers();
      headers.set('x-ratelimit-remaining', '0');
      headers.set('x-ratelimit-reset', '1791130000');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers,
        text: async () => JSON.stringify({ message: 'API rate limit exceeded' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const client = new GitHubClient();
      await expect(client.getAuthenticatedUser('mock-token')).rejects.toThrow(ProviderRateLimitError);
    });

    it('throws ProviderAuthError on 401 Unauthorized', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers(),
        text: async () => 'Bad credentials',
      });
      vi.stubGlobal('fetch', mockFetch);

      const client = new GitHubClient();
      await expect(client.getAuthenticatedUser('invalid-token')).rejects.toThrow(ProviderAuthError);
    });
  });

  describe('GitHubAuthProvider', () => {
    it('throws ProviderAuthError when OAuth client ID is not configured', () => {
      const auth = new GitHubAuthProvider({ clientId: '' });
      expect(() => auth.createAuthorizationUrl('csrf_token_123')).toThrow(
        'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID in the backend environment.'
      );
    });

    it('throws ProviderAuthError when exchanging code without configured credentials', async () => {
      const auth = new GitHubAuthProvider({ clientId: '', clientSecret: '' });
      await expect(auth.exchangeCodeForTokens('code_123')).rejects.toThrow(
        'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the backend environment.'
      );
    });

    it('creates authorization URL with strict parameters', () => {
      const auth = new GitHubAuthProvider({
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3005/api/v1/integrations/github/callback',
      });

      const url = auth.createAuthorizationUrl('csrf_token_xyz_12345');
      const parsed = new URL(url);

      expect(parsed.origin).toBe('https://github.com');
      expect(parsed.pathname).toBe('/login/oauth/authorize');
      expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
      expect(parsed.searchParams.get('state')).toBe('csrf_token_xyz_12345');
      expect(parsed.searchParams.get('scope')).toBe('read:user,repo');
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3005/api/v1/integrations/github/callback'
      );
    });

    it('exchanges code for tokens successfully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'gho_secret_access_token_123',
          token_type: 'bearer',
          scope: 'read:user,repo',
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const auth = new GitHubAuthProvider({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      });

      const tokens = await auth.exchangeCodeForTokens('auth_code_999');
      expect(tokens.accessToken).toBe('gho_secret_access_token_123');
      expect(tokens.scope).toBe('read:user,repo');
    });

    it('fetches explicit identity with stable external account ID', async () => {
      const mockClient = {
        getAuthenticatedUser: vi.fn().mockResolvedValue({
          id: 998877,
          login: 'avenza-dev',
          name: 'Avenza Developer',
          avatar_url: 'https://avatars.example.com/dev',
          email: 'dev@avenza.com',
          public_repos: 12,
          followers: 5,
        }),
      } as unknown as GitHubClient;

      const auth = new GitHubAuthProvider({}, mockClient);
      const identity = await auth.fetchIdentity('mock-token');

      // Crucial: Must be based on GitHub's stable numeric account ID, not mutable username
      expect(identity.externalAccountId).toBe('998877');
      expect(identity.username).toBe('avenza-dev');
      expect(identity.displayName).toBe('Avenza Developer');
      expect(identity.email).toBe('dev@avenza.com');
    });
  });

  describe('GitHubMapper', () => {
    it('normalizes repository data without loss of essential fields', () => {
      const rawRepo = {
        id: 1296269,
        name: 'Hello-World',
        full_name: 'octocat/Hello-World',
        owner: { id: 583231, login: 'octocat' },
        private: false,
        html_url: 'https://github.com/octocat/Hello-World',
        description: 'This your first repo!',
        default_branch: 'master',
        language: 'TypeScript',
        stargazers_count: 80,
        forks_count: 9,
        open_issues_count: 0,
        pushed_at: '2026-10-01T12:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-10-01T12:00:00Z',
      };

      const normalized = GitHubMapper.toNormalizedRepository(rawRepo, { TypeScript: 5000, HTML: 200 });
      expect(normalized.externalId).toBe('1296269');
      expect(normalized.name).toBe('Hello-World');
      expect(normalized.fullName).toBe('octocat/Hello-World');
      expect(normalized.primaryLanguage).toBe('TypeScript');
      expect(normalized.languages).toEqual({ TypeScript: 5000, HTML: 200 });
      expect(normalized.isPrivate).toBe(false);
    });

    it('normalizes PushEvent activity correctly', () => {
      const rawEvent = {
        id: 'evt-101',
        type: 'PushEvent',
        actor: { id: 583231, login: 'octocat' },
        repo: { id: 1296269, name: 'octocat/Hello-World', url: '' },
        payload: {
          commits: [{ message: 'feat: add external integration adapter' }],
        },
        public: true,
        created_at: '2026-10-04T12:30:00Z',
      };

      const activity = GitHubMapper.toNormalizedActivity(rawEvent);
      expect(activity.externalId).toBe('evt-101');
      expect(activity.activityType).toBe('push');
      expect(activity.title).toContain('Pushed 1 commit to octocat/Hello-World');
      expect(activity.summary).toBe('feat: add external integration adapter');
    });
  });

  describe('GitHubSyncProvider', () => {
    it('executes sync and returns normalized repos and activities', async () => {
      const mockClient = {
        getAuthenticatedUser: vi.fn().mockResolvedValue({ id: 123, login: 'octocat' }),
        getUserRepositories: vi.fn().mockResolvedValue([
          {
            id: 111,
            name: 'repo-one',
            full_name: 'octocat/repo-one',
            owner: { id: 123, login: 'octocat' },
            private: false,
            html_url: 'https://github.com/octocat/repo-one',
            description: null,
            default_branch: 'main',
            language: 'Rust',
            stargazers_count: 5,
            forks_count: 0,
            open_issues_count: 1,
            pushed_at: '2026-10-04T10:00:00Z',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-10-04T10:00:00Z',
          },
        ]),
        getRepoLanguages: vi.fn().mockResolvedValue({ Rust: 1000 }),
        getUserPublicEvents: vi.fn().mockResolvedValue([
          {
            id: 'ev-1',
            type: 'PushEvent',
            actor: { id: 123, login: 'octocat' },
            repo: { id: 111, name: 'octocat/repo-one', url: '' },
            payload: { commits: [{ message: 'Initial commit' }] },
            public: true,
            created_at: '2026-10-04T10:05:00Z',
          },
        ]),
      } as unknown as GitHubClient;

      const sync = new GitHubSyncProvider(mockClient);
      const result = await sync.sync({
        userId: 'usr-1',
        connectionId: 'conn-1',
        accessToken: 'mock-token',
      });

      expect(result.success).toBe(true);
      expect(result.repositories).toHaveLength(1);
      expect(result.repositories![0]!.name).toBe('repo-one');
      expect(result.activities).toHaveLength(1);
      expect(result.activities![0]!.activityType).toBe('push');
      expect(result.nextCursor).toBe('2026-10-04T10:05:00Z');
    });

    it('gracefully handles rate limits during sync without crashing', async () => {
      const mockClient = {
        getAuthenticatedUser: vi.fn().mockRejectedValue(new ProviderRateLimitError('Rate limited', 1791140000)),
      } as unknown as GitHubClient;

      const sync = new GitHubSyncProvider(mockClient);
      const result = await sync.sync({
        userId: 'usr-1',
        connectionId: 'conn-1',
        accessToken: 'mock-token',
      });

      expect(result.success).toBe(false);
      expect(result.isRateLimited).toBe(true);
      expect(result.rateLimitReset).toBe(1791140000);
      expect(result.errorCode).toBe('RATE_LIMITED');
    });
  });

  describe('GitHubAuthProvider & Token Revocation', () => {
    it('creates authorization URL with correct parameters', () => {
      const auth = new GitHubAuthProvider({
        clientId: 'gh-client-123',
        clientSecret: 'gh-secret-456',
        redirectUri: 'http://localhost:3000/callback',
      });
      const url = auth.createAuthorizationUrl('random-state-123');
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=gh-client-123');
      expect(url).toContain('state=random-state-123');
    });

    it('revokes OAuth grant successfully (HTTP 204)', async () => {
      const globalFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      vi.stubGlobal('fetch', globalFetch);

      const auth = new GitHubAuthProvider({
        clientId: 'gh-client-123',
        clientSecret: 'gh-secret-456',
      });

      await expect(auth.revokeToken('test-access-token')).resolves.toBeUndefined();
      expect(globalFetch).toHaveBeenCalledTimes(1);
      const callArgs = globalFetch.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string>; body: string }];
      expect(callArgs).toBeDefined();
      const [url, opts] = callArgs;
      expect(url).toBe('https://api.github.com/applications/gh-client-123/grant');
      expect(opts.method).toBe('DELETE');
      expect(opts.headers.Authorization).toContain('Basic ');
      expect(JSON.parse(opts.body)).toEqual({ access_token: 'test-access-token' });
    });

    it('handles already-revoked or expired grant (HTTP 404) gracefully without error', async () => {
      const globalFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });
      vi.stubGlobal('fetch', globalFetch);

      const auth = new GitHubAuthProvider({
        clientId: 'gh-client-123',
        clientSecret: 'gh-secret-456',
      });

      await expect(auth.revokeToken('already-revoked-token')).resolves.toBeUndefined();
    });

    it('throws ProviderAuthError when GitHub returns an unexpected failure (e.g. HTTP 401)', async () => {
      const globalFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Bad credentials'),
      });
      vi.stubGlobal('fetch', globalFetch);

      const auth = new GitHubAuthProvider({
        clientId: 'gh-client-123',
        clientSecret: 'bad-secret',
      });

      await expect(auth.revokeToken('test-access-token')).rejects.toThrow(ProviderAuthError);
    });

    it('returns without error if OAuth client credentials are not configured', async () => {
      const globalFetch = vi.fn();
      vi.stubGlobal('fetch', globalFetch);

      const auth = new GitHubAuthProvider({
        clientId: '',
        clientSecret: '',
      });

      await expect(auth.revokeToken('any-token')).resolves.toBeUndefined();
      expect(globalFetch).not.toHaveBeenCalled();
    });
  });
});
