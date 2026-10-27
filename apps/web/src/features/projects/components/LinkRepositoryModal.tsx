import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { useIntegrationRepositories, useIntegrationStatus } from '../../integrations/hooks/useIntegrations';
import { useLinkProjectRepository } from '../hooks/useProjects';

export interface LinkRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentRepositoryId?: string | null;
}

export const LinkRepositoryModal: React.FC<LinkRepositoryModalProps> = ({
  isOpen,
  onClose,
  projectId,
  currentRepositoryId,
}) => {
  const { data: statusData } = useIntegrationStatus('github');
  const isGitHubConnected = statusData?.connection?.status === 'CONNECTED';

  const { data: repositories = [], isLoading: isLoadingRepos } = useIntegrationRepositories(
    'github',
    isGitHubConnected
  );
  const linkRepoMutation = useLinkProjectRepository();

  const [selectedRepoId, setSelectedRepoId] = useState<string>(currentRepositoryId || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const repoOptions = [
    { label: '-- Select a synced repository --', value: '' },
    ...repositories.map((r) => ({
      label: `${r.full_name} (${r.primary_language || 'Code'}) ${r.is_private ? '[Private]' : ''}`,
      value: r.id,
    })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      await linkRepoMutation.mutateAsync({
        projectId,
        repositoryId: selectedRepoId ? selectedRepoId : null,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update repository linkage.';
      setErrorMessage(msg);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Link GitHub Repository"
      description="Connect this project to a synced repository to surface commits, pull requests, and activity signals."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {errorMessage && (
          <div className="p-2.5 rounded text-sm bg-danger/10 text-danger border border-danger/20">
            {errorMessage}
          </div>
        )}

        {!isGitHubConnected ? (
          <div className="p-4 rounded border border-warning/30 bg-warning/5 text-sm space-y-2">
            <p className="font-medium text-warning">GitHub Disconnected</p>
            <p className="text-muted-foreground">
              You must connect your GitHub account in Settings &rarr; Connected Accounts before linking repositories.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                window.location.href = '/settings';
              }}
            >
              Go to Connected Accounts
            </Button>
          </div>
        ) : (
          <Select
            label="Synced GitHub Repository"
            options={repoOptions}
            value={selectedRepoId}
            onChange={(e) => setSelectedRepoId(e.target.value)}
            disabled={isLoadingRepos || linkRepoMutation.isPending}
            description="Choose from repositories synced through your connected GitHub account."
          />
        )}

        <div className="flex justify-between items-center pt-4 border-t border-border/50">
          {currentRepositoryId && (
            <Button
              type="button"
              variant="ghost"
              className="text-danger hover:text-danger hover:bg-danger/10"
              onClick={async () => {
                try {
                  await linkRepoMutation.mutateAsync({
                    projectId,
                    repositoryId: null,
                  });
                  onClose();
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : 'Failed to unlink repository.';
                  setErrorMessage(msg);
                }
              }}
              disabled={linkRepoMutation.isPending}
            >
              Unlink Repository
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={linkRepoMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={linkRepoMutation.isPending}
              disabled={!isGitHubConnected || isLoadingRepos}
            >
              Save Linkage
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
