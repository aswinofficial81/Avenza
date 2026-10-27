import React, { useMemo } from 'react';
import type { CareerApplicationDto, CareerOpportunityDto, CareerTargetDto } from '@avenza/shared';
import { CareerApplicationCard } from './CareerApplicationCard';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Briefcase } from 'lucide-react';

export interface CareerPipelineKanbanProps {
  applications: CareerApplicationDto[];
  opportunities: CareerOpportunityDto[];
  targets: CareerTargetDto[];
  searchQuery: string;
  selectedTargetId: string;
  onQuickTransition: (app: CareerApplicationDto) => void;
  onNewApplication: () => void;
}

interface ColumnConfig {
  id: string;
  title: string;
  stages: string[];
  colorClass: string;
  badgeVariant: 'default' | 'secondary' | 'success' | 'warning' | 'danger';
}

const KANBAN_COLUMNS: ColumnConfig[] = [
  {
    id: 'col-saved',
    title: 'Saved',
    stages: ['saved'],
    colorClass: 'border-t-slate-400',
    badgeVariant: 'secondary',
  },
  {
    id: 'col-applied',
    title: 'Applied',
    stages: ['applied'],
    colorClass: 'border-t-blue-500',
    badgeVariant: 'default',
  },
  {
    id: 'col-screening',
    title: 'Screening',
    stages: ['screening'],
    colorClass: 'border-t-amber-500',
    badgeVariant: 'warning',
  },
  {
    id: 'col-assessment',
    title: 'Assessment',
    stages: ['assessment'],
    colorClass: 'border-t-indigo-500',
    badgeVariant: 'warning',
  },
  {
    id: 'col-interview',
    title: 'Interview',
    stages: ['interview'],
    colorClass: 'border-t-purple-500',
    badgeVariant: 'warning',
  },
  {
    id: 'col-offer',
    title: 'Offer',
    stages: ['offer'],
    colorClass: 'border-t-emerald-500',
    badgeVariant: 'success',
  },
  {
    id: 'col-terminal',
    title: 'Closed / Terminal',
    stages: ['accepted', 'declined', 'rejected', 'withdrawn', 'closed'],
    colorClass: 'border-t-rose-500',
    badgeVariant: 'danger',
  },
];

export const CareerPipelineKanban: React.FC<CareerPipelineKanbanProps> = ({
  applications,
  opportunities,
  targets: _targets,
  searchQuery,
  selectedTargetId,
  onQuickTransition,
  onNewApplication,
}) => {
  // Map opportunity_id -> CareerOpportunityDto
  const oppMap = useMemo(() => {
    const map = new Map<string, CareerOpportunityDto>();
    for (const opp of opportunities) {
      map.set(opp.id, opp);
    }
    return map;
  }, [opportunities]);

  // Filter applications by search query and target
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const opp = oppMap.get(app.opportunity_id);

      // Target filter
      if (selectedTargetId && opp?.target_id !== selectedTargetId) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const companyMatch = opp?.company_name.toLowerCase().includes(query);
        const roleMatch = opp?.role_title.toLowerCase().includes(query);
        const notesMatch = app.notes?.toLowerCase().includes(query);
        return companyMatch || roleMatch || notesMatch;
      }

      return true;
    });
  }, [applications, oppMap, searchQuery, selectedTargetId]);

  if (applications.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase className="h-6 w-6 stroke-[1.5]" />}
        title="No Career Applications Found"
        description="Start tracking your career trajectory by saving or submitting your first job application."
        action={
          <button
            type="button"
            onClick={onNewApplication}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            Create Application
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Kanban Board Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 items-start overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((column) => {
          const colApps = filteredApplications.filter((app) =>
            column.stages.includes(app.stage)
          );

          return (
            <div
              key={column.id}
              className={`flex flex-col rounded-lg border border-border bg-surface-2/40 border-t-2 ${column.colorClass} min-h-[350px] max-h-[780px] overflow-hidden`}
              data-testid={`kanban-column-${column.id}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between p-3 border-b border-border-subtle bg-surface/60">
                <span className="font-semibold text-xs text-foreground tracking-tight">
                  {column.title}
                </span>
                <Badge variant={column.badgeVariant} className="text-[10px] px-1.5 py-0 font-mono">
                  {colApps.length}
                </Badge>
              </div>

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                {colApps.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-28 text-center text-muted-foreground p-3 border border-dashed border-border-subtle rounded-md">
                    <span className="text-[11px]">No applications</span>
                  </div>
                ) : (
                  colApps.map((app) => (
                    <CareerApplicationCard
                      key={app.id}
                      application={app}
                      opportunity={oppMap.get(app.opportunity_id)}
                      onQuickTransition={onQuickTransition}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
