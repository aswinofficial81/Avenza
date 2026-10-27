import React from 'react';
import type { CareerTargetDto } from '@avenza/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  Target,
  Star,
  MapPin,
  DollarSign,
  Calendar,
  Plus,
  CheckCircle,
} from 'lucide-react';
import { useSetPrimaryCareerTarget } from '../hooks/useCareer';

export interface CareerTargetsListProps {
  targets: CareerTargetDto[];
  onNewTarget: () => void;
}

export const CareerTargetsList: React.FC<CareerTargetsListProps> = ({
  targets,
  onNewTarget,
}) => {
  const setPrimaryMutation = useSetPrimaryCareerTarget();

  if (targets.length === 0) {
    return (
      <EmptyState
        icon={<Target className="h-6 w-6 stroke-[1.5]" />}
        title="No Career Targets Defined"
        description="Establish explicit target job profiles, compensation goals, and locations to focus your search."
        action={
          <Button size="sm" onClick={onNewTarget}>
            Create Target
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
        <span>Showing {targets.length} target profiles</span>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={onNewTarget}
        >
          Add Target
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {targets.map((target) => (
          <div
            key={target.id}
            className={`flex flex-col justify-between p-4 rounded-lg border bg-surface hover:shadow-sm transition-all text-xs ${
              target.is_primary
                ? 'border-primary/40 shadow-sm ring-1 ring-primary/20'
                : 'border-border'
            }`}
            data-testid={`target-card-${target.id}`}
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground text-sm line-clamp-1">
                    {target.title}
                  </h3>
                  <p className="text-muted-foreground font-medium text-[11px] mt-0.5">
                    {target.target_role}
                  </p>
                </div>

                {target.is_primary && (
                  <Badge variant="default" className="gap-1 text-[10px] shrink-0">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    Primary Target
                  </Badge>
                )}
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-[11px] text-muted-foreground">
                {target.target_locations && target.target_locations.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span>{target.target_locations.join(', ')}</span>
                  </div>
                )}

                {target.min_compensation != null && (
                  <div className="flex items-center gap-1.5 font-mono text-foreground font-medium">
                    <DollarSign className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      Min {target.currency || '$'}
                      {target.min_compensation.toLocaleString()}/yr
                    </span>
                  </div>
                )}

                {target.target_date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>Target Date: {new Date(target.target_date).toLocaleDateString()}</span>
                  </div>
                )}

                {target.employment_type && (
                  <div className="pt-1 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                    Type: {target.employment_type.replace('_', ' ')}
                  </div>
                )}

                {target.notes && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 italic pt-1 border-t border-border-subtle">
                    "{target.notes}"
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border-subtle">
              {!target.is_primary ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                  leftIcon={<Star className="w-3 h-3" />}
                  isLoading={setPrimaryMutation.isPending}
                  onClick={() => setPrimaryMutation.mutate(target.id)}
                >
                  Set Primary
                </Button>
              ) : (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Active Focus
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
