import React, { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Wrench, ArrowLeftRight, Trash2, Plus } from 'lucide-react';
import { LinkSkillModal } from './LinkSkillModal';
import { useSkills } from '../../skills/useSkills';
import { useUpdateProjectSkill, useDetachProjectSkill } from '../hooks/useProjects';
import type { ProjectSkillDto, ProjectSkillRole } from '@avenza/shared';

export interface ProjectSkillsSectionProps {
  projectId: string;
  skills: ProjectSkillDto[];
}

export const ProjectSkillsSection: React.FC<ProjectSkillsSectionProps> = ({
  projectId,
  skills = [],
}) => {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const { data: allSkillsWithMastery } = useSkills();
  const updateSkillMutation = useUpdateProjectSkill();
  const detachSkillMutation = useDetachProjectSkill();

  const handleToggleRole = async (skillId: string, currentRole: ProjectSkillRole) => {
    const nextRole: ProjectSkillRole = currentRole === 'primary' ? 'supporting' : 'primary';
    await updateSkillMutation.mutateAsync({
      projectId,
      skillId,
      role: nextRole,
    });
  };

  const handleDetach = async (skillId: string) => {
    await detachSkillMutation.mutateAsync({
      projectId,
      skillId,
    });
  };

  // Build lookup map for existing skill mastery from the skills domain
  const masteryMap = new Map<string, number>();
  if (allSkillsWithMastery) {
    for (const item of allSkillsWithMastery) {
      if (item.mastery?.score !== undefined) {
        masteryMap.set(item.skill.id, Math.round(item.mastery.score));
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Project Skills</h3>
          <p className="text-sm text-muted-foreground">
            Core and supporting technical capabilities applied in this project. Linking does not award XP or modify mastery.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsLinkModalOpen(true)}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Attach Skill
        </Button>
      </div>

      {skills.length === 0 ? (
        <EmptyState
          title="No Skills Attached"
          description="Map the technical stack and domains used in this project to capture real-world application."
          action={
            <Button size="sm" onClick={() => setIsLinkModalOpen(true)}>
              Attach Skill
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {skills.map((s) => {
            const mastery = masteryMap.get(s.skill_id);
            return (
              <Card key={s.skill_id} className="p-4 flex flex-col justify-between border-border/80">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-info shrink-0" />
                      <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                        {s.skill_name || `Skill ${s.skill_id.slice(0, 8)}`}
                      </h4>
                    </div>
                    <Badge
                      variant={s.role === 'primary' ? 'default' : 'secondary'}
                      className="text-xs capitalize shrink-0"
                    >
                      {s.role}
                    </Badge>
                  </div>

                  {mastery !== undefined && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Existing Domain Mastery:</span>
                      <span className="font-medium text-foreground">{mastery}%</span>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Linked {new Date(s.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleRole(s.skill_id, s.role)}
                    disabled={updateSkillMutation.isPending}
                    className="text-xs h-7 px-2"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 mr-1" />
                    Make {s.role === 'primary' ? 'Supporting' : 'Primary'}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDetach(s.skill_id)}
                    disabled={detachSkillMutation.isPending}
                    className="text-xs h-7 px-2 text-danger hover:text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Detach
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <LinkSkillModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        projectId={projectId}
        existingSkills={skills}
      />
    </div>
  );
};
