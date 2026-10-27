import React, { useState } from 'react';
import type { ProjectMilestoneDto, TaskDto } from '@avenza/shared';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ConfirmationDialog } from '../../../components/ui/ConfirmationDialog';
import { ProjectMilestoneModal } from './ProjectMilestoneModal';
import {
  useDeleteProjectMilestone,
  useUpdateProjectMilestone,
} from '../hooks/useProjects';
import {
  Calendar,
  CheckCircle2,
  Check,
  Edit2,
  Plus,
  Trash2,
  SkipForward,
  Flag,
  ListTodo,
} from 'lucide-react';

export interface ProjectMilestonesSectionProps {
  projectId: string;
  milestones?: ProjectMilestoneDto[];
  tasks?: TaskDto[];
}

export const ProjectMilestonesSection: React.FC<ProjectMilestonesSectionProps> = ({
  projectId,
  milestones = [],
  tasks = [],
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<ProjectMilestoneDto | null>(null);
  const [deletingMilestone, setDeletingMilestone] = useState<ProjectMilestoneDto | null>(null);

  const updateMutation = useUpdateProjectMilestone(projectId);
  const deleteMutation = useDeleteProjectMilestone(projectId);

  const sortedMilestones = [...milestones].sort((a, b) => a.order_index - b.order_index);

  const handleCreate = () => {
    setSelectedMilestone(null);
    setIsModalOpen(true);
  };

  const handleEdit = (m: ProjectMilestoneDto) => {
    setSelectedMilestone(m);
    setIsModalOpen(true);
  };

  const handleComplete = async (m: ProjectMilestoneDto) => {
    await updateMutation.mutateAsync({
      id: m.id,
      data: {
        status: 'completed',
        completed_at: new Date().toISOString(),
      },
    });
  };

  const handleSkip = async (m: ProjectMilestoneDto) => {
    await updateMutation.mutateAsync({
      id: m.id,
      data: {
        status: 'skipped',
      },
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingMilestone) return;
    await deleteMutation.mutateAsync(deletingMilestone.id);
    setDeletingMilestone(null);
  };

  const getStatusBadge = (status: ProjectMilestoneDto['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success" className="text-2xs capitalize">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="info" className="text-2xs capitalize">In Progress</Badge>;
      case 'skipped':
        return <Badge variant="default" className="text-2xs capitalize">Skipped</Badge>;
      case 'pending':
      default:
        return <Badge variant="secondary" className="text-2xs capitalize">Pending</Badge>;
    }
  };

  const getTaskCountForMilestone = (milestoneId: string) => {
    return tasks.filter((t) => t.project_milestone_id === milestoneId).length;
  };

  return (
    <div className="space-y-4" data-testid="project-milestones-section">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Project Milestones</h3>
          <p className="text-xs text-muted-foreground">
            Structured roadmap stages and delivery checkpoints.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleCreate} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add Milestone
        </Button>
      </div>

      {sortedMilestones.length === 0 ? (
        <EmptyState
          icon={<Flag className="w-6 h-6 stroke-[1.5]" />}
          title="No milestones yet"
          description="Create structured phases and target milestones for this project."
          action={
            <Button variant="outline" size="sm" onClick={handleCreate} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Create First Milestone
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {sortedMilestones.map((milestone, idx) => {
            const taskCount = getTaskCountForMilestone(milestone.id);
            const isCompleted = milestone.status === 'completed';
            const isSkipped = milestone.status === 'skipped';

            return (
              <Card
                key={milestone.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-border/80"
                data-testid={`milestone-item-${milestone.id}`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-2xs font-mono font-semibold px-1.5 py-0.5 rounded bg-surface-2 text-muted-foreground border border-border/60">
                      #{idx + 1}
                    </span>
                    <h4 className="text-sm font-semibold text-foreground truncate">
                      {milestone.title}
                    </h4>
                    {getStatusBadge(milestone.status)}
                  </div>

                  {milestone.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {milestone.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-0.5 flex-wrap">
                    {milestone.target_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        Target: {new Date(milestone.target_date).toLocaleDateString()}
                      </span>
                    )}

                    <span className="flex items-center gap-1">
                      <ListTodo className="w-3 h-3 text-muted-foreground" />
                      {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                    </span>

                    {milestone.completed_at && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed: {new Date(milestone.completed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Milestone Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {!isCompleted && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleComplete(milestone)}
                      title="Mark Milestone Completed"
                      aria-label="Complete milestone"
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Complete
                    </Button>
                  )}

                  {!isCompleted && !isSkipped && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSkip(milestone)}
                      title="Skip Milestone"
                      aria-label="Skip milestone"
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <SkipForward className="w-3.5 h-3.5 mr-1" />
                      Skip
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(milestone)}
                    title="Edit Milestone"
                    aria-label="Edit milestone"
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingMilestone(milestone)}
                    title="Delete Milestone"
                    aria-label="Delete milestone"
                    className="h-8 px-2 text-xs text-danger hover:text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Milestone Modal */}
      <ProjectMilestoneModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={projectId}
        milestone={selectedMilestone}
        defaultOrderIndex={sortedMilestones.length}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(deletingMilestone)}
        onClose={() => setDeletingMilestone(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Milestone"
        message={`Are you sure you want to delete milestone "${deletingMilestone?.title}"? Existing tasks will remain in the project but will no longer be linked to this milestone.`}
        confirmLabel="Delete Milestone"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
