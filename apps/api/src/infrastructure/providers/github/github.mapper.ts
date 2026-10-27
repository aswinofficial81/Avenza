import type { NormalizedActivityData, NormalizedRepositoryData } from '../base/provider.types';
import type { GitHubEventResponse, GitHubRepoResponse } from './github.types';

export class GitHubMapper {
  static toNormalizedRepository(
    repo: GitHubRepoResponse,
    languages: Record<string, number> = {}
  ): NormalizedRepositoryData {
    return {
      externalId: String(repo.id),
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      isPrivate: repo.private,
      htmlUrl: repo.html_url,
      description: repo.description,
      defaultBranch: repo.default_branch || 'main',
      primaryLanguage: repo.language,
      languages,
      starsCount: repo.stargazers_count || 0,
      forksCount: repo.forks_count || 0,
      openIssuesCount: repo.open_issues_count || 0,
      pushedAt: repo.pushed_at,
    };
  }

  static toNormalizedActivity(event: GitHubEventResponse): NormalizedActivityData {
    const eventType = event.type.replace(/Event$/, '').toLowerCase();
    let title = `${event.type} on ${event.repo.name}`;
    let summary: string | null = null;

    if (event.type === 'PushEvent') {
      const commits = (event.payload.commits as Array<{ message: string }>) || [];
      title = `Pushed ${commits.length} commit${commits.length === 1 ? '' : 's'} to ${event.repo.name}`;
      summary = commits.map((c) => c.message).slice(0, 3).join('; ');
    } else if (event.type === 'PullRequestEvent') {
      const action = (event.payload.action as string) || 'updated';
      const pr = (event.payload.pull_request as { title?: string; number?: number }) || {};
      title = `${action.toUpperCase()} PR #${pr.number || ''} on ${event.repo.name}`;
      summary = pr.title || null;
    } else if (event.type === 'IssuesEvent') {
      const action = (event.payload.action as string) || 'updated';
      const issue = (event.payload.issue as { title?: string; number?: number }) || {};
      title = `${action.toUpperCase()} issue #${issue.number || ''} on ${event.repo.name}`;
      summary = issue.title || null;
    } else if (event.type === 'CreateEvent') {
      const refType = (event.payload.ref_type as string) || 'resource';
      title = `Created ${refType} on ${event.repo.name}`;
    }

    return {
      externalId: String(event.id),
      activityType: eventType,
      occurredAt: event.created_at,
      title,
      summary,
      externalUrl: `https://github.com/${event.repo.name}`,
      repositoryExternalId: event.repo.id ? String(event.repo.id) : null,
      metadata: {
        actor: event.actor.login,
        repo: event.repo.name,
        type: event.type,
      },
      rawPayload: event.payload,
    };
  }
}
