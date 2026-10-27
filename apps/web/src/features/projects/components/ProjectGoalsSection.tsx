import React, { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Target, Star, Trash2, Plus } from 'lucide-react';
import { LinkGoalModal } from './LinkGoalModal';
import { useUpdateProjectGoal, useDetachProjectGoal } from '../hooks/useProjects';
import type { ProjectGoalDto } from '@avenza/shared';

export interface ProjectGoalsSectionProps {
  projectId: string;
  goals: ProjectGoalDto[];
}

export const ProjectGoalsSection: React.FC<ProjectGoalsSectionProps> = ({
  projectId,
  goals = [],
}) => {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const updateGoalMutation = useUpdateProjectGoal();
  const detachGoalMutation = useDetachProjectGoal();

  const handleSetPrimary = async (goalId: string, currentPrimary: boolean) => {
    await updateGoalMutation.mutateAsync({
      projectId,
      goalId,
      isPrimary: !currentPrimary,
    });
  };

  const handleDetach = async (goalId: string) => {
    await detachGoalMutation.mutateAsync({
      projectId,
      goalId,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Project Goals</h3>
          <p className="text-sm text-muted-foreground">
            Strategic goals connected to this project. Projects drive goal progress through verified execution.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsLinkModalOpen(true)}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Attach Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          title="No Goals Attached"
          description="Link this project to an existing high-level goal to give your engineering work strategic alignment."
          action={
            <Button size="sm" onClick={() => setIsLinkModalOpen(true)}>
              Attach Goal
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {goals.map((g) => (
            <Card key={g.goal_id} className="p-4 flex flex-col justify-between border-border/80">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary shrink-0" />
                    <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                      {g.goal_title || `Goal ${g.goal_id.slice(0, 8)}`}
                    </h4>
                  </div>
                  {g.is_primary && (
                    <Badge variant="default" className="text-xs shrink-0 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" />
                      Primary
                    </Badge>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  Linked {new Date(g.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSetPrimary(g.goal_id, g.is_primary)}
                  disabled={updateGoalMutation.isPending}
                  className="text-xs h-7 px-2"
                >
                  {g.is_primary ? 'Unset Primary' : 'Set as Primary'}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDetach(g.goal_id)}
                  disabled={detachGoalMutation.isPending}
                  className="text-xs h-7 px-2 text-danger hover:text-danger hover:bg-danger/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Detach
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <LinkGoalModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        projectId={projectId}
        existingGoals={goals}
      />
    </div>
  );
};
