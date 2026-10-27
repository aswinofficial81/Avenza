import React from 'react';
import type { CareerOpportunityDto, CareerTargetDto } from '@avenza/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  Briefcase,
  Building2,
  DollarSign,
  ExternalLink,
  MapPin,
  Plus,
  Calendar,
  FilePlus,
} from 'lucide-react';

export interface CareerOpportunitiesListProps {
  opportunities: CareerOpportunityDto[];
  targets: CareerTargetDto[];
  onNewOpportunity: () => void;
  onApply: (opportunity: CareerOpportunityDto) => void;
}

export const CareerOpportunitiesList: React.FC<CareerOpportunitiesListProps> = ({
  opportunities,
  targets,
  onNewOpportunity,
  onApply,
}) => {
  const targetMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const t of targets) {
      map.set(t.id, t.title);
    }
    return map;
  }, [targets]);

  if (opportunities.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase className="h-6 w-6 stroke-[1.5]" />}
        title="No Opportunities Recorded"
        description="Catalog verified job listings, internships, or recruiter leads with target role alignment."
        action={
          <Button size="sm" onClick={onNewOpportunity}>
            Create Opportunity
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
        <span>Showing {opportunities.length} opportunities</span>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={onNewOpportunity}
        >
          Add Opportunity
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {opportunities.map((opp) => (
          <div
            key={opp.id}
            className="flex flex-col justify-between p-4 rounded-lg border border-border bg-surface hover:border-border-subtle hover:shadow-sm transition-all text-xs"
            data-testid={`opportunity-card-${opp.id}`}
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground text-sm line-clamp-1">
                    {opp.role_title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium truncate">{opp.company_name}</span>
                  </div>
                </div>

                <Badge
                  variant={
                    opp.status === 'active'
                      ? 'success'
                      : opp.status === 'expired'
                      ? 'danger'
                      : 'secondary'
                  }
                  className="capitalize shrink-0 text-[10px]"
                >
                  {opp.status}
                </Badge>
              </div>

              {/* Target association */}
              {opp.target_id && targetMap.has(opp.target_id) && (
                <div className="inline-block px-2 py-0.5 rounded bg-surface-2 border border-border-subtle text-[11px] text-muted-foreground font-medium">
                  Target: <span className="text-foreground">{targetMap.get(opp.target_id)}</span>
                </div>
              )}

              {/* Metadata */}
              <div className="space-y-1.5 text-[11px] text-muted-foreground">
                {(opp.location || opp.location_type) && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="capitalize">
                      {opp.location || ''} {opp.location_type ? `(${opp.location_type})` : ''}
                    </span>
                  </div>
                )}

                {(opp.salary_min != null || opp.salary_max != null) && (
                  <div className="flex items-center gap-1.5 font-mono text-foreground font-medium">
                    <DollarSign className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      {opp.salary_currency || '$'}
                      {opp.salary_min != null ? opp.salary_min.toLocaleString() : ''}
                      {opp.salary_min != null && opp.salary_max != null ? ' - ' : ''}
                      {opp.salary_max != null ? opp.salary_max.toLocaleString() : ''}
                    </span>
                  </div>
                )}

                {opp.deadline && (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>Deadline: {new Date(opp.deadline).toLocaleDateString()}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  <span>Source: {opp.source.replace('_', ' ')}</span>
                  {opp.employment_type && (
                    <span>• {opp.employment_type.replace('_', ' ')}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border-subtle">
              {opp.job_url ? (
                <a
                  href={opp.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <span>Listing</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span />
              )}

              <Button
                size="sm"
                variant="primary"
                className="h-7 text-[11px]"
                leftIcon={<FilePlus className="w-3 h-3" />}
                onClick={() => onApply(opp)}
              >
                Track Application
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
