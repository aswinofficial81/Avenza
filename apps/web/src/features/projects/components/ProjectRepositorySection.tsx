import React, { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import {
  GitFork,
  Star,
  ExternalLink,
  GitBranch,
  Github,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { LinkRepositoryModal } from './LinkRepositoryModal';
import { useIntegrationStatus, useSyncIntegration } from '../../integrations/hooks/useIntegrations';
import { useLinkProjectRepository } from '../hooks/useProjects';
import type { ExternalRepositoryDto } from '@avenza/shared';

export interface ProjectRepositorySectionProps {
  projectId: string;
  repository?: ExternalRepositoryDto | null;
}

export const ProjectRepositorySection: React.FC<ProjectRepositorySectionProps> = ({
  projectId,
  repository,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: statusData, isLoading: isLoadingStatus } = useIntegrationStatus('github');
  const syncMutation = useSyncIntegration();
  const unlinkMutation = useLinkProjectRepository();

  const isGitHubConnected = statusData?.connection?.status === 'CONNECTED';
  const isSyncing = syncMutation.isPending || statusData?.connection?.status === 'SYNCING';

  const handleUnlink = async () => {
    await unlinkMutation.mutateAsync({
      projectId,
      repositoryId: null,
    });
  };

  const handleSync = () => {
    syncMutation.mutate('github');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">GitHub Repository</h3>
          <p className="text-sm text-muted-foreground">
            Synchronized repository context surfacing branch, commit, and pull request activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isGitHubConnected && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync GitHub'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="gap-1.5"
          >
            <Github className="w-4 h-4" />
            {repository ? 'Change Repository' : 'Link Repository'}
          </Button>
        </div>
      </div>

      {/* Disconnected GitHub Banner */}
      {!isLoadingStatus && !isGitHubConnected && (
        <Card className="p-4 border-warning/30 bg-warning/5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">GitHub Disconnected</h4>
              <p className="text-xs text-muted-foreground">
                Connect your GitHub account to sync repositories and track external engineering signals. Project tasks and milestones continue to function normally.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = '/settings';
            }}
            className="shrink-0 text-xs"
          >
            Connect GitHub
          </Button>
        </Card>
      )}

      {/* Linked Repository Details */}
      {repository ? (
        <Card className="p-5 space-y-4 border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Github className="w-5 h-5 text-foreground shrink-0" />
                <h4 className="text-base font-semibold text-foreground">
                  {repository.full_name}
                </h4>
                {repository.is_private && (
                  <Badge variant="secondary" className="text-xs">
                    Private
                  </Badge>
                )}
              </div>
              {repository.description && (
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {repository.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {repository.html_url && (
                <a
                  href={repository.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline px-3 py-1.5 rounded border border-border/60 hover:bg-surface-2 transition-colors"
                >
                  <span>Open on GitHub</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/40 text-xs">
            <div className="space-y-1">
              <span className="text-muted-foreground">Default Branch</span>
              <div className="flex items-center gap-1 font-medium text-foreground">
                <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{repository.default_branch || 'main'}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground">Primary Language</span>
              <div className="font-medium text-foreground">
                {repository.primary_language || 'Not specified'}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground">Stars & Forks</span>
              <div className="flex items-center gap-3 font-medium text-foreground">
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-warning" />
                  {repository.stars_count}
                </span>
                <span className="flex items-center gap-1">
                  <GitFork className="w-3.5 h-3.5 text-muted-foreground" />
                  {repository.forks_count}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground">Last Pushed</span>
              <div className="font-medium text-foreground">
                {repository.pushed_at
                  ? new Date(repository.pushed_at).toLocaleDateString()
                  : 'N/A'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs text-muted-foreground">
            <span>
              External repository signals are read-only and contextual.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnlink}
              disabled={unlinkMutation.isPending}
              className="text-xs text-danger hover:text-danger hover:bg-danger/10 h-7 px-2"
            >
              Unlink Repository
            </Button>
          </div>
        </Card>
      ) : isGitHubConnected ? (
        <Card className="p-6 text-center space-y-3 border-dashed border-border/80">
          <Github className="w-8 h-8 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">No Repository Linked</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Link one of your synced GitHub repositories to display commit and PR activity directly in this project workspace.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="gap-1.5"
          >
            <Github className="w-4 h-4" />
            Link Repository
          </Button>
        </Card>
      ) : null}

      <LinkRepositoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={projectId}
        currentRepositoryId={repository?.id}
      />
    </div>
  );
};
