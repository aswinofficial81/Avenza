import React from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Plus, Target, Briefcase, FileCheck2, Compass } from 'lucide-react';

export interface CareerPipelineHeaderProps {
  totalApplications: number;
  activeCount: number;
  interviewCount: number;
  offerCount: number;
  targetCount: number;
  onNewApplication: () => void;
  onNewOpportunity: () => void;
  onNewTarget: () => void;
}

export const CareerPipelineHeader: React.FC<CareerPipelineHeaderProps> = ({
  totalApplications,
  activeCount,
  interviewCount,
  offerCount,
  targetCount,
  onNewApplication,
  onNewOpportunity,
  onNewTarget,
}) => {
  return (
    <div className="space-y-4 pb-4 border-b border-border-subtle">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Compass className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Career Pipeline & Workspace
            </h1>
            <Badge variant="default">Phase 16E</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Target roles, verified job opportunities, active application pipelines, and preparation workspaces.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Target className="w-3.5 h-3.5" />}
            onClick={onNewTarget}
            id="career-new-target-btn"
          >
            New Target
          </Button>

          <Button
            size="sm"
            variant="outline"
            leftIcon={<Briefcase className="w-3.5 h-3.5" />}
            onClick={onNewOpportunity}
            id="career-new-opp-btn"
          >
            New Opportunity
          </Button>

          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={onNewApplication}
            id="career-new-app-btn"
          >
            New Application
          </Button>
        </div>
      </div>

      {/* Metric Badges */}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-2 border border-border-subtle">
          <span className="text-muted-foreground font-medium">Total Applications:</span>
          <span className="font-semibold text-foreground font-mono">{totalApplications}</span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
          <span className="font-medium">Active Pipeline:</span>
          <span className="font-semibold font-mono">{activeCount}</span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
          <span className="font-medium">Interviewing:</span>
          <span className="font-semibold font-mono">{interviewCount}</span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
          <FileCheck2 className="w-3.5 h-3.5" />
          <span className="font-medium">Offers:</span>
          <span className="font-semibold font-mono">{offerCount}</span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-2 border border-border-subtle text-muted-foreground">
          <span className="font-medium">Targets:</span>
          <span className="font-semibold text-foreground font-mono">{targetCount}</span>
        </div>
      </div>
    </div>
  );
};
