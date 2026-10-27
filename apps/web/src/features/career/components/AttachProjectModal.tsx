import React, { useState } from 'react';
import { useProjects } from '../../projects/hooks/useProjects';
import { useAttachCareerApplicationProject } from '../hooks/useCareer';

interface AttachProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  alreadyAttachedProjectIds?: string[];
}

export const AttachProjectModal: React.FC<AttachProjectModalProps> = ({
  isOpen,
  onClose,
  applicationId,
  alreadyAttachedProjectIds = [],
}) => {
  const { data: projectsData, isLoading: projectsLoading } = useProjects({ pageSize: 100 });
  const attachProjectMutation = useAttachCareerApplicationProject(applicationId);

  const [projectId, setProjectId] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [talkingPoints, setTalkingPoints] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const availableProjects = (projectsData?.data || []).filter(
    (p) => !alreadyAttachedProjectIds.includes(p.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!projectId) {
      setFormError('Please select a project to attach.');
      return;
    }

    try {
      await attachProjectMutation.mutateAsync({
        project_id: projectId,
        is_featured: isFeatured,
        talking_points: talkingPoints.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to attach project.';
      setFormError(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attach-project-title"
    >
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl p-6 text-foreground my-8">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h2 id="attach-project-title" className="text-xl font-bold tracking-tight">
            Attach Project to Application
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground text-xl p-1 rounded transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {formError && (
          <div className="mb-4 p-3 bg-error/10 border border-error/30 text-error rounded-lg text-sm">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Select Project <span className="text-error">*</span>
            </label>
            {projectsLoading ? (
              <p className="text-xs text-foreground-muted">Loading projects...</p>
            ) : availableProjects.length === 0 ? (
              <p className="text-xs text-amber-400">
                No unattached projects found. Create a project in Projects first or all projects are already attached.
              </p>
            ) : (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">-- Choose a project --</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isFeatured"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary w-4 h-4 bg-surface"
            />
            <label htmlFor="isFeatured" className="text-sm font-medium cursor-pointer">
              Mark as Featured Project for this application
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Interview Talking Points (Optional)
            </label>
            <textarea
              value={talkingPoints}
              onChange={(e) => setTalkingPoints(e.target.value)}
              placeholder="Key architectural choices, trade-offs, metrics, or stories to highlight during interviews..."
              rows={4}
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border text-sm font-medium rounded-lg hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={attachProjectMutation.isPending || !projectId}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {attachProjectMutation.isPending ? 'Attaching...' : 'Attach Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
